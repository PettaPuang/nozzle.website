"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingPageProps = {
  /**
   * Variant loading:
   * - "full": Full page loading (centered, takes full viewport)
   * - "inline": Inline loading (centered in container)
   * - "minimal": Minimal loading (just spinner, no text)
   */
  variant?: "full" | "inline" | "minimal";
  /**
   * Size of the spinner
   */
  size?: "sm" | "md" | "lg";
  /**
   * Custom className
   */
  className?: string;
};

/**
 * Reusable Loading Page Component
 *
 * Usage:
 * - Full page: <LoadingPage variant="full" />
 * - Inline: <LoadingPage variant="inline" />
 * - Minimal: <LoadingPage variant="minimal" />
 */
export function LoadingPage({
  variant = "full",
  size = "md",
  className,
}: LoadingPageProps) {
  const sizeClasses = {
    sm: "h-[50vh] w-[50vh]",
    md: "h-[100vh] w-[100vh]",
    lg: "h-[100vh] w-[100vh]",
  };

  const spinner = (
    <Image
      src="/picture/Nozzl.gif"
      alt="Loading..."
      width={1024}
      height={1024}
      className={cn("object-contain", sizeClasses[size], className)}
      unoptimized
    />
  );

  if (variant === "minimal") {
    return spinner;
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center py-4 lg:py-8">
        {spinner}
      </div>
    );
  }

  // Full page variant (default)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent">
      {spinner}
    </div>
  );
}

/**
 * Loading Skeleton Component for inline use
 * Useful for showing loading state in cards/tables
 */
type LoadingSkeletonProps = {
  /**
   * Number of skeleton rows to show
   */
  rows?: number;
  /**
   * Custom className
   */
  className?: string;
};

export function LoadingSkeleton({ rows = 3, className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-2 lg:space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 lg:h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
        />
      ))}
    </div>
  );
}

/**
 * Loading Spinner Component (simple wrapper)
 */
type LoadingSpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function LoadingSpinner({
  size = "md",
  className,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6 lg:h-8 lg:w-8",
    lg: "h-8 w-8 lg:h-12 lg:w-12",
  };

  return (
    <Loader2
      className={cn(
        "animate-spin text-muted-foreground",
        sizeClasses[size],
        className
      )}
    />
  );
}
