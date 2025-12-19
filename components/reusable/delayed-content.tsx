"use client";

import { useEffect, useState } from "react";
import { LoadingPage } from "@/components/reusable/loading-page";

type DelayedContentProps = {
  children: React.ReactNode;
  delay?: number; // Delay dalam milliseconds, default 3000ms (3 detik)
};

/**
 * Component yang menampilkan loading GIF selama delay tertentu sebelum menampilkan children
 */
export function DelayedContent({
  children,
  delay = 3000,
}: DelayedContentProps) {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  if (!showContent) {
    return <LoadingPage variant="full" />;
  }

  return <>{children}</>;
}
