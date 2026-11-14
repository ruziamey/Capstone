# 🐟 JEOL SMART STOCK CONTROL
**Sistem Informasi Manajemen Kontrol Produksi & Closed-Loop Stok**  
*Mitra Industri: PT Jiva Mandala Dharma (Jeol Food Indonesia)*  
*Capstone Design Project - Catalyst Team*

---

## 📌 1. Gambaran Umum & Latar Belakang

Aplikasi ini dikembangkan untuk memecahkan tiga permasalahan utama di gerai dan rumah produksi **Jeol Food Indonesia** (UMKM olahan ikan: batagor dan pempek):
1. **Kegagalan Yield Produksi**: Sering terjadi penyusutan adonan dan selisih hasil olahan yang tidak terdeteksi akar penyebabnya.
2. **Double Input & Ketidaksinkronan Stok Kasir**: Kasir menggunakan POS Randu, sementara catatan produksi dapur terpisah, menyebabkan angka stok di pembukuan berbeda dengan fisik.
3. **Pencatatan Sampel/Tester yang Bocor**: Tester tester pembeli atau relasi sering tidak tercatat sehingga saat opname malam terjadi selisih stok misterius.
4. **Masak Tanpa Perencanaan**: Karyawan memasak berdasarkan perkiraan tanpa melihat sisa stok kritis di kedai.

### 🌟 Fitur Unggulan Sistem:
- 🔒 **Shift Buka Toko (Open Store Lock)**: Dapur wajib membuka toko sebelum memulai batch memasak, memastikan jam mulai shift tercatat.
- 🎯 **Rekomendasi Cerdas Stok Kritis**: Mengurutkan varian yang perlu dimasak berdasarkan sisa stok di kedai (Merah/Kritis $\le 15$, Kuning $\le 20$, Hijau $> 20$).
- 🧮 **Kalkulator BOM Otomatis**: Menghitung takaran bahan baku (Ikan Tenggiri, Tepung Tapioka, Tahu, Bumbu) berdasarkan penggali batch (1–5 batch) untuk mencegah kesalahan resep.
- 🚦 **Input Hasil Riil QC & Evaluasi Yield (RAG System)**: 
  - 🟢 Hijau ($\ge 90\%$): Efisiensi optimal.
  - 🟡 Kuning ($80\% - 89\%$): Toleransi minor.
  - 🔴 Merah ($< 80\%$): Anomali tinggi (wajib memilih *chip* alasan deviasi, e.g. Tahu Pecah, Adonan Lengket).
- 📦 **Alokasi Stok Dual-Lokasi**: Pembagian hasil riil matang ke Freezer Produk Jadi (vakum) dan Kedai (fresh).
- 🔄 **Siklus 5 Tahap Closed-Loop Inventory**:
  $$\text{Stok Awal} + \text{Masuk Produksi} - \text{Keluar Penjualan (Randu POS)} - \text{Keluar Sampel} = \text{Sisa Akhir Buku}$$
- 📥 **Integrasi Impor CSV/Data Randu POS**: Sinkronisasi data kasir satu klik tanpa ketik ulang (*zero double input*).
- 🏷️ **Pencatatan Sampel / Tester Khusus**: Pengeluaran non-penjualan terdokumentasi rapi.
- 🌙 **Modal Tutup Toko & Rekonsiliasi Opname Fisik**: Hitung fisik malam hari dengan validasi selisih otomatis dan checklist keamanan kompor/freezer.
- 📱 **Simulator Fleksibel (HP Mobile & Desktop)**: Dilengkapi tombol simulator untuk menguji tampilan Android Touch (target $\ge 52\text{px}$) maupun Desktop Monitor.

---

## 🛠️ 2. Arsitektur Teknologi

Aplikasi dirancang dengan arsitektur **Edge-Native** modern:
- **Backend Framework**: [Hono](https://hono.dev/) – framework TypeScript/JavaScript tercepat untuk Cloudflare Workers, Deno, dan Node.js.
- **Frontend**: Vanilla HTML5, CSS3, ES Modules, dan Tailwind CSS (tersedia *offline* di `./src/public/vendor/tailwind.js`, tidak membutuhkan koneksi internet saat pengujian lokal).
- **Target Deployment**: [Cloudflare Workers](https://workers.cloudflare.com/) dengan Workers Static Assets binding.
- **Local Testing Harness**: Node.js via `@hono/node-server`.

---

## 🚀 3. Panduan Menjalankan di Komputer Lokal

### Langkah 1: Buka Terminal / PowerShell
Masuk ke direktori aplikasi:
```bash
cd "c:\Users\ruzia\Documents\Capstone\code app"
```

### Langkah 2: Pastikan Dependensi Terpasang
Dependensi sudah terpasang di folder `node_modules`. Jika menjalankan di komputer baru, cukup ketik:
```bash
npm install
```

### Langkah 3: Jalankan Server Lokal
```bash
npm run dev
```
*(Atau `npm start`)*

### Langkah 4: Buka Browser
Buka tautan berikut di browser Anda (Chrome, Edge, Firefox, Safari):
- **Aplikasi Web**: [http://localhost:3000](http://localhost:3000)
- **API Health Check**: [http://localhost:3000/health](http://localhost:3000/health)
- **API Summary Stok**: [http://localhost:3000/api/inventory/summary](http://localhost:3000/api/inventory/summary)

---

## 🔑 4. Akun & Hak Akses Pengujian

Sistem menggunakan alur login 2-langkah (*Step-by-Step*) dengan otentikasi PIN 4-digit yang ramah layar sentuh bagi operasional dapur:

| Peran (Role) | PIN | Akses & Wewenang |
| :--- | :---: | :--- |
| **Karyawan** | `1234` | Buka Toko, Rekomendasi Menu Kritis, Eksekusi Batch BOM, QC Yield & Alasan Deviasi, Alokasi Freezer/Kedai, Form Sampel, Tutup Toko & Opname Fisik. |
| **Owner** | `8888` | Akses Dedicated Sidebar: Neraca 5 Siklus Closed Loop, Log Audit Batch Harian, Tren Yield (Grafik Canvas), Filter Varian, Impor Randu POS, Download Laporan CSV Finance. |

> 💡 **Catatan untuk Tim Finance**: Sesuai kebijakan penggabungan peran, tim finance dapat langsung masuk menggunakan akun **Owner** (PIN `8888`) untuk mengunduh rekapitulasi audit dan meninjau HPP bahan.

---

## 🌐 5. Panduan Deployment ke Cloudflare Workers

Aplikasi ini sudah dilengkapi berkas konfigurasi `wrangler.jsonc` resmi dan siap dideploy langsung ke Cloudflare Workers global edge.

### Langkah 1: Login ke Akun Cloudflare
Jalankan perintah ini di PowerShell / Terminal:
```bash
npx wrangler login
```
Browser akan terbuka untuk konfirmasi otorisasi akun Cloudflare Anda.

### Langkah 2: Uji Coba Simulasi Worker di Lokal (Opsional)
```bash
npm run dev:cf
```
Wrangler akan menjalankan simulasi runtime `workerd` Cloudflare di lokal.

### Langkah 3: Deploy ke Cloudflare Workers
```bash
npm run deploy
```
Wrangler akan mengunggah berkas statis `src/public` dan router Hono ke edge Cloudflare, dan menampilkan URL publik gratis Anda, contohnya:
```text
https://jeol-smart-stock-control.<subdomain>.workers.dev
```

---

## 📁 6. Struktur Direktori

```text
code app/
├── package.json               # Konfigurasi npm, skrip start/dev/deploy
├── package-lock.json
├── wrangler.jsonc             # Konfigurasi Cloudflare Workers & Static Assets
├── README.md                  # Dokumentasi lengkap panduan aplikasi
└── src/
    ├── index.js               # Entry point Hono untuk Cloudflare Workers
    ├── local-server.js        # Server adapter untuk pengetesan lokal Node.js
    ├── db/
    │   ├── initial-data.js    # Data master Jeol Food, BOM, resep, harga & siklus
    │   └── store.js           # State management & kalkulasi yield / neraca stok
    ├── routes/
    │   ├── auth.js            # Endpoint login PIN
    │   ├── master.js          # Endpoint produk, BOM, HPP
    │   ├── inventory.js       # Endpoint neraca stok, sampel, impor Randu POS
    │   ├── production.js      # Endpoint buka/tutup toko, alur batch, QC
    │   └── reports.js         # Endpoint riwayat tren yield & ekspor CSV
    └── public/                # Frontend Web Application (SPA)
        ├── index.html         # Struktur UI, alur dapur, dasbor owner, modal
        ├── css/
        │   └── style.css      # Styling simulator HP/Desktop & target sentuh
        ├── js/
        │   └── app.js         # Logika interaktif, REST API fetch, Canvas chart
        └── vendor/
            └── tailwind.js    # Tailwind CSS offline bundle
```

---

## 📞 7. Kontak & Dukungan
Dikembangkan dengan dedikasi untuk efisiensi operasional dan standardisasi mutu **PT Jiva Mandala Dharma (Jeol Food Indonesia)**.
