"use client";

import { useEffect, useState } from "react";
import { LoadingPage } from "@/components/reusable/loading-page";

export default function LoginLoading() {
  const [showGif, setShowGif] = useState(false);

  useEffect(() => {
    // Tunggu sebentar agar loading page Next.js muncul dulu, baru GIF muncul
    const timer = setTimeout(() => {
      setShowGif(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (!showGif) {
    return null;
  }

  return <LoadingPage variant="full" />;
}

