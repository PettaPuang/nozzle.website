"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

type PreviewWrapperProps = {
  children: ReactNode;
  type: "iphone" | "ipad";
};

export function PreviewWrapper({ children, type }: PreviewWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const containerWidth = container.offsetWidth;

      // Reference width untuk scale 1.0 (100%)
      // iPhone: 900px (landscape mockup)
      // iPad: 1400px (landscape mockup)
      const referenceWidth = type === "iphone" ? 900 : 1400;

      // Calculate scale berdasarkan container width
      // Min scale: 0.5 untuk iPhone, 0.4 untuk iPad
      // Max scale: 1.0
      const minScale = type === "iphone" ? 0.5 : 0.4;
      const calculatedScale = containerWidth / referenceWidth;
      const finalScale = Math.max(minScale, Math.min(1, calculatedScale));

      setScale(finalScale);
    };

    // Initial calculation
    updateScale();

    // Update on resize
    const resizeObserver = new ResizeObserver(updateScale);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [type]);

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden">
      <div
        className="origin-top-left"
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

