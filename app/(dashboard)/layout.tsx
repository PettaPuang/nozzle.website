import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await auth();
  } catch (error) {
    // If auth fails (e.g., Prisma error), redirect to login
    console.error("[DashboardLayout] Auth error:", error);
    redirect("/login");
  }

  // Redirect to login if not authenticated
  // This protects all routes under (dashboard) folder
  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}

