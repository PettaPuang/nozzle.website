"use client";

import { motion } from "framer-motion";
import { HoldingIpadMockup } from "./mockup/holding-ipad-mockup";

export function HoldingIpadSection() {
  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Preview Aplikasi
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Lihat bagaimana aplikasi Nozzl terlihat di perangkat tablet Anda
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex justify-center"
        >
          <HoldingIpadMockup 
            type="welcome" 
            maxWidth="2000px"
            screenInset={{
              top: "10%",
              right: "8%",
              bottom: "18%",
              left: "8%",
            }}
          />
        </motion.div>
      </div>
    </section>
  );
}
