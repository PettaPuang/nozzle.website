"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

type PreviewWrapperProps = {
  children: ReactNode;
  type: "iphone" | "ipad";
};

export function PreviewWrapper({ children, type }: PreviewWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Fixed scale untuk preview agar konsisten meskipun ukuran mockup diubah
    // iPad menggunakan skala lebih kecil karena ukurannya lebih besar
    const previewScale = type === "ipad" ? 0.25 : 0.35;
    setScale(previewScale);
  }, [type]);

  // Deteksi theme yang aktif (dark atau light)
  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark");

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden">
      <div
        className={`origin-top-left ${isDark ? "dark" : ""}`}
        style={{
          transform: `scale(${scale})`,
          width: `${100 / scale}%`,
          height: `${100 / scale}%`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
