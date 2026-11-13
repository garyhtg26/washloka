import type { Service, ServiceCategory } from "./types";

// Prices and turnaround times are transcribed from BuzzWash's supplied posters.
// The package is a fixed fee for up to 10 kg, not a per-kilogram rate.
const daily: Service[] = [
  {
    id: "wash",
    name: "Cuci Kering Lipat",
    description: "Paket Bahagia, maksimal 10 kg per paket.",
    category: "daily",
    price: 35000,
    rates: { oneDay: 35000, express: 45000 },
    availableSpeeds: ["oneDay", "express"],
    pricingModel: "flat-package",
    maximumQuantity: 10,
    packageSize: 10,
    unit: "kg",
    days: "1 hari",
    icon: "wash",
  },
  {
    id: "complete",
    name: "Cuci Kering Setrika",
    description: "Cuci, kering, dan setrika untuk cucian kiloan.",
    category: "daily",
    price: 8000,
    rates: { regular: 8000, oneDay: 10000, express: 13000, quick: 16000 },
    availableSpeeds: ["regular", "oneDay", "express", "quick"],
    minimumQuantity: 3,
    unit: "kg",
    days: "3 hari",
    icon: "shirt",
  },
  {
    id: "iron",
    name: "Setrika Kiloan",
    description: "Layanan setrika pakaian per kilogram.",
    category: "daily",
    price: 7000,
    rates: { regular: 7000, oneDay: 9000, express: 12000, quick: 15000 },
    availableSpeeds: ["regular", "oneDay", "express", "quick"],
    minimumQuantity: 3,
    unit: "kg",
    days: "3 hari",
    icon: "iron",
  },
];

const pieceRows: Array<[string, string, number, ServiceCategory, string?]> = [
  ["tops", "Tops (Kaos / Kemeja / Blouse)", 15000, "premium"],
  ["bottoms", "Bottoms (Celana / Rok / Shorts / Jeans)", 15000, "premium"],
  ["batik", "Batik", 25000, "premium"],
  ["alat-ibadah", "Alat Ibadah (Mukena / Sarung / Sajadah)", 10000, "premium"],
  ["baju-muslim", "Baju Muslim", 20000, "premium"],
  ["suits", "Suits (Blazer / Jas)", 25000, "premium"],
  ["jacket", "Jaket (Hoodie / Sweater)", 20000, "premium"],
  ["cardigan", "Cardigan", 20000, "premium"],
  ["setelan", "Setelan Baju & Celana", 25000, "premium"],
  ["dress", "Dress", 20000, "premium"],
  ["gown", "Gown (Gaun Pesta / Gaun Variasi)", 45000, "premium"],
  ["coat", "Coat (Mantel / Jaket Tebal)", 40000, "premium"],
  ["bed-cover-single", "Bed Cover Single", 25000, "household"],
  ["bed-cover-double", "Bed Cover Double", 35000, "household"],
  ["pillowcase", "Pillow Case (Sarung Bantal)", 5000, "household"],
  ["blanket", "Blanket (Selimut)", 15000, "household"],
  ["bed-sheet", "Bed Sheet (Sprei)", 15000, "household"],
  ["sleeping-bag", "Sleeping Bag", 20000, "household"],
  ["tablecloth", "Tablecloth (Taplak Meja)", 10000, "household"],
  ["towel", "Towel (Handuk)", 10000, "household"],
  ["mattress", "Matras", 25000, "household"],
  ["sprei-set", "Sprei Set (2 sarung bantal dan 2 sarung guling)", 25000, "household", "set"],
];

const piece: Service[] = pieceRows.map(([id, name, price, category, unit]) => ({
  id,
  name,
  description: "Layanan satuan BuzzWash.",
  category,
  price,
  rates: { oneDay: price, express: price + 10000 },
  availableSpeeds: ["oneDay", "express"],
  unit: unit || "pcs",
  minimumQuantity: 1,
  days: "1 hari",
  icon: category,
}));

const premiumRows: Array<[string, string, number, boolean]> = [
  ["sepatu", "Laundry Sepatu", 50000, false],
  ["karpet-kecil", "Laundry Karpet Kecil", 35000, true],
  ["karpet-sedang", "Laundry Karpet Sedang", 50000, true],
  ["karpet-besar", "Laundry Karpet Besar", 75000, true],
  ["boneka-sedang", "Laundry Boneka Sedang", 35000, false],
  ["boneka-besar", "Laundry Boneka Besar", 50000, true],
  ["tas-sekolah", "Laundry Tas Sekolah", 40000, false],
];
const specialty: Service[] = premiumRows.map(([id, name, price, startingAt]) => ({
  id,
  name,
  description: startingAt
    ? "Harga mulai; biaya akhir dikonfirmasi toko."
    : "Layanan premium BuzzWash.",
  category: "premium",
  price,
  availableSpeeds: [],
  startingAt,
  unit: "pcs",
  minimumQuantity: 1,
  days: "Dikonfirmasi toko",
  icon: "premium",
}));

export const buzzwashServices: Service[] = [...daily, ...piece, ...specialty];
