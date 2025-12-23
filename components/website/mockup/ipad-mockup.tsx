"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";

type IpadMockupProps = {
  useStaticImage?: boolean;
  staticImageUrl?: string;
  children?: React.ReactNode;
  className?: string;
};

export function IpadMockup({
  useStaticImage = false,
  staticImageUrl,
  children,
  className = "",
}: IpadMockupProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  // Jika menggunakan gambar static
  if (useStaticImage && staticImageUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0 }}
        className={`relative ${className}`}
      >
        <div className="relative w-full max-w-[1400px] lg:max-w-[1600px] mx-auto perspective-[2000px]">
          {/* iPad Container with 3D Transform */}
          <div
            className="relative"
            style={{
              transformStyle: "preserve-3d",
              transform: "rotateY(-15deg) rotateX(5deg)",
            }}
          >
            {/* iPad Front with Screen */}
            <div
              className="relative bg-linear-to-br from-gray-700 via-gray-600 to-gray-700 rounded-[3rem] p-1.5 md:p-2 lg:p-2.5"
              style={{
                boxShadow:
                  "0 10px 30px -5px rgba(0, 0, 0, 0.2), 0 4px 12px -2px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
                transformStyle: "preserve-3d",
              }}
            >
              {/* Screen Bezel (Black Border) */}
              <div className="relative bg-black rounded-[2.5rem] p-1.5 md:p-2 shadow-inner">
                {/* Screen Content */}
                <div
                  className="relative bg-white dark:bg-gray-900 rounded-4xl overflow-hidden"
                  style={{ aspectRatio: "2360 / 1640" }}
                >
                  <Image
                    src={staticImageUrl}
                    alt="App Preview"
                    fill
                    className="object-cover"
                    priority
                    onLoad={() => setIsLoaded(true)}
                  />
                  {!isLoaded && (
                    <div className="absolute inset-0 bg-linear-to-br from-blue-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 animate-pulse" />
                  )}

                  {/* Screen Glare Effect */}
                  <div className="absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
                </div>
              </div>

              {/* Reflection on Front Glass */}
              <div className="absolute inset-0 rounded-[3rem] bg-linear-to-br from-white/20 via-transparent to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Jika menggunakan children (live preview)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0 }}
      className={`relative ${className}`}
    >
      <div className="relative w-full max-w-[1400px] mx-auto perspective-[2000px]">
        {/* iPad Container with 3D Transform */}
        <div
          className="relative"
          style={{
            transformStyle: "preserve-3d",
            transform: "rotateY(-15deg) rotateX(5deg)",
          }}
        >
          {/* iPad Front with Screen */}
          <div
            className="relative bg-linear-to-br from-gray-700 via-gray-600 to-gray-700 rounded-[3rem] p-1.5 md:p-2 lg:p-2.5"
            style={{
              boxShadow:
                "0 10px 30px -5px rgba(0, 0, 0, 0.2), 0 4px 12px -2px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Screen Bezel (Black Border) */}
            <div className="relative bg-black rounded-[2.5rem] p-1.5 md:p-2 shadow-inner">
              {/* Screen Content */}
              <div
                className="relative bg-white dark:bg-gray-900 rounded-4xl overflow-hidden"
                style={{ aspectRatio: "2360 / 1640" }}
              >
                {/* Content */}
                <div className="absolute inset-0 overflow-hidden">
                  {children || (
                    <div className="h-full w-full flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800">
                      <div className="text-center space-y-4 p-8">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            delay: 0.6,
                            type: "spring",
                            stiffness: 200,
                          }}
                          className="w-20 h-20 mx-auto bg-linear-to-br from-[#006FB8] to-[#005A8C] rounded-2xl flex items-center justify-center shadow-lg"
                        >
                          <span className="text-3xl font-bold text-white">
                            N
                          </span>
                        </motion.div>
                        <motion.h2
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.8 }}
                          className="text-2xl font-bold text-gray-900 dark:text-white"
                        >
                          Welcome to Nozzl
                        </motion.h2>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1 }}
                          className="text-gray-600 dark:text-gray-400"
                        >
                          SPBU Management System
                        </motion.p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Screen Glare Effect */}
                <div className="absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>

            {/* Reflection on Front Glass */}
            <div className="absolute inset-0 rounded-[3rem] bg-linear-to-br from-white/20 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
