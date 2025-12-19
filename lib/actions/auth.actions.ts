"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
});

export type AuthActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

export async function loginAction(
  prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const rawData = {
      email: formData.get("email"),
      password: formData.get("password"),
    };

    const validated = loginSchema.parse(rawData);

    await signIn("credentials", {
      email: validated.email,
      password: validated.password,
      redirect: false,
    });

    return {
      success: true,
      message: "Login successful",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Validation failed",
        errors: error.flatten().fieldErrors,
      };
    }

    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return {
            success: false,
            message: "Invalid email or password",
          };
        default:
          return {
            success: false,
            message: "Authentication error",
          };
      }
    }

    return {
      success: false,
      message: "An unexpected error occurred",
    };
  }
}

export async function registerAction(
  prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const rawData = {
      username: formData.get("username"),
      email: formData.get("email"),
      password: formData.get("password"),
      name: formData.get("name"),
      phone: formData.get("phone"),
    };

    const validated = registerSchema.parse(rawData);

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: validated.email }, { username: validated.username }],
      },
    });

    if (existingUser) {
      return {
        success: false,
        message: "Email or username already exists",
      };
    }

    // Default role adalah OPERATOR

    // Hash password
    const hashedPassword = await bcrypt.hash(validated.password, 10);

    // Create user with profile
    await prisma.$transaction(async (tx) => {
      // Create profile
      const profile = await tx.profile.create({
        data: {
          name: validated.name,
          phone: validated.phone || null,
        },
      });

      // Create user
      await tx.user.create({
        data: {
          username: validated.username,
          email: validated.email,
          password: hashedPassword,
          role: "OPERATOR", // Default role untuk user baru
          profileId: profile.id,
          createdAt: nowUTC(),
        },
      });
    });

    // Auto login after registration
    await signIn("credentials", {
      email: validated.email,
      password: validated.password,
      redirect: false,
    });

    return {
      success: true,
      message: "Registration successful",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Validation failed",
        errors: error.flatten().fieldErrors,
      };
    }

    return {
      success: false,
      message: "Registration failed. Please try again.",
    };
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
