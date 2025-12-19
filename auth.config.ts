import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authConfig = {
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.username = user.username;
        token.roleCode = user.roleCode; // Langsung enum Role

        // Get assigned gas station for staff
        if (!["ADMINISTRATOR", "OWNER", "DEVELOPER"].includes(user.roleCode)) {
          const assignment = await prisma.userGasStation.findFirst({
            where: { userId: user.id, status: "ACTIVE" },
            select: { gasStationId: true },
          });
          token.assignedGasStationId = assignment?.gasStationId;
        }
      }

      // Validate user exists in database on every token refresh
      // This handles cases where database was reset but session still exists
      if (token.id && !user) {
        let dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
        });

        // If user not found by ID, try to find by username (handles DB reset scenario)
        if (!dbUser && token.username) {
          console.warn(
            `[JWT] User ID ${token.id} not found, trying to find by username: ${token.username}`
          );
          dbUser = await prisma.user.findUnique({
            where: { username: token.username as string },
          });

          if (dbUser) {
            console.log(
              `[JWT] Found user by username, updating token with new ID: ${dbUser.id}`
            );
          }
        }

        // If user still not found, invalidate token
        if (!dbUser) {
          console.warn(
            `[JWT] User not found in database (ID: ${token.id}, username: ${token.username}), invalidating session`
          );
          return {}; // Return empty token to invalidate session
        }

        // Update token with latest user data from database
        token.id = dbUser.id;
        token.email = dbUser.email;
        token.username = dbUser.username;
        token.roleCode = dbUser.role; // Langsung pakai enum Role

        // Update assigned gas station for staff
        if (!["ADMINISTRATOR", "OWNER", "DEVELOPER"].includes(dbUser.role)) {
          const assignment = await prisma.userGasStation.findFirst({
            where: { userId: dbUser.id, status: "ACTIVE" },
            select: { gasStationId: true },
          });
          token.assignedGasStationId = assignment?.gasStationId;
        }
      }

      // Update session
      if (trigger === "update" && session) {
        token = { ...token, ...session };
      }

      return token;
    },
    async session({ session, token }) {
      // If token is empty (user invalidated), return null session
      if (!token || !token.id) {
        return { ...session, user: null } as any;
      }

      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.roleCode = token.roleCode as string; // Langsung enum Role
        session.user.assignedGasStationId = token.assignedGasStationId as
          | string
          | undefined;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allow relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allow callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({
            username: z.string().min(3),
            password: z.string().min(6),
          })
          .safeParse(credentials);

        if (!parsedCredentials.success) return null;

        const { username, password } = parsedCredentials.data;

        // Get user
        const user = await prisma.user.findUnique({
          where: { username },
          include: {
            profile: true,
          },
        });

        if (!user) return null;

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) return null;

        // Return user data
        return {
          id: user.id,
          email: user.email,
          username: user.username,
          roleCode: user.role, // Langsung enum Role
        };
      },
    }),
  ],
} satisfies NextAuthConfig;
