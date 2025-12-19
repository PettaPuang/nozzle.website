import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Building2, ArrowLeft, AlertCircle } from "lucide-react";

export default function GasStationNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 relative overflow-hidden">
      {/* Background Logomark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
        <Image
          src="/logo/NozzlLogomark.svg"
          alt="Nozzl Logomark"
          width={400}
          height={400}
          className="w-full h-full max-w-[600px] max-h-[600px]"
          priority
        />
      </div>

      <div className="max-w-md w-full text-center space-y-6 relative z-10">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <Building2 className="h-20 w-20 text-gray-300" />
              <AlertCircle className="h-8 w-8 text-orange-500 absolute -top-1 -right-1" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              Gas Station Tidak Tersedia
            </h1>
            <p className="text-gray-600 text-sm lg:text-base">
              Gas station yang Anda cari tidak aktif atau tidak ditemukan.
            </p>
            <p className="text-gray-500 text-xs lg:text-sm flex items-center justify-center gap-2">
              Silakan hubungi developer{" "}
              <Image
                src="/logo/Nozzl.svg"
                alt="Nozzl"
                width={80}
                height={30}
                className="h-4 w-auto inline-block"
              />
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button asChild variant="default" size="lg">
            <Link href="/welcome">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali ke Daftar SPBU
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

