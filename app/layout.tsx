import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import "./globals.css";

// Plus Jakarta Sans - ExtraLight (200) sebagai default
const plusJakartaSans = localFont({
  src: [
    {
      path: "../public/fonts/PlusJakartaSans-ExtraLight.ttf",
      weight: "200",
      style: "normal",
    },
    {
      path: "../public/fonts/PlusJakartaSans-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/PlusJakartaSans-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/PlusJakartaSans-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/PlusJakartaSans-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/PlusJakartaSans-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/PlusJakartaSans-ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-jakarta",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Inter untuk hero dan display text (menggunakan Inter sebagai display font)
const interDisplay = Inter({
  subsets: ["latin"],
  variable: "--font-inter-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Boldonse untuk hero heading
const boldonse = localFont({
  src: [
    {
      path: "../public/fonts/Boldonse-Regular.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-boldonse",
  display: "swap",
  fallback: ["var(--font-inter-display)", "sans-serif"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const ogImageUrl = `${appUrl}/logo/icon-512.png`;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Nozzl - Your System Evolve",
    template: "%s | Nozzl",
  },
  description:
    "Evolusi Operasional SPBU Independen - SPBU Management System berbasis web untuk operasional, keuangan, dan pelaporan yang terintegrasi",
  keywords: [
    "SPBU",
    "Gas Station",
    "Management System",
    "Operational",
    "Financial",
    "Reporting",
  ],
  authors: [{ name: "Armanda Teruna" }],
  creator: "Armanda Teruna",
  publisher: "cnnct",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Nozzl",
    title: "Nozzl - Your System Evolve",
    description: "Evolusi Operasional SPBU Independen",
    url: appUrl,
    images: [
      {
        url: ogImageUrl, // Absolute URL untuk Open Graph (WhatsApp, Facebook, dll)
        width: 512,
        height: 512,
        alt: "Nozzl Logo",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nozzl - Your System Evolve",
    description: "Evolusi Operasional SPBU Independen",
    images: [ogImageUrl], // Absolute URL untuk Twitter Card
  },
  icons: {
    icon: [
      { url: "/logo/NozzlLogomark.svg", type: "image/svg+xml" },
      { url: "/logo/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/logo/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      {
        url: "/logo/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/logo/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/logo/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: "/logo/NozzlLogomark.svg",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning className="w-full">
      <body
        className={`${plusJakartaSans.variable} ${geistMono.variable} ${interDisplay.variable} ${boldonse.variable} antialiased font-sans font-extralight overflow-x-hidden w-full`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
