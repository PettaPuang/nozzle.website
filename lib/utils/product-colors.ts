/**
 * Warna khas produk Pertamina
 * Berdasarkan identitas visual resmi Pertamina
 *
 * Warna Logo Pertamina (Official Hex):
 * - Biru: #0073B2 - Kepercayaan, tanggung jawab, profesionalisme
 * - Merah: #FD0017 - Keuletan, ketegasan, keberanian
 * - Hijau: #9FE400 - Energi berwawasan lingkungan
 *
 * Referensi:
 * - Premium (RON 88): Kuning/Orange
 * - Pertalite (RON 90): Hijau
 * - Pertamax (RON 92): Biru
 * - Pertamax Turbo (RON 98): Merah
 * - Pertamax Green 95: Ungu/Purple
 * - Pertamina Dex/Dexlite: Hijau Tua (Diesel)
 */

export type ProductColorScheme = {
  bg: string;
  border: string;
  text: string;
  badge: string;
  hex: {
    bg: string;
    text: string;
  };
  liquid: {
    light: string;
    dark: string;
    surface: string;
    wave: string;
    bubble: string;
  };
};

// Warna brand Pertamina resmi
export const PERTAMINA_COLORS = {
  blue: "#0073B2", // 50%
  red: "#FD0017", // 25%
  green: "#9FE400", // 25%
};

export const PRODUCT_COLORS: Record<string, ProductColorScheme> = {
  // Premium - Kuning/Orange
  premium: {
    bg: "bg-gradient-to-br from-orange-400 to-orange-500",
    border: "border-orange-500",
    text: "text-orange-900",
    badge: "bg-orange-100 text-orange-700 border-orange-300",
    hex: {
      bg: "#f97316",
      text: "#ffffff",
    },
    liquid: {
      light: "rgba(251, 191, 36, 0.75)",
      dark: "rgba(234, 88, 12, 0.95)",
      surface: "rgba(251, 191, 36, 0.35)",
      wave: "rgba(249, 115, 22, 0.45)",
      bubble: "rgba(255, 255, 255, 0.3)",
    },
  },

  // Pertalite - Putih Kehijauan (Nozzle Putih, Tulisan Hijau)
  pertalite: {
    bg: "bg-gradient-to-br from-green-50 to-green-100",
    border: "border-green-800",
    text: "text-green-800",
    badge: "bg-green-100 text-green-700 border-green-800",
    hex: {
      bg: "#f0fdf4",
      text: "#166534",
    },
    liquid: {
      light: "rgba(240, 253, 244, 0.9)",
      dark: "rgba(220, 252, 231, 0.95)",
      surface: "rgba(240, 253, 244, 0.4)",
      wave: "rgba(34, 197, 94, 0.3)",
      bubble: "rgba(34, 197, 94, 0.2)",
    },
  },

  // Pertamax - Biru (Pertamina Blue #0073B2)
  pertamax: {
    bg: "bg-gradient-to-br from-blue-600 to-blue-700",
    border: "border-blue-700",
    text: "text-blue-900",
    badge: "bg-blue-100 text-blue-700 border-blue-300",
    hex: {
      bg: "#0073B2",
      text: "#ffffff",
    },
    liquid: {
      light: "rgba(0, 115, 178, 0.8)",
      dark: "rgba(0, 90, 140, 0.95)",
      surface: "rgba(0, 115, 178, 0.35)",
      wave: "rgba(0, 115, 178, 0.5)",
      bubble: "rgba(255, 255, 255, 0.25)",
    },
  },

  // Pertamax Turbo - Merah (Pertamina Red #FD0017)
  "pertamax turbo": {
    bg: "bg-gradient-to-br from-red-600 to-red-700",
    border: "border-red-700",
    text: "text-red-900",
    badge: "bg-red-100 text-red-700 border-red-300",
    hex: {
      bg: "#FD0017",
      text: "#ffffff",
    },
    liquid: {
      light: "rgba(253, 0, 23, 0.8)",
      dark: "rgba(200, 0, 20, 0.95)",
      surface: "rgba(253, 0, 23, 0.35)",
      wave: "rgba(253, 0, 23, 0.5)",
      bubble: "rgba(255, 255, 255, 0.25)",
    },
  },

  // Pertamax Green 95 - Ungu
  "pertamax green": {
    bg: "bg-gradient-to-br from-purple-500 to-purple-600",
    border: "border-purple-600",
    text: "text-purple-900",
    badge: "bg-purple-100 text-purple-700 border-purple-300",
    hex: {
      bg: "#9333ea",
      text: "#ffffff",
    },
    liquid: {
      light: "rgba(216, 180, 254, 0.8)",
      dark: "rgba(126, 34, 206, 0.95)",
      surface: "rgba(168, 85, 247, 0.35)",
      wave: "rgba(168, 85, 247, 0.5)",
      bubble: "rgba(255, 255, 255, 0.25)",
    },
  },

  // Pertamina Dex (Diesel) - Hijau Tua
  dex: {
    bg: "bg-gradient-to-br from-emerald-700 to-emerald-800",
    border: "border-emerald-800",
    text: "text-emerald-900",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-300",
    hex: {
      bg: "#047857",
      text: "#ffffff",
    },
    liquid: {
      light: "rgba(4, 120, 87, 0.8)",
      dark: "rgba(2, 90, 65, 0.95)",
      surface: "rgba(4, 120, 87, 0.35)",
      wave: "rgba(4, 120, 87, 0.5)",
      bubble: "rgba(255, 255, 255, 0.25)",
    },
  },

  // Dexlite (Diesel) - Kuning Keemasan (Warna Nozzle SPBU)
  dexlite: {
    bg: "bg-gradient-to-br from-yellow-400 to-amber-500",
    border: "border-amber-500",
    text: "text-amber-900",
    badge: "bg-yellow-100 text-yellow-700 border-yellow-300",
    hex: {
      bg: "#f59e0b",
      text: "#ffffff",
    },
    liquid: {
      light: "rgba(253, 230, 138, 0.8)",
      dark: "rgba(217, 119, 6, 0.95)",
      surface: "rgba(251, 191, 36, 0.35)",
      wave: "rgba(245, 158, 11, 0.5)",
      bubble: "rgba(255, 255, 255, 0.25)",
    },
  },

  // BioSolar/Solar (Diesel) - Abu-abu/Perak (Warna Nozzle SPBU)
  solar: {
    bg: "bg-gradient-to-br from-gray-400 to-gray-500",
    border: "border-gray-500",
    text: "text-gray-900",
    badge: "bg-gray-100 text-gray-700 border-gray-300",
    hex: {
      bg: "#9ca3af",
      text: "#ffffff",
    },
    liquid: {
      light: "rgba(156, 163, 175, 0.8)",
      dark: "rgba(107, 114, 128, 0.95)",
      surface: "rgba(156, 163, 175, 0.35)",
      wave: "rgba(156, 163, 175, 0.5)",
      bubble: "rgba(255, 255, 255, 0.25)",
    },
  },
  // BioSolar alias untuk solar
  biosolar: {
    bg: "bg-gradient-to-br from-gray-400 to-gray-500",
    border: "border-gray-500",
    text: "text-gray-900",
    badge: "bg-gray-100 text-gray-700 border-gray-300",
    hex: {
      bg: "#9ca3af",
      text: "#ffffff",
    },
    liquid: {
      light: "rgba(156, 163, 175, 0.8)",
      dark: "rgba(107, 114, 128, 0.95)",
      surface: "rgba(156, 163, 175, 0.35)",
      wave: "rgba(156, 163, 175, 0.5)",
      bubble: "rgba(255, 255, 255, 0.25)",
    },
  },

  // Default untuk produk lain (Non-BBM, Lubricant, dll)
  default: {
    bg: "bg-gradient-to-br from-gray-500 to-gray-600",
    border: "border-gray-600",
    text: "text-gray-900",
    badge: "bg-gray-100 text-gray-700 border-gray-300",
    hex: {
      bg: "#6b7280",
      text: "#ffffff",
    },
    liquid: {
      light: "rgba(209, 213, 219, 0.8)",
      dark: "rgba(107, 114, 128, 0.95)",
      surface: "rgba(156, 163, 175, 0.35)",
      wave: "rgba(107, 114, 128, 0.5)",
      bubble: "rgba(255, 255, 255, 0.25)",
    },
  },
};

/**
 * Mendapatkan warna produk berdasarkan nama
 * @param productName - Nama produk (case insensitive)
 * @returns ProductColorScheme
 */
export function getProductColor(productName: string): ProductColorScheme {
  const name = productName.toLowerCase().trim();

  // Cek apakah ada match langsung
  if (PRODUCT_COLORS[name]) {
    return PRODUCT_COLORS[name];
  }

  // Cek apakah nama mengandung keyword tertentu
  if (name.includes("pertalite")) return PRODUCT_COLORS.pertalite;
  if (name.includes("pertamax") && name.includes("turbo"))
    return PRODUCT_COLORS["pertamax turbo"];
  if (name.includes("pertamax") && name.includes("green"))
    return PRODUCT_COLORS["pertamax green"];
  if (name.includes("pertamax")) return PRODUCT_COLORS.pertamax;
  if (name.includes("premium")) return PRODUCT_COLORS.premium;
  if (name.includes("biosolar")) return PRODUCT_COLORS.biosolar;
  if (name.includes("dexlite")) return PRODUCT_COLORS.dexlite;
  if (name.includes("dex")) return PRODUCT_COLORS.dex;
  if (name.includes("solar")) return PRODUCT_COLORS.solar;

  // Default
  return PRODUCT_COLORS.default;
}
