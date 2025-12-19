"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export function LandscapeOrientationWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const { data: session, status } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    // Jangan tampilkan warning jika belum login atau sedang di halaman login
    const isLoggedIn = status === "authenticated" && !!session;
    const isLoginPage = pathname === "/login";

    if (!isLoggedIn || isLoginPage) {
      setShowWarning(false);
      return;
    }

    const checkOrientation = () => {
      if (typeof window === "undefined") return;

      const isPortrait = window.innerHeight > window.innerWidth;
      const isMobile = window.innerWidth <= 1024;

      setShowWarning(isPortrait && isMobile);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, [session, status, pathname]);

  if (!showWarning) return null;

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center p-6"
      style={{ zIndex: 9999 }}
    >
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="phone-rotate-animation-small">
            <div className="phone-frame-small">
              <div className="phone-screen-small"></div>
            </div>
          </div>
        </div>
        <p className="text-white text-sm font-medium">
          Putar perangkat ke mode landscape
        </p>
      </div>
    </div>
  );
}
