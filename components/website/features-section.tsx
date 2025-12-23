import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BarChart3, Shield, Zap, Globe, FileText, Users } from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Full Control Management",
    description: "Visibilitas penuh atas setiap liter dan rupiah dengan kontrol manajemen yang lengkap",
  },
  {
    icon: Zap,
    title: "Reliable & Realtime Data",
    description: "Semua data dan transaksi tercatat realtime dengan akurasi tinggi",
  },
  {
    icon: Globe,
    title: "Easy to Use",
    description: "Mudah diakses kapan saja & dimana saja melalui web browser",
  },
  {
    icon: FileText,
    title: "Integrated Reporting",
    description: "Sistem pelaporan terintegrasi untuk operasional dan keuangan",
  },
  {
    icon: Users,
    title: "Multi-Station Management",
    description: "Kelola multiple gas station dari satu dashboard terpusat",
  },
  {
    icon: Shield,
    title: "Security & Permissions",
    description: "Sistem keamanan dan permission yang fleksibel dan aman",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 md:py-32 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Fitur & Keunggulan
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Solusi lengkap untuk mengelola operasional SPBU Anda dengan efisien dan terintegrasi
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Icon className="h-5 w-5 text-[#006FB8]" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </div>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <div className="text-center">
          <Link href="/features">
            <Button variant="outline" size="lg">
              Lihat Semua Fitur
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

