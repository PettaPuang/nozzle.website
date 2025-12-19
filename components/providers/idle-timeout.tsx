"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

const IDLE_TIMEOUT = 60 * 60 * 1000; // 60 menit dalam milliseconds

export function IdleTimeout() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const eventsRef = useRef<Array<() => void>>([]);
  const sessionRef = useRef(session);
  const isLoggingOutRef = useRef(false);

  // Update session ref ketika session berubah
  useEffect(() => {
    sessionRef.current = session;
    // Reset logging out flag jika session berubah (misalnya setelah logout)
    if (!session) {
      isLoggingOutRef.current = false;
    }
  }, [session]);

  useEffect(() => {
    // Skip idle timeout jika:
    // 1. Di halaman login
    // 2. Session belum loaded (masih loading)
    // 3. Status unauthenticated (belum login)
    // 4. Tidak ada session atau user
    // 5. Sedang dalam proses logout
    const shouldSkip =
      pathname === "/login" ||
      status === "loading" ||
      status === "unauthenticated" ||
      !session ||
      !session.user ||
      isLoggingOutRef.current;

    if (shouldSkip) {
      // Cleanup jika ada timeout yang masih berjalan
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // Cleanup event listeners jika ada
      eventsRef.current.forEach((cleanup) => cleanup());
      eventsRef.current = [];
      return;
    }

    const handleIdleTimeout = async () => {
      // Double check session masih ada sebelum logout
      const currentSession = sessionRef.current;
      if (!currentSession || !currentSession.user || isLoggingOutRef.current) {
        return;
      }

      // Set flag untuk mencegah multiple logout calls
      isLoggingOutRef.current = true;

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Cleanup event listeners
      eventsRef.current.forEach((cleanup) => cleanup());
      eventsRef.current = [];

      try {
        // Logout user dan redirect ke login
        await signOut({ 
          callbackUrl: "/login",
          redirect: true 
        });
      } catch (error) {
        console.error("[IdleTimeout] Error during logout:", error);
        // Fallback: redirect manual jika signOut gagal
        router.push("/login");
      }
    };

    const resetTimeout = () => {
      // Check session dari ref (selalu up-to-date)
      const currentSession = sessionRef.current;
      if (!currentSession || !currentSession.user || isLoggingOutRef.current) {
        return;
      }

      // Update last activity time
      lastActivityRef.current = Date.now();
      
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout - akan trigger setelah IDLE_TIMEOUT tanpa aktivitas
      timeoutRef.current = setTimeout(() => {
        handleIdleTimeout();
      }, IDLE_TIMEOUT);
    };

    // Track user activity events
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "focus",
    ];

    // Initialize last activity time saat pertama kali mount
    lastActivityRef.current = Date.now();

    // Initial timeout setup
    resetTimeout();

    // Add event listeners dan simpan cleanup functions
    const cleanupFunctions: Array<() => void> = [];
    events.forEach((event) => {
      document.addEventListener(event, resetTimeout, { passive: true, capture: true });
      cleanupFunctions.push(() => {
        document.removeEventListener(event, resetTimeout, { capture: true });
      });
    });
    eventsRef.current = cleanupFunctions;

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      cleanupFunctions.forEach((cleanup) => cleanup());
      eventsRef.current = [];
    };
  }, [session, status, pathname, router]);

  return null;
}

