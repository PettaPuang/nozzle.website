"use client";

import { useEffect, useRef, useState } from "react";
import { IphoneMockup } from "./iphone-mockup";
import { IpadMockup } from "./ipad-mockup";
import { gsap } from "gsap";

type MockupType = "welcome" | "station" | "chart" | "tank";

type MockupHorizontalProps = {
  className?: string;
  containerClassName?: string;
  animationDuration?: number;
  gap?: number;
  mockupCount?: number;
  mockupWidth?: number;
};

export function MockupHorizontal({
  className = "",
  containerClassName = "",
  animationDuration = 20,
  gap = 100,
  mockupCount = 8,
  mockupWidth = 500,
}: MockupHorizontalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<gsap.core.Animation | null>(null);
  const [clickedIndex, setClickedIndex] = useState<number | null>(null);
  const mockupRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ipadRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!trackRef.current || !containerRef.current) return;

    const startAnimation = () => {
      const track = trackRef.current;
      const container = containerRef.current;
      if (!track || !container) return;

      // Tunggu sampai mockup ter-render
      const mockupWrappers = Array.from(track.children) as HTMLElement[];
      if (mockupWrappers.length === 0) {
        setTimeout(startAnimation, 100);
        return;
      }

      const firstMockup = mockupWrappers[0];
      const actualMockupWidth = firstMockup.offsetWidth || mockupWidth;

      // Jarak untuk 1 set mockup (4 mockup unik)
      const oneSetDistance = 4 * (actualMockupWidth + gap);

      // Kill animasi sebelumnya jika ada
      if (animationRef.current) {
        animationRef.current.kill();
      }

      // Reset posisi awal
      gsap.set(track, { x: 0, force3D: true });

      // Animasi seamless: karena kita punya 2 set identik (8 mockup total),
      // bergerak sepanjang 1 set (4 mockup pertama), lalu loop
      animationRef.current = gsap.to(track, {
        x: -oneSetDistance,
        duration: animationDuration,
        ease: "none",
        repeat: -1,
        force3D: true,
      });
    };

    // Initial setup
    setTimeout(startAnimation, 300);

    return () => {
      if (animationRef.current) {
        animationRef.current.kill();
      }
      if (trackRef.current) {
        gsap.killTweensOf(trackRef.current);
      }
    };
  }, [animationDuration, gap, mockupWidth]);

  // Handle click untuk pause animasi dan scale mockup
  useEffect(() => {
    if (clickedIndex === null) {
      // Resume animasi dengan time scale normal
      if (animationRef.current && animationRef.current.paused()) {
        animationRef.current.play();
      }
      // Reset semua scale
      mockupRefs.current.forEach((ref) => {
        if (ref) {
          gsap.to(ref, {
            scale: 1,
            duration: 0.3,
            ease: "power2.out",
            force3D: true,
          });
        }
      });
      return;
    }

    // Pause animasi saat click - pastikan pause, bukan kill
    if (animationRef.current && !animationRef.current.paused()) {
      animationRef.current.pause();
    }

    // Scale mockup yang di-click
    const mockupWrapper = mockupRefs.current[clickedIndex];
    if (mockupWrapper) {
      gsap.to(mockupWrapper, {
        scale: 1.6,
        duration: 0.4,
        ease: "power2.out",
        force3D: true,
      });
    }

    // Buat iPad flat (hilangkan efek 3D)
    const ipadWrapper = ipadRefs.current[clickedIndex];
    if (ipadWrapper) {
      setTimeout(() => {
        const ipadElement = ipadWrapper.querySelector(
          '[style*="rotateY"]'
        ) as HTMLElement;
        if (ipadElement) {
          ipadElement.style.transform = "none";
        }
        const hiddenElements = ipadWrapper.querySelectorAll(".hidden");
        hiddenElements.forEach((el) => {
          (el as HTMLElement).classList.remove("hidden");
          (el as HTMLElement).style.display = "block";
        });
      }, 50);
    }
  }, [clickedIndex]);

  // Fixed 8 mockups: welcome, station, chart, tank, welcome, station, chart, tank
  const mockupTypes: MockupType[] = [
    "welcome",
    "station",
    "chart",
    "tank",
    "welcome",
    "station",
    "chart",
    "tank",
  ];

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${containerClassName}`}
      style={{
        overflow: clickedIndex === null ? "hidden" : "visible",
      }}
    >
      {/* Track animasi mockup iPhone */}
      <div
        ref={trackRef}
        className={`absolute flex items-center h-full ${className}`}
        style={{
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          willChange: "transform",
          gap: `${gap}px`,
        }}
      >
        {/* 8 mockups dengan urutan tetap: welcome, station, chart, tank, welcome, station, chart, tank */}
        {mockupTypes.map((type, index) => {
          const isClicked = clickedIndex === index;

          return (
            <div
              key={`mockup-${type}-${index}`}
              ref={(el) => {
                mockupRefs.current[index] = el;
              }}
              className="shrink-0 flex items-center justify-center cursor-pointer transition-transform"
              style={{
                width: `${mockupWidth}px`,
                height: "100%",
                transformOrigin: "center center",
                zIndex: isClicked ? 50 : 1,
                position: "relative",
                filter: isClicked
                  ? "drop-shadow(0 20px 40px rgba(0, 0, 0, 0.3))"
                  : "none",
                transition: "filter 0.4s ease",
              }}
              onClick={() => {
                // Toggle: jika sudah diklik, reset. Jika belum, set clicked
                setClickedIndex(isClicked ? null : index);
              }}
            >
              {isClicked ? (
                <div
                  ref={(el) => {
                    ipadRefs.current[index] = el;
                  }}
                  className="relative block w-full"
                  style={{
                    maxWidth: "min(1400px, 100%)",
                  }}
                >
                  <IpadMockup type={type} />
                </div>
              ) : (
                <IphoneMockup type={type} flat={false} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
