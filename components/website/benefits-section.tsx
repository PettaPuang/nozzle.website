import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const benefits = [
  {
    title: "Efisiensi Operasional",
    description: "Otomatisasi proses operasional mengurangi waktu dan kesalahan manual",
    points: [
      "Pencatatan transaksi otomatis",
      "Manajemen stok real-time",
      "Pelaporan otomatis",
    ],
  },
  {
    title: "Kontrol Keuangan",
    description: "Pantau semua aspek keuangan dengan detail dan akurat",
    points: [
      "Tracking pendapatan harian",
      "Analisis profit & loss",
      "Manajemen kas terpusat",
    ],
  },
  {
    title: "Keputusan Data-Driven",
    description: "Buat keputusan bisnis berdasarkan data yang akurat dan real-time",
    points: [
      "Dashboard analitik lengkap",
      "Laporan komprehensif",
      "Insight bisnis yang actionable",
    ],
  },
];

export function BenefitsSection() {
  return (
    <section className="py-20 md:py-32 bg-gray-50 dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Mengapa Memilih Nozzl?
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Solusi yang dirancang khusus untuk membantu SPBU Anda berkembang lebih efisien
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {benefits.map((benefit) => (
            <Card key={benefit.title} className="bg-white dark:bg-gray-900">
              <CardContent className="pt-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {benefit.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {benefit.description}
                </p>
                <ul className="space-y-2">
                  {benefit.points.map((point, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

