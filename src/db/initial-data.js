// initial-data.js - Standard Data Jeol Food Indonesia
export const INITIAL_PRODUCTS = {
  batagor: {
    id: "PROD-01",
    key: "batagor",
    category: "batagor",
    name: "Batagor Super",
    description: "Ikan tenggiri + tahu segar",
    perBatch: 100,
    unit: "Pcs",
    shelfLifeDays: 30,
    currentStock: 12,
    stockStatus: "KRITIS", // Kritis (<= 15 pcs)
    stockAlert: "Sisa di kedai hampir habis (prioritas utama)",
    estHpp: 8340,
    sellingPrice: 12000,
    ingredients: [
      { name: "Daging Ikan Tenggiri Giling", qty: 10.0, unit: "Kg", costPerUnit: 65000 },
      { name: "Tepung Tapioka Super", qty: 7.0, unit: "Kg", costPerUnit: 12000 },
      { name: "Tahu Putih Pabrik", qty: 100, unit: "Pcs", costPerUnit: 1000 },
      { name: "Bumbu & Daun Bawang", qty: 1.2, unit: "Kg", costPerUnit: 25000 }
    ]
  },
  pempek_lenjer: {
    id: "PROD-02",
    key: "pempek_lenjer",
    category: "pempek",
    name: "Pempek Lenjer",
    description: "Varian panjang gurih favorit",
    perBatch: 100,
    unit: "Pcs",
    shelfLifeDays: 45,
    currentStock: 48,
    stockStatus: "AMAN",
    stockAlert: "Stok aman untuk operasional siang",
    estHpp: 7640,
    sellingPrice: 11000,
    ingredients: [
      { name: "Daging Ikan Tenggiri Giling", qty: 10.0, unit: "Kg", costPerUnit: 65000 },
      { name: "Tepung Tapioka Super", qty: 7.0, unit: "Kg", costPerUnit: 12000 },
      { name: "Garam & Bumbu Racik", qty: 1.0, unit: "Kg", costPerUnit: 30000 }
    ]
  },
  pempek_crispy: {
    id: "PROD-03",
    key: "pempek_crispy",
    category: "pempek",
    name: "Pempek Crispy",
    description: "Daging & kulit gurih renyah",
    perBatch: 80,
    unit: "Pcs",
    shelfLifeDays: 30,
    currentStock: 16,
    stockStatus: "MENIPIS", // Menipis (<= 20 pcs)
    stockAlert: "Prioritas masak kedua setelah Batagor",
    estHpp: 6850,
    sellingPrice: 10000,
    ingredients: [
      { name: "Daging Ikan Kulit/Campur", qty: 8.0, unit: "Kg", costPerUnit: 45000 },
      { name: "Tepung Tapioka Super", qty: 6.0, unit: "Kg", costPerUnit: 12000 },
      { name: "Bumbu Crispy", qty: 1.0, unit: "Kg", costPerUnit: 25000 }
    ]
  },
  pempek_adaan: {
    id: "PROD-04",
    key: "pempek_adaan",
    category: "pempek",
    name: "Pempek Adaan (Bulat)",
    description: "Campuran santan & bawang merah segar",
    perBatch: 100,
    unit: "Pcs",
    shelfLifeDays: 45,
    currentStock: 65,
    stockStatus: "AMAN",
    stockAlert: "Stok masih melimpah di freezer",
    estHpp: 7450,
    sellingPrice: 11000,
    ingredients: [
      { name: "Daging Ikan Tenggiri Giling", qty: 10.0, unit: "Kg", costPerUnit: 65000 },
      { name: "Tepung Tapioka Super", qty: 6.0, unit: "Kg", costPerUnit: 12000 },
      { name: "Santan & Bawang Merah", qty: 2.0, unit: "Kg", costPerUnit: 22000 }
    ]
  }
};

export const INITIAL_LOCATIONS = {
  freezer_dapur: {
    name: "Freezer Dapur Utama",
    type: "Bahan Baku Beku",
    items: [
      { name: "Daging Ikan Tenggiri Giling", qty: 25.0, unit: "Kg", status: "Tersisa Siap Olah" },
      { name: "Daging Ikan Kulit / Campur", qty: 12.0, unit: "Kg", status: "Tersisa Siap Olah" }
    ]
  },
  gudang_kering: {
    name: "Gudang Bahan Kering",
    type: "Suhu Ruang",
    items: [
      { name: "Tepung Tapioka Super", qty: 32.0, unit: "Kg", status: "Stok Karung Aman" },
      { name: "Bumbu & Garam Racik", qty: 8.5, unit: "Kg", status: "Tersimpan Rapi" },
      { name: "Tahu Putih Segar (Supplier Pabrik)", qty: 200, unit: "Pcs", status: "Diterima Pagi" }
    ]
  },
  freezer_produk_jadi: {
    name: "Freezer Produk Jadi (Cadangan)",
    type: "Vakum Beku Siap Kirim",
    items: [
      { name: "Batagor Super Vakum", qty: 124, unit: "Pcs", packs: "12 Pak Isi 10" },
      { name: "Pempek Lenjer Vakum", qty: 166, unit: "Pcs", packs: "16 Pak Isi 10" },
      { name: "Pempek Crispy Vakum", qty: 62, unit: "Pcs", packs: "6 Pak Isi 10" },
      { name: "Pempek Adaan Vakum", qty: 32, unit: "Pcs", packs: "3 Pak Isi 10" }
    ]
  },
  kedai_outlet: {
    name: "Stok Transit Kedai / Outlet",
    type: "Fresh Siap Goreng Hari Ini",
    items: [
      { name: "Batagor Super Fresh", qty: 35, unit: "Pcs" },
      { name: "Pempek Lenjer Fresh", qty: 30, unit: "Pcs" },
      { name: "Pempek Crispy Fresh", qty: 16, unit: "Pcs" },
      { name: "Pempek Adaan Fresh", qty: 15, unit: "Pcs" }
    ]
  }
};

const now = new Date();
const y = now.getFullYear();
const m = String(now.getMonth() + 1).padStart(2, '0');
const d = String(now.getDate()).padStart(2, '0');
const todayIso = `${y}${m}${d}`;
const todayDateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

export const INITIAL_CYCLE = {
  date: todayDateStr,
  stokAwal: 210, // Sisa kemarin (Kedai + Freezer)
  masukProduksi: 640, // Hasil 4 Batch lolos QC
  keluarPenjualanRandu: 480, // Kasir POS Randu kedai
  keluarSampel: 15, // Tester & B2B
  sisaAkhirBuku: 355, // 210 + 640 - 480 - 15 = 355
  sisaFisikKedai: 65,
  sisaFisikFreezer: 290,
  totalFisikHitung: 355,
  selisih: 0,
  statusNeraca: "SEIMBANG_COCOK",
  productsBreakdown: [
    { key: "batagor", name: "Batagor Super", stokAwal: 40, masuk: 174, keluarJual: 140, keluarSampel: 5, sisaAkhir: 69, status: "Cocok ✓" },
    { key: "pempek_lenjer", name: "Pempek Lenjer", stokAwal: 60, masuk: 196, keluarJual: 90, keluarSampel: 5, sisaAkhir: 161, status: "Cocok ✓" },
    { key: "pempek_crispy", name: "Pempek Crispy", stokAwal: 50, masuk: 158, keluarJual: 130, keluarSampel: 0, sisaAkhir: 78, status: "Cocok ✓" },
    { key: "pempek_adaan", name: "Pempek Adaan", stokAwal: 60, masuk: 112, keluarJual: 120, keluarSampel: 5, sisaAkhir: 47, status: "Cocok ✓" }
  ]
};

export const INITIAL_BATCHES = [
  {
    id: `BAT-${todayIso}-01`,
    time: "08:30 WIB",
    productKey: "pempek_lenjer",
    product: "Pempek Lenjer",
    batchNum: 2,
    usedBahan: "20kg Ikan, 14kg Tapioka",
    target: 200,
    actual: 196,
    yield: 98.0,
    reason: "Normal (Sesuai resep standar)",
    status: "HIJAU",
    allocatedFreezer: 146,
    allocatedKedai: 50
  },
  {
    id: `BAT-${todayIso}-02`,
    time: "10:45 WIB",
    productKey: "batagor",
    product: "Batagor Super",
    batchNum: 2,
    usedBahan: "20kg Ikan, 14kg Tapioka, 200 Tahu",
    target: 200,
    actual: 174,
    yield: 87.0,
    reason: "Tahu Pecah dari Pabrik (-26 pcs)",
    status: "KUNING",
    allocatedFreezer: 124,
    allocatedKedai: 50
  },
  {
    id: `BAT-${todayIso}-03`,
    time: "13:15 WIB",
    productKey: "pempek_crispy",
    product: "Pempek Crispy",
    batchNum: 2,
    usedBahan: "16kg Ikan, 12kg Tapioka",
    target: 160,
    actual: 158,
    yield: 98.7,
    reason: "Normal (Sesuai resep standar)",
    status: "HIJAU",
    allocatedFreezer: 108,
    allocatedKedai: 50
  },
  {
    id: `BAT-${todayIso}-04`,
    time: "15:00 WIB",
    productKey: "pempek_adaan",
    product: "Pempek Adaan",
    batchNum: 1,
    usedBahan: "10kg Ikan, 6kg Tapioka",
    target: 100,
    actual: 112,
    yield: 112.0,
    reason: "Bentuk agak kecil (+12 pcs)",
    status: "HIJAU",
    allocatedFreezer: 112,
    allocatedKedai: 0
  }
];

export const INITIAL_YIELD_HISTORY = (() => {
  const yields = [94.2, 88.5, 96.0, 91.0, 86.4, 95.1, 91.4];
  const statuses = ["HIJAU", "KUNING", "HIJAU", "HIJAU", "KUNING", "HIJAU", "HIJAU"];
  const n = new Date();
  return yields.map((yVal, i) => {
    const targetDate = new Date(n);
    targetDate.setDate(n.getDate() - (6 - i));
    const label = i === 6 
      ? `${targetDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} (Hari Ini)` 
      : targetDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return { date: label, yield: yVal, status: statuses[i] };
  });
})();
