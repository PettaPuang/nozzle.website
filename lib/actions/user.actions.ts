"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/utils/permissions.server";
import { hasPermission } from "@/lib/utils/permissions";
import {
  createUserWithProfileSchema,
  type CreateUserWithProfileInput,
} from "@/lib/validations/user.validation";
import bcrypt from "bcryptjs";

export async function createUser(
  input: CreateUserWithProfileInput,
  gasStationId?: string
) {
  try {
    // 1. Check permission
    const { authorized, user } = await checkPermission([
      "DEVELOPER",
      "ADMINISTRATOR",
    ]);
    if (!authorized || !user) {
      return { success: false, message: "Forbidden" };
    }

    // 2. Validation
    const validated = createUserWithProfileSchema.parse(input);

    // 3. Check if trying to create DEVELOPER or ADMINISTRATOR role
    // Hanya DEVELOPER yang bisa membuat user dengan role DEVELOPER atau ADMINISTRATOR
    if (
      (validated.roleId === "DEVELOPER" ||
        validated.roleId === "ADMINISTRATOR") &&
      !hasPermission(user.roleCode as any, ["DEVELOPER"])
    ) {
      return {
        success: false,
        message:
          "Hanya Developer yang bisa membuat user dengan role Developer atau Administrator",
      };
    }

    // 4. Check jika mencoba membuat OWNER, ADMINISTRATOR, OWNER_GROUP, atau DEVELOPER dari gas station
    // OWNER, ADMINISTRATOR, OWNER_GROUP, dan DEVELOPER hanya bisa dibuat dari admin panel (tanpa gasStationId)
    if (
      gasStationId &&
      (validated.roleId === "OWNER" ||
        validated.roleId === "ADMINISTRATOR" ||
        validated.roleId === "OWNER_GROUP" ||
        validated.roleId === "DEVELOPER")
    ) {
      return {
        success: false,
        message:
          "Owner, Administrator, Owner Group, dan Developer hanya bisa dibuat dari admin panel",
      };
    }

    // 5. Fetch currentUser.ownerId untuk ADMINISTRATOR dan OWNER_GROUP
    // Jika OWNER_GROUP dibuat dari admin tools (tanpa gasStationId), ownerId diambil dari currentUser.ownerId
    const currentUserWithOwner = await prisma.user.findUnique({
      where: { id: user.id },
      select: { ownerId: true },
    });
    const currentUserOwnerId = currentUserWithOwner?.ownerId || null;

    // 6. Check ownerId untuk OWNER_GROUP
    // Jika dibuat dari gas station (ada gasStationId), harus pilih owner
    // Jika dibuat dari admin tools (tidak ada gasStationId), gunakan currentUser.ownerId
    if (validated.roleId === "OWNER_GROUP") {
      if (gasStationId && !validated.ownerId) {
        // Dari gas station, harus pilih owner
        return {
          success: false,
          message: "Owner harus dipilih untuk Owner Group",
        };
      }
      // Dari admin tools, akan gunakan currentUser.ownerId di bawah
    }

    // 7. Hash password
    const hashedPassword = await bcrypt.hash(validated.password, 10);

    // 8. Create user with profile in transaction
    const newUser = await prisma.$transaction(async (tx) => {
      // Create profile first
      const profile = await tx.profile.create({
        data: {
          name: validated.name,
          phone: validated.phone || null,
          address: validated.address || null,
          avatar: validated.avatar || null,
          createdBy: { connect: { id: user.id } },
        },
      });

      // Create user
      const createdUser = await tx.user.create({
        data: {
          username: validated.username,
          email: validated.email,
          password: hashedPassword,
          role: validated.roleId as any, // Enum Role
          profileId: profile.id,
          // Set ownerId:
          // - ADMINISTRATOR: selalu dari currentUser.ownerId
          // - OWNER_GROUP: dari validated.ownerId jika ada (dari gas station), atau currentUser.ownerId jika tidak ada (dari admin tools)
          ...(validated.roleId === "ADMINISTRATOR" && currentUserOwnerId && {
            ownerId: currentUserOwnerId,
          }),
          ...(validated.roleId === "OWNER_GROUP" && {
            ownerId: validated.ownerId || currentUserOwnerId || undefined,
          }),
        },
      });

      // Auto-assign to gas station if provided
      if (gasStationId) {
        await tx.userGasStation.create({
          data: {
            userId: createdUser.id,
            gasStationId,
            status: "ACTIVE",
            createdById: user.id,
          },
        });
      }

      return createdUser;
    });

    revalidatePath("/admin/users");
    if (gasStationId) {
      revalidatePath(`/gas-stations/${gasStationId}`);
    }
    return { success: true, message: "User berhasil dibuat" };
  } catch (error) {
    console.error("Create user error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal membuat user" };
  }
}

export async function updateUser(
  userId: string,
  input: Partial<CreateUserWithProfileInput>
) {
  try {
    // 1. Get current user (semua authenticated user bisa akses)
    const { authorized, user } = await checkPermission([
      "DEVELOPER",
      "ADMINISTRATOR",
      "OWNER",
      "MANAGER",
      "OPERATOR",
      "UNLOADER",
      "FINANCE",
      "ACCOUNTING",
    ]);
    if (!user) {
      return { success: false, message: "Unauthorized" };
    }

    // 2. Check if user can update (semua bisa update sendiri, atau DEVELOPER/ADMINISTRATOR bisa update semua)
    const canUpdate =
      user.id === userId ||
      hasPermission(user.roleCode as any, ["DEVELOPER", "ADMINISTRATOR"]);

    if (!canUpdate) {
      return { success: false, message: "Forbidden" };
    }

    // 3. Check if trying to change role (hanya DEVELOPER/ADMINISTRATOR yang bisa)
    if (
      input.roleId &&
      !hasPermission(user.roleCode as any, ["DEVELOPER", "ADMINISTRATOR"])
    ) {
      return { success: false, message: "Tidak dapat mengubah role" };
    }

    // 4. Check if trying to change role to DEVELOPER or ADMINISTRATOR
    // Hanya DEVELOPER yang bisa mengubah role menjadi DEVELOPER atau ADMINISTRATOR
    if (
      input.roleId &&
      (input.roleId === "DEVELOPER" || input.roleId === "ADMINISTRATOR") &&
      !hasPermission(user.roleCode as any, ["DEVELOPER"])
    ) {
      return {
        success: false,
        message:
          "Hanya Developer yang bisa mengubah role menjadi Developer atau Administrator",
      };
    }

    // 5. Get existing user
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!existingUser) {
      return { success: false, message: "User tidak ditemukan" };
    }

    // 6. Update in transaction
    await prisma.$transaction(async (tx) => {
      // Update profile if exists
      if (existingUser.profileId) {
        await tx.profile.update({
          where: { id: existingUser.profileId },
          data: {
            ...(input.name && { name: input.name }),
            ...(input.phone !== undefined && { phone: input.phone || null }),
            ...(input.address !== undefined && {
              address: input.address || null,
            }),
            ...(input.avatar !== undefined && {
              avatar: input.avatar || null,
            }),
            updatedBy: { connect: { id: user.id } },
          },
        });
      }

      // Update user
      const updateData: any = {
        ...(input.username && { username: input.username }),
        ...(input.email && { email: input.email }),
        ...(input.roleId && { role: input.roleId as any }), // Enum Role
      };

      // Hash password if provided
      if (input.password) {
        updateData.password = await bcrypt.hash(input.password, 10);
      }

      await tx.user.update({
        where: { id: userId },
        data: updateData,
      });
    });

    revalidatePath("/admin/users");
    return { success: true, message: "User berhasil diupdate" };
  } catch (error) {
    console.error("Update user error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal mengupdate user" };
  }
}

export async function deleteUser(userId: string) {
  try {
    // 1. Check permission
    const { authorized, user } = await checkPermission([
      "DEVELOPER",
      "ADMINISTRATOR",
    ]);
    if (!authorized || !user) {
      return { success: false, message: "Forbidden" };
    }

    // 2. Delete user (profile will be cascade deleted if set in schema)
    await prisma.user.delete({
      where: { id: userId },
    });

    revalidatePath("/admin/users");
    return { success: true, message: "User berhasil dihapus" };
  } catch (error) {
    console.error("Delete user error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal menghapus user" };
  }
}

export async function assignUserToGasStation(
  userId: string,
  gasStationId: string
) {
  try {
    // 1. Check permission
    const { authorized, user } = await checkPermission([
      "DEVELOPER",
      "ADMINISTRATOR",
    ]);
    if (!authorized || !user) {
      return { success: false, message: "Forbidden" };
    }

    // 2. Check if already assigned
    const existing = await prisma.userGasStation.findFirst({
      where: {
        userId,
        gasStationId,
        status: "ACTIVE",
      },
    });

    if (existing) {
      return { success: false, message: "User sudah assigned ke SPBU ini" };
    }

    // 3. Create assignment
    await prisma.userGasStation.create({
      data: {
        userId,
        gasStationId,
        status: "ACTIVE",
        createdById: user.id,
      },
    });

    revalidatePath(`/admin/gas-stations/${gasStationId}`);
    revalidatePath("/admin/users");
    return { success: true, message: "User berhasil di-assign" };
  } catch (error) {
    console.error("Assign user error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal assign user" };
  }
}

export async function unassignUserFromGasStation(
  userId: string,
  gasStationId: string
) {
  try {
    // 1. Check permission
    const { authorized, user } = await checkPermission([
      "DEVELOPER",
      "ADMINISTRATOR",
    ]);
    if (!authorized || !user) {
      return { success: false, message: "Forbidden" };
    }

    // 2. Update status to INACTIVE
    await prisma.userGasStation.updateMany({
      where: {
        userId,
        gasStationId,
        status: "ACTIVE",
      },
      data: {
        status: "INACTIVE",
      },
    });

    revalidatePath(`/admin/gas-stations/${gasStationId}`);
    revalidatePath("/admin/users");
    return { success: true, message: "User berhasil di-unassign" };
  } catch (error) {
    console.error("Unassign user error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal unassign user" };
  }
}
