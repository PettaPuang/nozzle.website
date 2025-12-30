"use client";

import { useRef, useEffect, useState } from "react";
import { useScroll, useMotionValueEvent } from "framer-motion";

interface ScrollVideoProps {
  videoSrc: string;
  className?: string;
  scrollHeight?: string;
}

export function ScrollVideo({
  videoSrc,
  className = "",
  scrollHeight = "500vh",
}: ScrollVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [hasError, setHasError] = useState(false);

  // Scroll progress dengan offset yang lebih baik
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Opacity tetap 1 sepanjang scroll (tidak fade out) - langsung return 1
  // Tidak perlu transform karena selalu 1

  // Update video time menggunakan useMotionValueEvent untuk update yang lebih reliable
  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const video = videoRef.current;
    if (!video || !isVideoLoaded || videoDuration === 0) return;

    // Clamp progress antara 0 dan 1
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const targetTime = videoDuration * clampedProgress;

    // Update video time langsung tanpa threshold untuk kontrol yang lebih presisi
    try {
      video.currentTime = targetTime;
    } catch (e) {
      // Ignore error jika video belum siap
    }
  });

  // Backup: requestAnimationFrame loop untuk memastikan video selalu sync
  useEffect(() => {
    if (!isVideoLoaded || videoDuration === 0) return;

    let animationFrame: number;
    const video = videoRef.current;

    const updateVideo = () => {
      if (!video) return;

      const progress = scrollYProgress.get();
      const clampedProgress = Math.max(0, Math.min(1, progress));
      const targetTime = videoDuration * clampedProgress;

      if (Math.abs(video.currentTime - targetTime) > 0.1) {
        try {
          video.currentTime = targetTime;
        } catch (e) {
          // Ignore
        }
      }

      animationFrame = requestAnimationFrame(updateVideo);
    };

    animationFrame = requestAnimationFrame(updateVideo);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [scrollYProgress, isVideoLoaded, videoDuration]);

  // Load video metadata dan setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const duration = video.duration;
      if (duration && !isNaN(duration) && isFinite(duration)) {
        setIsVideoLoaded(true);
        setVideoDuration(duration);
        // Set initial time
        video.currentTime = 0;
      }
    };

    const handleLoadedData = () => {
      // Pastikan video frame pertama ter-render
      video.currentTime = 0;
    };

    const handleCanPlay = () => {
      // Video siap untuk playback
      if (video.readyState >= 2) {
        video.currentTime = 0;
      }
    };

    const handleError = (e: Event) => {
      console.error("Video loading error:", e);
      setHasError(true);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);

    // Force load video
    video.load();

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
    };
  }, [videoSrc]);

  return (
    <div ref={containerRef} className={`relative ${scrollHeight} ${className}`}>
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
              style={{ display: "block", opacity: 1 }}
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
