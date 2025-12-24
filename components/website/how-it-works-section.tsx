import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, BarChart3, CheckCircle } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Play,
    title: "Coba Demo",
    description: "Jelajahi demo experience untuk melihat fitur-fitur Nozzl secara langsung",
  },
  {
    number: "02",
    icon: BarChart3,
    title: "Setup & Konfigurasi",
    description: "Setup akun dan konfigurasi sesuai kebutuhan SPBU Anda dengan mudah",
  },
  {
    number: "03",
    icon: CheckCircle,
    title: "Mulai Gunakan",
    description: "Mulai kelola operasional SPBU Anda dengan sistem yang terintegrasi",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-20 md:py-32 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Cara Kerja
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Mulai menggunakan Nozzl dalam 3 langkah sederhana
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative">
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-4xl font-bold text-gray-200 dark:text-gray-700">
                        {step.number}
                      </div>
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Icon className="h-6 w-6 text-[#006FB8]" />
                      </div>
                    </div>
                    <CardTitle className="text-xl">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-400">{step.description}</p>
                  </CardContent>
                </Card>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gray-300 dark:bg-gray-700 transform -translate-y-1/2" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

