import Image from "next/image";
import { MockupShowcase } from "./mockup/mockup-showcase";

export default function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-br from-white via-gray-50 to-blue-50 dark:from-gray-100 dark:to-slate-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12 lg:items-center">
          {/* Content - di atas di mobile, di kiri di desktop */}
          <div className="flex-1 w-full lg:max-w-xl space-y-6 lg:space-y-8 order-1 lg:order-1">
            <div className="space-y-4 lg:space-y-6">
              <Image
                src="/logo/Nozzl.svg"
                alt="Nozzl Logo"
                width={200}
                height={75}
                className="mb-4"
                priority
              />
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 leading-tight">
                Your System Evolve
              </h1>
              <p className="text-lg sm:text-xl lg:text-2xl text-gray-700 leading-relaxed max-w-2xl">
                Aplikasi sistem manajemen proses bisnis SPBU, operasional,
                keuangan, dan pelaporan yang terintegrasi.
              </p>
            </div>
          </div>

          {/* Mockup - di bawah di mobile, di kanan di desktop */}
          <div className="flex-1 w-full lg:shrink-0 lg:max-w-2xl overflow-visible order-2 lg:order-2">
            <MockupShowcase />
          </div>
        </div>
      </div>
    </section>
  );
}
