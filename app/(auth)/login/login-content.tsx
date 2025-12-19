"use client";

import { useState } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { PERTAMINA_COLORS } from "@/lib/utils/product-colors";

export function LoginContent() {
  const [showLogin, setShowLogin] = useState(false);

  if (showLogin) {
    return <LoginForm />;
  }

  return (
    <div className="w-full flex flex-col items-center justify-center space-y-8 md:space-y-12">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center gap-2 md:gap-3">
          <span className="font-bold text-gray-900 dark:text-white text-md lg:text-lg mr-3">
            Welcome to
          </span>
          <div className="flex items-center justify-center gap-1.5 md:gap-2">
            <Image
              src="/logo/Nozzl.svg"
              alt="Nozzl"
              width={200}
              height={75}
              priority
              className="w-auto h-auto max-w-[80px] md:max-w-[120px] lg:max-w-[160px]"
            />
            <p className="text-[10px] md:text-xs text-gray-600 italic">
              Your System Evolve
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs md:text-sm text-gray-500 dark:text-gray-400">
          SPBU Management System by <span className="font-bold">CNNCT</span>
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
        <div
          className="text-center p-3 border-2 rounded-lg"
          style={{
            borderColor: PERTAMINA_COLORS.blue,
            backgroundColor: `${PERTAMINA_COLORS.blue}15`,
          }}
        >
          <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white">
            Full Control Management
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Visibilitas penuh atas setiap liter dan rupiah
          </p>
        </div>

        <div
          className="text-center p-3 border-2 rounded-lg"
          style={{
            borderColor: PERTAMINA_COLORS.red,
            backgroundColor: `${PERTAMINA_COLORS.red}15`,
          }}
        >
          <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white">
            Reliable & Realtime Data
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Semua data dan transaksi tercatat realtime
          </p>
        </div>

        <div
          className="text-center p-3 border-2 rounded-lg"
          style={{
            borderColor: PERTAMINA_COLORS.green,
            backgroundColor: `${PERTAMINA_COLORS.green}15`,
          }}
        >
          <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white">
            Easy to Use
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Mudah diakses kapan saja & dimana saja
          </p>
        </div>
      </div>

      {/* CNNCT Branding & Login Button */}
      <div className="text-center mt-12 flex flex-col items-center">
        <p className="text-sm md:text-base font-bold ">CNNCT</p>
        <p className="text-[10px] md:text-xs text-gray-600 dark:text-gray-400">
          connect & control your business
        </p>
        <div className="flex justify-center mt-4">
          <Button
            onClick={() => setShowLogin(true)}
            className="bg-[#006FB8] hover:bg-[#005A8C] text-white px-4 py-2 text-sm md:text-base font-medium"
          >
            Click here to login
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
