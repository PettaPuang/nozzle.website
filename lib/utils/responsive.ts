"use client";

import { useState, useEffect } from "react";

/**
 * Device type detection
 */
export type DeviceType = "mobile" | "tablet" | "desktop";

/**
 * Orientation type
 */
export type OrientationType = "portrait" | "landscape";

/**
 * Hook to detect device type based on screen width
 * @returns DeviceType - "mobile" | "tablet" | "desktop"
 */
export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop");

  useEffect(() => {
    const updateDeviceType = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDeviceType("mobile");
      } else if (width < 1024) {
        setDeviceType("tablet");
      } else {
        setDeviceType("desktop");
      }
    };

    updateDeviceType();
    window.addEventListener("resize", updateDeviceType);
    return () => window.removeEventListener("resize", updateDeviceType);
  }, []);

  return deviceType;
}

/**
 * Hook to detect screen orientation
 * @returns OrientationType - "portrait" | "landscape"
 */
export function useOrientation(): OrientationType {
  const [orientation, setOrientation] = useState<OrientationType>("landscape");

  useEffect(() => {
    const updateOrientation = () => {
      if (window.innerHeight > window.innerWidth) {
        setOrientation("portrait");
      } else {
        setOrientation("landscape");
      }
    };

    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);
    
    return () => {
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
    };
  }, []);

  return orientation;
}

/**
 * Hook to detect if device is mobile or tablet
 * @returns boolean - true if mobile or tablet
 */
export function useIsMobile(): boolean {
  const deviceType = useDeviceType();
  return deviceType === "mobile" || deviceType === "tablet";
}

/**
 * Hook to detect if device is in landscape mode
 * @returns boolean - true if landscape
 */
export function useIsLandscape(): boolean {
  const orientation = useOrientation();
  return orientation === "landscape";
}

/**
 * Hook to get combined device and orientation info
 * @returns Object with deviceType, orientation, isMobile, isLandscape
 */
export function useResponsive() {
  const deviceType = useDeviceType();
  const orientation = useOrientation();
  const isMobile = deviceType === "mobile" || deviceType === "tablet";
  const isLandscape = orientation === "landscape";

  return {
    deviceType,
    orientation,
    isMobile,
    isLandscape,
    isMobileLandscape: isMobile && isLandscape,
    isTabletLandscape: deviceType === "tablet" && isLandscape,
  };
}

/**
 * Utility function to get device type synchronously (for SSR compatibility)
 * Should be used carefully as it may not be accurate on initial render
 */
export function getDeviceType(): DeviceType {
  if (typeof window === "undefined") return "desktop";
  
  const width = window.innerWidth;
  if (width < 768) {
    return "mobile";
  } else if (width < 1024) {
    return "tablet";
  } else {
    return "desktop";
  }
}

/**
 * Utility function to get orientation synchronously (for SSR compatibility)
 * Should be used carefully as it may not be accurate on initial render
 */
export function getOrientation(): OrientationType {
  if (typeof window === "undefined") return "landscape";
  
  return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
}

