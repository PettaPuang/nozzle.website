"use client";

import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register ScrollTrigger plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface StickyScrollVideoProps {
  videoSrc: string;
  scrollHeight?: string;
  className?: string;
}

export function StickyScrollVideo({
  videoSrc,
  scrollHeight = "500vh",
  className = "",
}: StickyScrollVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [hasError, setHasError] = useState(false);

  // Load video metadata
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const duration = video.duration;
      if (duration && !isNaN(duration) && isFinite(duration)) {
        console.log("Video loaded, duration:", duration);
        setIsVideoLoaded(true);
        setVideoDuration(duration);
        video.pause();
        video.currentTime = 0;
      }
    };

    const handleError = (e: Event) => {
      console.error("Video loading error:", e);
      setHasError(true);
    };

    // Prevent autoplay
    video.pause();
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("error", handleError);
    video.addEventListener("play", () => video.pause());
    video.load();

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleError);
    };
  }, [videoSrc]);

  // GSAP ScrollTrigger untuk kontrol video
  useEffect(() => {
    if (!isVideoLoaded || videoDuration === 0) return;

    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    // Buat objek untuk di-animate oleh GSAP
    const videoProgress = { currentTime: 0 };

    // Setup GSAP animation dengan ScrollTrigger
    gsap.to(videoProgress, {
      currentTime: videoDuration,
      ease: "none",
      scrollTrigger: {
        trigger: container,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.5,
        markers: false, // Set true untuk debugging
        onUpdate: (self) => {
          // Update video time berdasarkan progress GSAP
          const targetTime = videoDuration * self.progress;
          
          if (Math.abs(video.currentTime - targetTime) > 0.1) {
            video.pause();
            try {
              video.currentTime = targetTime;
            } catch (e) {
              console.error("Error updating video time:", e);
            }
          }
        },
      },
    });

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, [isVideoLoaded, videoDuration]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ height: scrollHeight }}
    >
      {/* Sticky container */}
      <div className="sticky top-0 left-0 w-full h-screen overflow-hidden bg-black">
        {hasError ? (
          <div className="w-full h-full flex items-center justify-center text-white">
            <div className="text-center">
              <p className="text-xl mb-2">Video tidak dapat dimuat</p>
              <p className="text-sm text-gray-400">{videoSrc}</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full relative">
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="auto"
              autoPlay={false}
              loop={false}
              style={{ display: "block" }}
            />
            {!isVideoLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black text-white z-10">
                <p>Loading video...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
