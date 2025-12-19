import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DemoAutoLogin } from "./demo-auto-login";

export const dynamic = "force-dynamic";

export default async function DemoExperiencePage() {
  let session;
  try {
    session = await auth();
  } catch (error) {
    // If auth fails, allow demo page
    console.error("[DemoExperiencePage] Auth error:", error);
  }

  // Jika sudah login, redirect ke dashboard
  if (session?.user) {
    redirect("/welcome");
  }

  // Langsung auto-login tanpa menampilkan form
  return <DemoAutoLogin />;
}

