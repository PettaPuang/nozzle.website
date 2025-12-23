"use client";

import { motion } from "framer-motion";

type IphoneLandscapeMockupProps = {
  children?: React.ReactNode;
  className?: string;
};

export function IphoneLandscapeMockup({
  children,
  className = "",
}: IphoneLandscapeMockupProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0 }}
      className={`relative ${className}`}
    >
      <div
        className="relative w-full max-w-[900px] mx-auto"
        style={{ perspective: "2500px" }}
      >
        {/* iPhone Frame - Landscape - Modern Realistic Design dengan kemiringan statis */}
        <div
          className="relative z-10"
          style={{
            transform:
              "translateX(70px) rotateX(3deg) rotateY(-2deg) rotateZ(2deg)",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Outer Frame dengan shadow dan gradient realistis */}
          <div
            className="relative bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-black dark:via-gray-900 dark:to-black rounded-[3rem] lg:rounded-[3.5rem] p-1.5 md:p-2"
            style={{
              boxShadow: `
                0 25px 50px -12px rgba(0, 0, 0, 0.5),
                0 0 0 1px rgba(255, 255, 255, 0.1) inset,
                0 2px 4px rgba(0, 0, 0, 0.3) inset,
                0 50px 100px -20px rgba(0, 0, 0, 0.4)
              `,
            }}
          >
            {/* Screen Bezel */}
            <div className="relative bg-black rounded-[2.5rem] lg:rounded-[3rem] p-1">
              {/* Dynamic Island - positioned at left side in landscape */}
              <div
                className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 w-5 md:w-7 h-24 md:h-32 bg-black rounded-full z-20"
                style={{
                  boxShadow: "inset 0 0 12px rgba(0, 0, 0, 0.8)",
                }}
              >
                {/* Camera & Sensors */}
                <div className="absolute left-1/2 top-6 -translate-x-1/2 w-2 h-2 bg-gray-900 rounded-full border border-gray-700" />
                <div className="absolute left-1/2 bottom-6 -translate-x-1/2 w-1.5 h-1.5 bg-gray-900 rounded-full" />
              </div>

              {/* Screen Content */}
              <div
                className="relative bg-white dark:bg-gray-950 rounded-[2.25rem] lg:rounded-[2.75rem] overflow-hidden"
                style={{
                  aspectRatio: "2.16 / 1", // iPhone 14 Pro landscape ratio
                  boxShadow: "inset 0 0 30px rgba(0, 0, 0, 0.05)",
                }}
              >
                {/* Realistic Screen Glass Effect */}
                <div className="absolute inset-0 pointer-events-none z-20">
                  {/* Top reflection */}
                  <div className="absolute top-0 left-0 right-0 h-1/3 bg-linear-to-b from-white/10 via-white/5 to-transparent rounded-t-[2.25rem]" />
                  {/* Side light */}
                  <div className="absolute top-0 left-0 w-1/4 h-full bg-linear-to-r from-white/5 to-transparent" />
                  {/* Corner glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-white/5 to-transparent rounded-full blur-2xl" />
                </div>

                {/* Content Area */}
                <div className="absolute inset-0 overflow-hidden">
                  {children || (
                    <div className="h-full w-full flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
                      <div className="text-center space-y-4 p-8">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            delay: 0.6,
                            type: "spring",
                            stiffness: 200,
                          }}
                          className="w-20 h-20 mx-auto bg-linear-to-br from-[#006FB8] to-[#005A8C] rounded-2xl flex items-center justify-center shadow-xl"
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
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Frame Highlights - untuk efek realistis */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-linear-to-b from-white/5 to-transparent rounded-t-[3rem] pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-linear-to-t from-black/10 to-transparent rounded-b-[3rem] pointer-events-none" />

            {/* Volume buttons - horizontal di bawah frame, sisi kiri */}
            <div className="absolute left-[12%] bottom-0 w-12 h-0.5 bg-linear-to-r from-gray-600 to-gray-700 rounded-b-sm" />
            <div className="absolute left-[12%] bottom-0 w-10 h-0.5 bg-linear-to-r from-gray-600 to-gray-700 rounded-b-sm translate-x-[52px]" />
          </div>

          {/* Enhanced 3D Shadow Effect - mengikuti kemiringan iPhone */}
          <div
            className="absolute inset-0 rounded-[3rem] pointer-events-none -z-10"
            style={{
              background:
                "radial-gradient(ellipse 95% 65% at 58% 48%, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 40%, rgba(0, 0, 0, 0.1) 60%, transparent 75%)",
              transform:
                "translateY(35px) translateX(5px) scale(1.08) rotateZ(2deg)",
              filter: "blur(30px)",
            }}
          />

          {/* Subtle ambient light */}
          <div
            className="absolute inset-0 rounded-[3rem] pointer-events-none -z-20"
            style={{
              background:
                "radial-gradient(ellipse 100% 60% at 50% 40%, rgba(99, 102, 241, 0.1) 0%, transparent 60%)",
              transform: "translateY(-10px) scale(1.1)",
              filter: "blur(30px)",
            }}
          />
        </div>

        {/* Floating particles effect (optional - for premium look) */}
        <div className="absolute inset-0 pointer-events-none -z-30">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-blue-400/20 rounded-full"
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + (i % 3) * 20}%`,
              }}
              animate={{
                y: [-10, 10, -10],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
