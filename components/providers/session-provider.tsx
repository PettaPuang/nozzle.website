"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { IdleTimeout } from "./idle-timeout";

export function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextAuthSessionProvider>
      <IdleTimeout />
      {children}
    </NextAuthSessionProvider>
  );
}

