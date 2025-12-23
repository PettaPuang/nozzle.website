"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navigation = [
  { name: "Beranda", href: "/" },
  { name: "Fitur", href: "/features" },
  { name: "Tutorial", href: "/tutorial" },
  { name: "Demo", href: "/demo/welcome" },
];

export function WebsiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Top">
        <div className="flex w-full items-center justify-between py-4">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo/NozzlLogomark.svg"
                alt="Nozzl"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <Image
                src="/logo/Nozzl.svg"
                alt="Nozzl"
                width={100}
                height={30}
                className="h-6 w-auto hidden sm:block"
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-[#006FB8] dark:hover:text-[#006FB8] transition-colors"
              >
                {item.name}
              </Link>
            ))}
            <Link href="/demo/welcome">
              <Button
                size="sm"
                className="bg-[#006FB8] hover:bg-[#005A8C] text-white"
              >
                Coba Demo
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-300 hover:text-[#006FB8] dark:hover:text-[#006FB8] hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <Link href="/demo/welcome" className="block mt-2">
              <Button
                size="sm"
                className="w-full bg-[#006FB8] hover:bg-[#005A8C] text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                Coba Demo
              </Button>
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
