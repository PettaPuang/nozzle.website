"use client";

import { SidebarProvider } from "./sidebar-context";

export function SidebarProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarProvider>{children}</SidebarProvider>;
}

