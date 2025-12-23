import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

// Mock data untuk tutorial - bisa diganti dengan data dari CMS atau database
const tutorials = [
  {
    id: "getting-started",
    title: "Getting Started dengan Nozzl",
    description: "Pelajari cara menggunakan Nozzl untuk pertama kali",
    category: "Getting Started",
    type: "video",
    url: "https://www.youtube.com/watch?v=example",
    duration: "10:30",
  },
  {
    id: "managing-gas-stations",
    title: "Mengelola Gas Station",
    description: "Cara menambah dan mengelola data gas station",
    category: "Features",
    type: "video",
    url: "https://www.youtube.com/watch?v=example2",
    duration: "15:45",
  },
  {
    id: "reports-overview",
    title: "Overview Laporan",
    description: "Memahami berbagai jenis laporan yang tersedia",
    category: "Features",
    type: "link",
    url: "https://docs.nozzl.com/reports",
    duration: null,
  },
  {
    id: "advanced-settings",
    title: "Advanced Settings",
    description: "Konfigurasi lanjutan untuk power users",
    category: "Advanced",
    type: "video",
    url: "https://www.youtube.com/watch?v=example3",
    duration: "20:15",
  },
];

const categories = ["All", "Getting Started", "Features", "Advanced"];

export default function TutorialPage() {
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
                Tutorial & Panduan
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Pelajari cara menggunakan Nozzl dengan mudah
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((category) => (
            <Button
              key={category}
              variant={category === "All" ? "default" : "outline"}
              size="sm"
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Tutorial Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tutorials.map((tutorial) => (
            <Card key={tutorial.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{tutorial.title}</CardTitle>
                    <CardDescription>{tutorial.description}</CardDescription>
                  </div>
                  {tutorial.type === "video" && (
                    <Play className="h-5 w-5 text-blue-500 flex-shrink-0 ml-2" />
                  )}
                  {tutorial.type === "link" && (
                    <ExternalLink className="h-5 w-5 text-gray-500 flex-shrink-0 ml-2" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {tutorial.category}
                  </span>
                  {tutorial.duration && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {tutorial.duration}
                    </span>
                  )}
                </div>
                <Button
                  asChild
                  className="w-full mt-4"
                  variant={tutorial.type === "video" ? "default" : "outline"}
                >
                  <a
                    href={tutorial.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tutorial.type === "video" ? "Tonton Video" : "Buka Link"}
                    {tutorial.type === "link" && (
                      <ExternalLink className="ml-2 h-4 w-4" />
                    )}
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State (jika tidak ada tutorial) */}
        {tutorials.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              Belum ada tutorial tersedia. Silakan kembali lagi nanti.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

