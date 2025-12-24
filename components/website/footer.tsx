import Link from "next/link";
import Image from "next/image";

const navigation = {
  product: [
    { name: "Fitur", href: "/features" },
    { name: "Tutorial", href: "/tutorial" },
    { name: "Demo", href: "/demo/welcome" },
  ],
  company: [
    { name: "Tentang", href: "/about" },
    { name: "Kontak", href: "/contact" },
  ],
  legal: [
    { name: "Privacy", href: "#" },
    { name: "Terms", href: "#" },
  ],
};

export function WebsiteFooter() {
  return (
    <footer className="bg-gray-900 dark:bg-black" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="/logo/NozzlLogomark.svg"
                alt="Nozzl"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <Image
                src="/logo/Nozzl.svg"
                alt="Nozzl"
                width={100}
                height={30}
                className="h-6 w-auto"
              />
            </Link>
            <p className="text-sm text-gray-400 max-w-md">
              Evolusi Operasional SPBU Independen - Sistem manajemen berbasis web
              untuk operasional, keuangan, dan pelaporan yang terintegrasi.
            </p>
            <p className="text-xs text-gray-500 mt-4">
              by <span className="font-semibold text-gray-400">CNNCT</span>
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">
              Produk
            </h3>
            <ul className="space-y-3">
              {navigation.product.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">
              Perusahaan
            </h3>
            <ul className="space-y-3">
              {navigation.company.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <p className="text-xs text-gray-400 text-center">
            &copy; {new Date().getFullYear()} Nozzl. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

