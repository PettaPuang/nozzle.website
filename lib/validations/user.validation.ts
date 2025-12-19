import { z } from "zod";

// User validation schema
export const createUserSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter").max(50),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  roleId: z.enum(
    [
      "DEVELOPER",
      "ADMINISTRATOR",
      "OWNER",
      "MANAGER",
      "OPERATOR",
      "UNLOADER",
      "FINANCE",
      "ACCOUNTING",
    ],
    {
      message: "Role harus dipilih",
    }
  ),
});

export const updateUserSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter").max(50).optional(),
  email: z.string().email("Email tidak valid").optional(),
  password: z.string().min(6, "Password minimal 6 karakter").optional(),
  roleId: z.string().min(1, "Role harus dipilih").optional(),
});

// Profile validation schema
export const createProfileSchema = z.object({
  name: z.string().min(1, "Nama harus diisi").max(100),
  phone: z.string().optional(),
  address: z.string().optional(),
  avatar: z.string().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, "Nama harus diisi").max(100).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  avatar: z.string().optional(),
});

// Combined User + Profile for creation (with password confirmation)
export const createUserWithProfileSchema = z
  .object({
    // User fields
    username: z.string().min(3, "Username minimal 3 karakter").max(50),
    email: z.string().email("Email tidak valid"),
    password: z.string().min(6, "Password minimal 6 karakter"),
    confirmPassword: z
      .string()
      .min(6, "Konfirmasi password minimal 6 karakter"),
    roleId: z.enum(
      [
        "DEVELOPER",
        "ADMINISTRATOR",
        "OWNER",
        "OWNER_GROUP",
        "MANAGER",
        "OPERATOR",
        "UNLOADER",
        "FINANCE",
        "ACCOUNTING",
      ],
      {
        message: "Role harus dipilih",
      }
    ),
    ownerId: z.string().optional(), // Required untuk OWNER_GROUP

    // Profile fields
    name: z.string().min(1, "Nama harus diisi").max(100),
    phone: z.string().optional(),
    address: z.string().optional(),
    avatar: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password dan konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  })
  .refine(
    (data) => {
      // Jika role OWNER_GROUP, ownerId harus diisi
      // ADMINISTRATOR tidak perlu ownerId karena sudah default memiliki owner
      if (data.roleId === "OWNER_GROUP") {
        return !!data.ownerId && data.ownerId.length > 0;
      }
      return true;
    },
    {
      message: "Owner harus dipilih untuk Owner Group",
      path: ["ownerId"],
    }
  );

// Combined User + Profile for update (password optional)
export const updateUserWithProfileSchema = z
  .object({
    // User fields
    username: z
      .string()
      .min(3, "Username minimal 3 karakter")
      .max(50)
      .optional(),
    email: z.string().email("Email tidak valid").optional(),
    password: z
      .union([z.string().min(6, "Password minimal 6 karakter"), z.literal("")])
      .optional()
      .transform((val) => (val === "" ? undefined : val)),
    confirmPassword: z
      .union([
        z.string().min(6, "Konfirmasi password minimal 6 karakter"),
        z.literal(""),
      ])
      .optional()
      .transform((val) => (val === "" ? undefined : val)),
    roleId: z.string().min(1, "Role harus dipilih").optional(),
    ownerId: z.string().optional(), // Required untuk OWNER_GROUP

    // Profile fields
    name: z.string().min(1, "Nama harus diisi").max(100).optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    avatar: z.string().optional(),
  })
  .refine(
    (data) => {
      // If password is provided, confirmPassword must match
      if (data.password && data.password.length > 0) {
        return data.password === data.confirmPassword;
      }
      return true;
    },
    {
      message: "Password dan konfirmasi password tidak cocok",
      path: ["confirmPassword"],
    }
  )
  .refine(
    (data) => {
      // Jika role OWNER_GROUP, ownerId harus diisi
      // ADMINISTRATOR tidak perlu ownerId karena sudah default memiliki owner
      if (data.roleId === "OWNER_GROUP") {
        return !!data.ownerId && data.ownerId.length > 0;
      }
      return true;
    },
    {
      message: "Owner harus dipilih untuk Owner Group",
      path: ["ownerId"],
    }
  );

export type CreateUserWithProfileInput = z.infer<
  typeof createUserWithProfileSchema
>;

export type UpdateUserWithProfileInput = z.infer<
  typeof updateUserWithProfileSchema
>;
