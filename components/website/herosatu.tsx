"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { MockupHorizontal } from "./mockup/mockup-horizontal";
import ColorBends from "@/components/ui/reactbits/ColorBends";
import BlurText from "@/components/ui/reactbits/BlurText";
import { PERTAMINA_COLORS, PRODUCT_COLORS } from "@/lib/utils/product-colors";

export default function HeroSatu() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* ColorBends Background */}
      <div className="absolute inset-0 z-0 pointer-events-auto">
        <ColorBends
          colors={[
            PERTAMINA_COLORS.blue,
            PERTAMINA_COLORS.red,
            "#22C55E", // Hijau medium yang lebih seimbang
          ]}
          rotation={45}
          speed={0.3}
          scale={1.2}
          frequency={2}
          warpStrength={1.2}
          mouseInfluence={0.8}
          parallax={0.2}
          noise={0.05}
          transparent
          className="w-full h-full"
        />
      </div>

      <div
        className="relative w-screen overflow-hidden z-10 pointer-events-none"
        style={{
          marginLeft: "calc(-50vw + 50%)",
          marginRight: "calc(-50vw + 50%)",
          height: "100vh",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 flex flex-col items-center justify-center gap-3 md:gap-4 lg:gap-6 pointer-events-none"
          style={{
            paddingTop: "clamp(6rem, 12vh, 10rem)",
            paddingBottom: "clamp(1rem, 2vh, 2rem)",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <Image
              src="/logo/Nozzl.svg"
              alt="Nozzl Logo"
              width={200}
              height={75}
              className="h-6 w-auto sm:h-8 md:h-10 lg:h-12"
              priority
            />
          </motion.div>
          <div
            style={{
              fontSize: "clamp(1.5rem, 4vw, 5rem)",
              marginTop: "clamp(0.25rem, 1vh, 1rem)",
            }}
          >
            <BlurText
              text="Your System Evolve"
              className="font-boldonse font-normal text-gray-900 dark:text-white leading-[1.1] tracking-tight px-4 text-center"
              animateBy="words"
              direction="top"
              delay={200}
              stepDuration={0.3}
              threshold={0.1}
            />
          </div>
        </div>

        <motion.div
          className="absolute left-0 right-0 pointer-events-auto"
          style={{
            top: "clamp(40%, 42vh, 45%)",
            height: "clamp(30%, 35vh, 35%)",
            maxHeight: "400px",
          }}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
        >
          <MockupHorizontal
            containerClassName="h-full"
            animationDuration={20}
            gap={100}
            mockupCount={12}
            mockupWidth={350}
          />
        </motion.div>

        <div
          className="absolute left-0 right-0 flex items-center justify-center pointer-events-none px-4"
          style={{
            top: "clamp(75%, 78vh, 80%)",
            bottom: "clamp(2rem, 4vh, 4rem)",
          }}
        >
          <div
            style={{
              fontSize: "clamp(1rem, 3vw, 3rem)", // Mobile: 16px, Desktop: 48px
            }}
          >
            <BlurText
              text="SPBU Management System"
              className="font-medium text-gray-700 dark:text-gray-300 text-center"
              animateBy="words"
              direction="bottom"
              delay={150}
              stepDuration={0.25}
              threshold={0.1}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
