"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";

const DEMO_USERNAME = "Mr. Nozel Demo";
const DEMO_PASSWORD = "NozelDemo123";

export function DemoAutoLogin() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const performAutoLogin = async () => {
      try {
        const result = await signIn("credentials", {
          username: DEMO_USERNAME,
          password: DEMO_PASSWORD,
          redirect: false,
        });

        if (result?.error) {
          setStatus("error");
          setErrorMessage("Gagal masuk ke demo experience. Silakan coba lagi.");
          return;
        }

        if (result?.ok) {
          // Redirect ke welcome page
          router.push("/welcome");
          router.refresh();
        } else {
          setStatus("error");
          setErrorMessage("Login gagal. Silakan coba lagi.");
        }
      } catch (error) {
        setStatus("error");
        setErrorMessage("Terjadi kesalahan. Silakan coba lagi.");
      }
    };

    performAutoLogin();
  }, [router]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md text-center space-y-8">
        {/* Logo Section */}
        <div className="flex flex-col items-center space-y-4">
          <Image
            src="/logo/NozzlLogomark.svg"
            alt="Nozzl"
            width={300}
            height={100}
            priority
            className="w-auto h-auto max-w-[200px] md:max-w-[300px]"
          />
          <div className="flex items-center justify-center gap-2">
            <Image
              src="/logo/Nozzl.svg"
              alt="Nozzl"
              width={200}
              height={75}
              priority
              className="w-auto h-auto max-w-[100px] md:max-w-[160px]"
            />
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 italic">
              Your System Evolve
            </p>
          </div>
        </div>

        {/* Loading or Error State */}
        {status === "loading" ? (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-[#006FB8]" />
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
              Memuat demo experience...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
              {errorMessage}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#006FB8] hover:bg-[#005A8C] text-white rounded-md text-sm font-medium transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

