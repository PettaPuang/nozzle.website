import { auth } from "@/auth";
import { cache } from "react";

// Get current user (cached for multiple calls in same request)
export const getCurrentUser = cache(async () => {
  const session = await auth();
  return session?.user;
});

// Get session
export const getSession = cache(async () => {
  return await auth();
});

// Check if user is authenticated
export async function isAuthenticated() {
  const session = await auth();
  return !!session?.user;
}

// Check if user has specific role
export async function hasRole(roleCode: string) {
  const user = await getCurrentUser();
  return user?.roleCode === roleCode;
}

// Check if user has any of the roles
export async function hasAnyRole(roleCodes: string[]) {
  const user = await getCurrentUser();
  return user?.roleCode ? roleCodes.includes(user.roleCode) : false;
}

