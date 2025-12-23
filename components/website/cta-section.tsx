import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Play } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-20 md:py-32 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="bg-white dark:bg-gray-900 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-12 pb-12 px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Siap untuk Mencoba?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
              Jelajahi demo experience kami untuk melihat semua fitur Nozzl dalam aksi.
              Mulai transformasi operasional SPBU Anda hari ini.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/demo/welcome">
                <Button
                  size="lg"
                  className="bg-[#006FB8] hover:bg-[#005A8C] text-white text-base md:text-lg px-8 py-6 h-auto"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Coba Demo Experience
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/tutorial">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base md:text-lg px-8 py-6 h-auto border-gray-300 dark:border-gray-700"
                >
                  Lihat Tutorial
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

