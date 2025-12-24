"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navigation = [
  { name: "Beranda", href: "/" },
  { name: "Fitur", href: "/features" },
  { name: "Tutorial", href: "/tutorial" },
  { name: "Demo", href: "/demo/welcome" },
];

export function WebsiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Top">
        <div className="flex w-full items-center justify-end py-4">
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="focus:outline-none"
              aria-label="Toggle menu"
            >
              <Image
                src="/logo/NozzlLogomark.svg"
                alt="Nozzl"
                width={32}
                height={32}
                className="h-8 w-8"
              />
            </button>

            {/* Horizontal Menu */}
            {menuOpen && (
              <div className="absolute top-1/2 -translate-y-1/2 right-full mr-4 flex items-center gap-4 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 px-6 py-3">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-[#006FB8] dark:hover:text-[#006FB8] whitespace-nowrap"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
                <Link href="/demo/welcome" onClick={() => setMenuOpen(false)}>
                  <Button
                    size="sm"
                    className="bg-[#006FB8] hover:bg-[#005A8C] text-white whitespace-nowrap"
                  >
                    Coba Demo
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
