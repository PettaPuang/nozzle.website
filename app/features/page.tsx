import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const features = [
  {
    id: "full-control",
    title: "Full Control Management",
    description: "Visibilitas penuh atas setiap liter dan rupiah dengan kontrol manajemen yang lengkap",
    benefits: [
      "Monitoring real-time semua transaksi",
      "Kontrol penuh atas stok dan inventory",
      "Manajemen staff dan peran pengguna",
      "Pelacakan keuangan yang detail",
    ],
  },
  {
    id: "realtime-data",
    title: "Reliable & Realtime Data",
    description: "Semua data dan transaksi tercatat realtime dengan akurasi tinggi",
    benefits: [
      "Sinkronisasi data real-time",
      "Backup otomatis dan aman",
      "Riwayat transaksi lengkap",
      "Pelaporan otomatis",
    ],
  },
  {
    id: "easy-access",
    title: "Easy to Use",
    description: "Mudah diakses kapan saja & dimana saja melalui web browser",
    benefits: [
      "Akses dari berbagai perangkat",
      "Interface yang intuitif",
      "Tidak perlu instalasi aplikasi",
      "Responsive untuk mobile dan desktop",
    ],
  },
  {
    id: "integrated-reporting",
    title: "Integrated Reporting",
    description: "Sistem pelaporan terintegrasi untuk operasional dan keuangan",
    benefits: [
      "Laporan keuangan otomatis",
      "Laporan operasional harian",
      "Analisis penjualan",
      "Export data ke berbagai format",
    ],
  },
  {
    id: "multi-station",
    title: "Multi-Station Management",
    description: "Kelola multiple gas station dari satu dashboard",
    benefits: [
      "Dashboard terpusat",
      "Manajemen multi-station",
      "Perbandingan performa",
      "Kontrol terpusat",
    ],
  },
  {
    id: "security",
    title: "Security & Permissions",
    description: "Sistem keamanan dan permission yang fleksibel",
    benefits: [
      "Role-based access control",
      "Audit trail lengkap",
      "Data encryption",
      "Backup otomatis",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali ke Beranda
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <Image
              src="/logo/NozzlLogomark.svg"
              alt="Nozzl"
              width={48}
              height={48}
              className="w-12 h-12"
            />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Fitur & Keunggulan
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Temukan semua fitur yang membuat Nozzl menjadi solusi terbaik untuk SPBU Anda
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card key={feature.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {feature.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Siap untuk Mencoba?
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Jelajahi demo experience kami untuk melihat semua fitur dalam aksi
              </p>
              <Link href="/demo/welcome">
                <Button size="lg" className="bg-[#006FB8] hover:bg-[#005A8C]">
                  Coba Demo Experience
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

