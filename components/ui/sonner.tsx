"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="h-3 w-3 lg:h-4 lg:w-4" />,
        info: <InfoIcon className="h-3 w-3 lg:h-4 lg:w-4" />,
        warning: <TriangleAlertIcon className="h-3 w-3 lg:h-4 lg:w-4" />,
        error: <OctagonXIcon className="h-3 w-3 lg:h-4 lg:w-4" />,
        loading: <Loader2Icon className="h-3 w-3 lg:h-4 lg:w-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "text-xs lg:text-sm p-2 lg:p-3 gap-1.5 lg:gap-2",
          title: "text-xs lg:text-sm font-medium",
          description: "text-[10px] lg:text-xs",
          actionButton: "text-xs lg:text-sm h-6 lg:h-7 px-2 lg:px-3",
          cancelButton: "text-xs lg:text-sm h-6 lg:h-7 px-2 lg:px-3",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
