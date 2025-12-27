"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect } from "react";

const navigation = [
  { name: "Beranda", href: "/" },
  { name: "Fitur", href: "/features" },
  { name: "Tutorial", href: "/tutorial" },
  { name: "Demo", href: "/demo/welcome" },
];

export function WebsiteHeader() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none w-full">
      <nav className="w-full pt-6 pb-4 flex justify-center" aria-label="Top">
        <div className="flex items-center gap-4 backdrop-blur-md rounded-full px-6 py-2 shadow-xl pointer-events-auto mx-4 sm:mx-6 lg:mx-8">
          {/* Navigation Links */}
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-[#006FB8] dark:hover:text-[#006FB8] whitespace-nowrap transition-colors"
            >
              {item.name}
            </Link>
          ))}

          {/* Coba Demo Button */}
          <Link href="/demo/welcome">
            <Button
              size="sm"
              className="bg-[#006FB8] hover:bg-[#005A8C] text-white whitespace-nowrap"
            >
              Coba Demo
            </Button>
          </Link>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg hover:bg-white/20 dark:hover:bg-white/10 transition-colors focus:outline-none"
            aria-label="Toggle theme"
          >
            {mounted ? (
              theme === "dark" ? (
                <Sun className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              ) : (
                <Moon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              )
            ) : (
              <Moon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            )}
          </button>
        </div>
      </nav>
    </header>
  );
}
