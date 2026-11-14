// store.js - In-memory and persistent state store for Jeol Smart Stock Control
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  INITIAL_PRODUCTS,
  INITIAL_LOCATIONS,
  INITIAL_CYCLE,
  INITIAL_BATCHES,
  INITIAL_YIELD_HISTORY
} from "./initial-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "data-store.json");

class JeolStore {
  constructor() {
    this.reset();
    this.loadFromDisk();
  }

  reset() {
    this.products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
    this.locations = JSON.parse(JSON.stringify(INITIAL_LOCATIONS));
    this.cycle = JSON.parse(JSON.stringify(INITIAL_CYCLE));
    this.batches = JSON.parse(JSON.stringify(INITIAL_BATCHES));
    this.yieldHistory = JSON.parse(JSON.stringify(INITIAL_YIELD_HISTORY));
    this.isStoreOpened = false; // default closed: employee must perform Open Day first
    this.openedAt = null;
    this.closedAt = null;
    this.closeDayRecord = null;
    this.users = {
      karyawan: { role: "karyawan", name: "Karyawan", pin: "1234", title: "Karyawan Dapur" },
      owner: { role: "owner", name: "Owner", pin: "8888", title: "Owner & Manajemen / Finance" }
    };
    this.materialLogs = [
      {
        id: "LOG-RESTOCK-01",
        date: "12 Nov 2026",
        time: "07:30 WIB",
        type: "RESTOCK",
        typeLabel: "📥 Bahan Masuk",
        materialName: "Daging Ikan Tenggiri Giling",
        qty: 30.0,
        unit: "Kg",
        location: "Freezer Dapur Utama",
        partner: "Supplier Ikan Muara Baru",
        notes: "Kualitas A+, beku segar"
      },
      {
        id: "LOG-RESTOCK-02",
        date: "12 Nov 2026",
        time: "08:15 WIB",
        type: "RESTOCK",
        typeLabel: "📥 Bahan Masuk",
        materialName: "Tepung Tapioka Super",
        qty: 50.0,
        unit: "Kg",
        location: "Gudang Bahan Kering",
        partner: "Distributor Tepung Gunung",
        notes: "Kemasan karung utuh rapi"
      },
      {
        id: "LOG-RESTOCK-03",
        date: "13 Nov 2026",
        time: "07:45 WIB",
        type: "RESTOCK",
        typeLabel: "📥 Bahan Masuk",
        materialName: "Tahu Putih Segar",
        qty: 200,
        unit: "Pcs",
        location: "Area Olah Dapur",
        partner: "Supplier Pabrik Tahu Pak Haji",
        notes: "Kiriman harian siap cetak"
      }
    ];
    this.activeBatch = null;
  }

  // --- Persistence Methods ---
  loadFromDisk() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const data = JSON.parse(raw);
        if (data.products) this.products = data.products;
        if (data.locations) this.locations = data.locations;
        if (data.cycle) this.cycle = data.cycle;
        if (data.batches) this.batches = data.batches;
        if (data.yieldHistory) this.yieldHistory = data.yieldHistory;
        if (data.materialLogs) this.materialLogs = data.materialLogs;
        if (data.isStoreOpened !== undefined) this.isStoreOpened = data.isStoreOpened;
        if (data.openedAt) this.openedAt = data.openedAt;
        if (data.closedAt) this.closedAt = data.closedAt;
        if (data.closeDayRecord) this.closeDayRecord = data.closeDayRecord;
      } else {
        this.persistToDisk();
      }
    } catch (e) {
      console.warn("Notice: Starting with fresh in-memory data seed:", e.message);
    }
  }

  persistToDisk() {
    try {
      const data = {
        products: this.products,
        locations: this.locations,
        cycle: this.cycle,
        batches: this.batches,
        yieldHistory: this.yieldHistory,
        materialLogs: this.materialLogs,
        isStoreOpened: this.isStoreOpened,
        openedAt: this.openedAt,
        closedAt: this.closedAt,
        closeDayRecord: this.closeDayRecord,
        lastSavedAt: new Date().toISOString()
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.warn("Notice: Running in memory-only environment:", e.message);
    }
  }

  // --- Auth with Strict Role Validation ---
  authenticate(pin, selectedRole = null) {
    if (selectedRole === "karyawan") {
      if (pin === this.users.karyawan.pin) {
        return { success: true, user: this.users.karyawan };
      }
      return { success: false, message: "PIN tidak sesuai untuk peran Karyawan. Gunakan PIN 1234." };
    }
    if (selectedRole === "owner") {
      if (pin === this.users.owner.pin) {
        return { success: true, user: this.users.owner };
      }
      return { success: false, message: "PIN tidak sesuai untuk peran Owner. Gunakan PIN 8888." };
    }
    // Fallback general validation
    if (pin === this.users.karyawan.pin) {
      return { success: true, user: this.users.karyawan };
    }
    if (pin === this.users.owner.pin) {
      return { success: true, user: this.users.owner };
    }
    return { success: false, message: "PIN salah! Masukkan 4 digit PIN yang valid." };
  }

  // --- Store Shift Status ---
  openStore(operatorName = "Karyawan") {
    // Daily Rollover Logic: If reopening after a closed shift, carry forward closing physical stock and reset daily production/sales to 0!
    if (this.closeDayRecord) {
      const yesterdayFinal = Number(this.closeDayRecord.totalPhysical) || Number(this.cycle.sisaAkhirBuku) || 648;
      const yesterdayKedai = Number(this.closeDayRecord.physicalKedai) || 65;
      const yesterdayFreezer = Number(this.closeDayRecord.physicalFreezer) || (yesterdayFinal - yesterdayKedai);

      // Carry forward ending physical stock as new beginning stock
      this.cycle.stokAwal = yesterdayFinal;
      this.cycle.masukProduksi = 0;
      this.cycle.keluarPenjualanRandu = 0;
      this.cycle.keluarSampel = 0;
      this.cycle.sisaAkhirBuku = yesterdayFinal;
      this.cycle.sisaFisikKedai = yesterdayKedai;
      this.cycle.sisaFisikFreezer = yesterdayFreezer;
      this.cycle.totalFisikHitung = yesterdayFinal;
      this.cycle.selisih = 0;
      this.cycle.statusNeraca = "SEIMBANG_COCOK";
      this.cycle.date = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

      if (Array.isArray(this.cycle.productsBreakdown)) {
        this.cycle.productsBreakdown.forEach(p => {
          p.stokAwal = p.sisaAkhir || p.stokAwal;
          p.masuk = 0;
          p.keluarJual = 0;
          p.keluarSampel = 0;
          p.sisaAkhir = p.stokAwal;
          p.status = "Cocok ✓";
        });
      }

      this.currentShiftBatchesCount = 0;
      this.closeDayRecord = null;
    }

    this.isStoreOpened = true;
    this.openedAt = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
    this.closedAt = null;
    this.persistToDisk();
    return {
      success: true,
      message: `Toko & Dapur resmi dibuka pada ${this.openedAt}. Selamat bertugas ${operatorName}!`,
      openedAt: this.openedAt,
      cycle: this.cycle
    };
  }

  closeStore(data = {}) {
    // Auto-commit active batch if waiting in allocation
    if (this.activeBatch && (this.activeBatch.actual > 0 || this.activeBatch.status === "COOKED_WAITING_ALLOCATION")) {
      const actual = Number(this.activeBatch.actual) || Number(this.activeBatch.targetOutput) || 0;
      const k = Math.min(50, actual);
      const f = actual - k;
      const completedRecord = {
        id: this.activeBatch.id,
        batchId: this.activeBatch.id,
        time: this.activeBatch.startedAt || new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB",
        productKey: this.activeBatch.productKey,
        product: this.activeBatch.productName,
        usedBahan: (this.activeBatch.requiredIngredients || []).map(i => `${i.qty} ${i.unit} ${i.name}`).join(", "),
        target: this.activeBatch.targetOutput,
        actual: actual,
        yield: this.activeBatch.yield || 100,
        reason: this.activeBatch.reason || "Normal (Sesuai resep standar)",
        status: this.activeBatch.ragStatus || "HIJAU",
        allocatedFreezer: f,
        allocatedKedai: k
      };
      this.batches.unshift(completedRecord);
      this.cycle.masukProduksi += actual;
      this.cycle.sisaAkhirBuku += actual;
      this.activeBatch = null;
    }

    this.isStoreOpened = false;
    this.closedAt = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
    const kedaiCount = Number(data.kedaiCount ?? data.physicalKedai ?? this.cycle.sisaFisikKedai);
    const freezerCount = Number(data.freezerCount ?? data.physicalFreezer ?? this.cycle.sisaFisikFreezer);
    const totalCount = kedaiCount + freezerCount;
    const difference = totalCount - this.cycle.sisaAkhirBuku;

    // Update cycle data so Stage 5 (Fisik Lapangan) and reconciliation reflect accurately
    this.cycle.sisaFisikKedai = kedaiCount;
    this.cycle.sisaFisikFreezer = freezerCount;
    this.cycle.totalFisikHitung = totalCount;
    this.cycle.selisih = difference;
    this.cycle.statusNeraca = difference === 0 ? "SEIMBANG_COCOK" : "ADA_SELISIH";

    this.closeDayRecord = {
      closedAt: this.closedAt,
      date: this.cycle.date,
      expectedStock: this.cycle.sisaAkhirBuku,
      physicalKedai: kedaiCount,
      physicalFreezer: freezerCount,
      totalPhysical: totalCount,
      difference: difference,
      status: difference === 0 ? "COCOK_SEMPURNA" : "ADA_SELISIH",
      checklistGas: Boolean(data.checklistGas ?? true),
      checklistFreezer: Boolean(data.checklistFreezer ?? true),
      notes: data.notes || "Operasional selesai, kondisi dapur bersih."
    };

    this.persistToDisk();

    return {
      success: true,
      message: `Shift berhasil ditutup pada ${this.closedAt}. Laporan rekonsiliasi harian telah tersimpan.`,
      record: this.closeDayRecord,
      cycle: this.cycle
    };
  }

  // --- Master & Products ---
  getProducts() {
    return Object.values(this.products);
  }

  getProduct(key) {
    return this.products[key] || null;
  }

  // --- Production Workflow ---
  startBatch({ productKey, batchNum, batchSize, operator, targetOutput, ingredients }) {
    const prod = this.getProduct(productKey);
    if (!prod) throw new Error("Produk tidak ditemukan.");
    const num = Math.max(1, Number(batchNum ?? batchSize) || 1);
    const target = Number(targetOutput) > 0 ? Number(targetOutput) : (prod.perBatch * num);

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}${m}${d}`;
    const nextBatchId = `BAT-${todayStr}-${String(this.batches.length + 1).padStart(2, '0')}`;

    const requiredIngredients = Array.isArray(ingredients) && ingredients.length > 0
      ? ingredients.map(ing => ({
          name: ing.name,
          qty: Number(Number(ing.qty).toFixed(2)),
          unit: ing.unit || "Kg"
        }))
      : prod.ingredients.map(ing => ({
          name: ing.name,
          qty: Number((ing.qty * (target / (prod.perBatch || 100))).toFixed(2)),
          unit: ing.unit
        }));

    this.activeBatch = {
      id: nextBatchId,
      batchId: nextBatchId,
      productKey,
      productName: prod.name,
      batchNum: num,
      batchSize: num,
      targetOutput: target,
      expectedOutput: target,
      target,
      operator: operator || "Karyawan",
      requiredIngredients,
      startedAt: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB",
      status: "RUNNING"
    };

    return this.activeBatch;
  }

  finishCooking({ actualOutput, reasonCode, customNote }) {
    if (!this.activeBatch) throw new Error("Tidak ada batch aktif yang sedang berjalan.");
    const actual = Math.max(0, Number(actualOutput) || 0);
    const target = this.activeBatch.targetOutput;
    const yieldPct = Number(((actual / target) * 100).toFixed(1));

    let ragStatus = "HIJAU";
    if (yieldPct < 80.0) ragStatus = "MERAH";
    else if (yieldPct < 90.0) ragStatus = "KUNING";

    let finalReason = reasonCode || "Normal (Sesuai resep standar)";
    if (customNote) finalReason += ` - ${customNote}`;

    this.activeBatch.actual = actual;
    this.activeBatch.yield = yieldPct;
    this.activeBatch.yieldRate = yieldPct;
    this.activeBatch.reason = finalReason;
    this.activeBatch.ragStatus = ragStatus;
    this.activeBatch.yieldStatus = ragStatus;
    this.activeBatch.status = "COOKED_WAITING_ALLOCATION";

    return this.activeBatch;
  }

  allocateStock({ toFreezer, toKedai }) {
    if (!this.activeBatch) throw new Error("Tidak ada batch aktif.");
    const f = Number(toFreezer) || 0;
    const k = Number(toKedai) || 0;
    const actual = this.activeBatch.actual || 0;

    if (f + k !== actual) {
      throw new Error(`Total alokasi (${f + k}) tidak sesuai dengan output riil (${actual} pcs).`);
    }

    const completedRecord = {
      id: this.activeBatch.id,
      batchId: this.activeBatch.id,
      time: this.activeBatch.startedAt,
      productKey: this.activeBatch.productKey,
      product: this.activeBatch.productName,
      batchNum: this.activeBatch.batchNum,
      usedBahan: this.activeBatch.requiredIngredients.map(i => `${i.qty}${i.unit} ${i.name.split(" ")[0]}`).join(", "),
      target: this.activeBatch.targetOutput,
      actual: this.activeBatch.actual,
      yield: this.activeBatch.yield,
      reason: this.activeBatch.reason,
      status: this.activeBatch.ragStatus,
      allocatedFreezer: f,
      allocatedKedai: k
    };

    this.batches.unshift(completedRecord);

    // Update cycle numbers
    this.cycle.masukProduksi += actual;
    this.cycle.sisaAkhirBuku += actual;
    this.cycle.sisaFisikKedai += k;
    this.cycle.sisaFisikFreezer += f;
    this.cycle.totalFisikHitung = this.cycle.sisaFisikKedai + this.cycle.sisaFisikFreezer;

    // Update product stock
    if (this.products[this.activeBatch.productKey]) {
      this.products[this.activeBatch.productKey].currentStock += k;
    }

    // Update physical locations dynamically
    if (this.locations) {
      const prodKey = this.activeBatch.productKey;
      // 1. Add to Freezer Produk Jadi
      if (this.locations.freezer_produk_jadi && Array.isArray(this.locations.freezer_produk_jadi.items)) {
        const fItem = this.locations.freezer_produk_jadi.items.find(i => 
          (prodKey === 'batagor' && i.name.toLowerCase().includes('batagor')) ||
          (prodKey === 'pempek_lenjer' && i.name.toLowerCase().includes('lenjer')) ||
          (prodKey === 'pempek_crispy' && i.name.toLowerCase().includes('crispy')) ||
          (prodKey === 'pempek_adaan' && i.name.toLowerCase().includes('adaan'))
        );
        if (fItem) fItem.qty += f;
      }

      // 2. Add to Kedai Outlet
      if (this.locations.kedai_outlet && Array.isArray(this.locations.kedai_outlet.items)) {
        const kItem = this.locations.kedai_outlet.items.find(i => 
          (prodKey === 'batagor' && i.name.toLowerCase().includes('batagor')) ||
          (prodKey === 'pempek_lenjer' && i.name.toLowerCase().includes('lenjer')) ||
          (prodKey === 'pempek_crispy' && i.name.toLowerCase().includes('crispy')) ||
          (prodKey === 'pempek_adaan' && i.name.toLowerCase().includes('adaan'))
        );
        if (kItem) kItem.qty += k;
      }

      // 3. Deduct raw materials used from kitchen freezer & dry storage
      if (Array.isArray(this.activeBatch.requiredIngredients)) {
        this.activeBatch.requiredIngredients.forEach(ing => {
          const ingName = (ing.name || "").toLowerCase();
          const usedQty = Number(ing.qty) || 0;

          if (ingName.includes("ikan")) {
            if (this.locations.freezer_dapur && Array.isArray(this.locations.freezer_dapur.items)) {
              const matched = this.locations.freezer_dapur.items.find(i => i.name.toLowerCase().includes("ikan"));
              if (matched) matched.qty = Math.max(0, Number((matched.qty - usedQty).toFixed(2)));
            }
          } else {
            if (this.locations.gudang_kering && Array.isArray(this.locations.gudang_kering.items)) {
              const matched = this.locations.gudang_kering.items.find(i => {
                if (ingName.includes("tapioka") && i.name.toLowerCase().includes("tapioka")) return true;
                if (ingName.includes("bumbu") && i.name.toLowerCase().includes("bumbu")) return true;
                if (ingName.includes("tahu") && i.name.toLowerCase().includes("tahu")) return true;
                return false;
              });
              if (matched) matched.qty = Math.max(0, Number((matched.qty - usedQty).toFixed(2)));
            }
          }
        });
      }
    }

    const finishedBatch = {
      ...this.activeBatch,
      status: "COMPLETED",
      allocatedFreezer: f,
      allocatedKedai: k
    };
    this.activeBatch = null;

    // Persist to file
    this.persistToDisk();

    return finishedBatch;
  }

  // --- Inventory: Restock Raw Materials from Supplier ---
  restockMaterial({ materialKey, qty, supplier, notes }) {
    const quantity = Math.max(0.1, Number(qty) || 0);
    const supp = supplier || "Supplier Langganan";
    const note = notes || "Penerimaan bahan baku fisik";

    const materialMap = {
      ikan_tenggiri: { name: "Daging Ikan Tenggiri Giling", locKey: "freezer_dapur", unit: "Kg" },
      ikan_kulit: { name: "Daging Ikan Kulit / Campur", locKey: "freezer_dapur", unit: "Kg" },
      tapioka: { name: "Tepung Tapioka Super", locKey: "gudang_kering", unit: "Kg" },
      bumbu: { name: "Bumbu & Garam Racik", locKey: "gudang_kering", unit: "Kg" },
      tahu_putih: { name: "Tahu Putih Segar (Supplier Pabrik)", locKey: "gudang_kering", unit: "Pcs" }
    };

    const targetDef = materialMap[materialKey] || { name: materialKey, locKey: "freezer_dapur", unit: "Kg" };
    const loc = this.locations[targetDef.locKey];
    let foundItem = null;
    let targetLocation = "";

    if (loc && Array.isArray(loc.items)) {
      foundItem = loc.items.find(i => 
        i.name.toLowerCase().includes(targetDef.name.toLowerCase()) || 
        (targetDef.name.toLowerCase().includes("ikan tenggiri") && i.name.toLowerCase().includes("ikan tenggiri"))
      );
      if (foundItem) {
        foundItem.qty = Number((foundItem.qty + quantity).toFixed(2));
        targetLocation = loc.name;
      } else {
        foundItem = { name: targetDef.name, qty: quantity, unit: targetDef.unit, status: "Tersedia Siap Olah" };
        loc.items.push(foundItem);
        targetLocation = loc.name;
      }
    }

    const logEntry = {
      id: "LOG-RESTOCK-" + Date.now().toString().slice(-6),
      date: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB",
      type: "RESTOCK",
      typeLabel: "📥 Bahan Masuk",
      materialName: targetDef.name,
      qty: quantity,
      unit: targetDef.unit,
      location: targetLocation || loc?.name || "Gudang",
      partner: supp,
      notes: note
    };

    if (!Array.isArray(this.materialLogs)) this.materialLogs = [];
    this.materialLogs.unshift(logEntry);

    this.persistToDisk();

    return {
      success: true,
      message: `Berhasil mencatat penerimaan ${quantity} ${targetDef.unit} ${targetDef.name} dari ${supp}.`,
      item: foundItem,
      locations: this.locations,
      log: logEntry
    };
  }

  // --- Inventory: Transfer Finished Products (Freezer -> Kedai) ---
  transferStock({ productKey, qty, notes }) {
    const quantity = Math.max(1, Number(qty) || 0);
    const prodNames = {
      batagor: { freezerName: "Batagor Super Vakum", kedaiName: "Batagor Super Fresh", name: "Batagor Super" },
      pempek_lenjer: { freezerName: "Pempek Lenjer Vakum", kedaiName: "Pempek Lenjer Fresh", name: "Pempek Lenjer" },
      pempek_crispy: { freezerName: "Pempek Crispy Vakum", kedaiName: "Pempek Crispy Fresh", name: "Pempek Crispy" },
      pempek_adaan: { freezerName: "Pempek Adaan Vakum", kedaiName: "Pempek Adaan Fresh", name: "Pempek Adaan" }
    };

    const targetDef = prodNames[productKey] || prodNames.batagor;
    const freezerLoc = this.locations.freezer_produk_jadi;
    const kedaiLoc = this.locations.kedai_outlet;

    const fItem = freezerLoc.items.find(i => i.name.toLowerCase().includes(targetDef.name.toLowerCase()));
    const kItem = kedaiLoc.items.find(i => i.name.toLowerCase().includes(targetDef.name.toLowerCase()));

    if (!fItem || fItem.qty < quantity) {
      const avail = fItem ? fItem.qty : 0;
      throw new Error(`Stok di Freezer Cadangan tidak mencukupi (Tersedia: ${avail} Pcs, Diminta: ${quantity} Pcs).`);
    }

    fItem.qty -= quantity;
    if (kItem) {
      kItem.qty += quantity;
    } else {
      kedaiLoc.items.push({ name: targetDef.kedaiName, qty: quantity, unit: "Pcs" });
    }

    // Update cycle counts
    this.cycle.sisaFisikFreezer = Math.max(0, this.cycle.sisaFisikFreezer - quantity);
    this.cycle.sisaFisikKedai += quantity;

    const logEntry = {
      id: "LOG-TRF-" + Date.now().toString().slice(-6),
      date: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB",
      type: "TRANSFER",
      typeLabel: "🔄 Transfer Lokasi",
      materialName: targetDef.name,
      qty: quantity,
      unit: "Pcs",
      location: "Freezer Cadangan ➔ Kedai Siap Goreng",
      partner: "Staf Operasional Kedai",
      notes: notes || "Pemindahan untuk persiapan penjualan jam sibuk"
    };

    if (!Array.isArray(this.materialLogs)) this.materialLogs = [];
    this.materialLogs.unshift(logEntry);

    this.persistToDisk();

    return {
      success: true,
      message: `Berhasil mentransfer ${quantity} Pcs ${targetDef.name} dari Freezer Cadangan ke Kedai Siap Goreng.`,
      locations: this.locations,
      cycle: this.cycle,
      log: logEntry
    };
  }

  getMaterialLogs() {
    return this.materialLogs || [];
  }

  // --- Outflow: Special Sample ---
  recordSample({ productKey, qty, purpose, reason, location = "Freezer Cadangan" }) {
    const quantity = Number(qty) || 0;
    const samplePurpose = purpose || reason || "Tester / Sampel B2B";
    this.cycle.keluarSampel += quantity;
    this.cycle.sisaAkhirBuku -= quantity;
    this.cycle.sisaFisikFreezer = Math.max(0, this.cycle.sisaFisikFreezer - quantity);
    this.cycle.totalFisikHitung = this.cycle.sisaFisikKedai + this.cycle.sisaFisikFreezer;

    this.persistToDisk();

    return {
      success: true,
      message: `Pengeluaran sampel (${quantity} pcs) untuk ${samplePurpose} berhasil dicatat.`,
      cycle: this.cycle
    };
  }

  // --- Outflow: Randu POS Sales Import ---
  importRanduSales(salesItems = null) {
    const defaultImport = [
      { key: "batagor", name: "Batagor Super", qty: 140, omzet: 1680000 },
      { key: "pempek_lenjer", name: "Pempek Lenjer", qty: 90, omzet: 990000 },
      { key: "pempek_crispy", name: "Pempek Crispy", qty: 130, omzet: 1300000 },
      { key: "pempek_adaan", name: "Pempek Adaan", qty: 120, omzet: 1320000 }
    ];

    const items = salesItems || defaultImport;
    const totalQty = items.reduce((sum, item) => sum + (Number(item.qty ?? item.qtySold) || 0), 0);
    const totalOmzet = items.reduce((sum, item) => sum + (Number(item.omzet ?? item.sales) || 0), 0);

    this.cycle.keluarPenjualanRandu = totalQty;
    this.cycle.sisaAkhirBuku = this.cycle.stokAwal + this.cycle.masukProduksi - this.cycle.keluarPenjualanRandu - this.cycle.keluarSampel;

    this.persistToDisk();

    return {
      success: true,
      message: `Sinkronisasi Randu POS Berhasil! ${totalQty} pcs penjualan (Rp ${totalOmzet.toLocaleString("id-ID")}) berhasil diperbarui tanpa input ganda.`,
      items,
      totalQty,
      totalOmzet,
      newCycle: this.cycle
    };
  }

  // --- Periodic Filter Helpers ---
  getBatchesByPeriod(period = 'today') {
    if (period === 'last_month') {
      return this.batches.filter(b => (b.id && b.id.includes("202610")) || (b.date && b.date.toLowerCase().includes("okt")));
    }
    if (period === 'this_month') {
      return this.batches.filter(b => (b.id && b.id.includes("202611")) || (b.date && b.date.toLowerCase().includes("nov")));
    }
    if (period === '7d') {
      return this.batches.slice(0, 10);
    }
    // 'today' default
    const todayBatches = this.batches.filter(b => (b.id && b.id.includes("20261113")) || (b.date && b.date.includes("13 Nov")));
    return todayBatches;
  }

  getYieldTrendByPeriod(period = 'today') {
    if (period === 'last_month') {
      return [
        { date: '5 Okt', yield: 96.5, status: 'HIJAU' },
        { date: '10 Okt', yield: 93.0, status: 'HIJAU' },
        { date: '15 Okt', yield: 97.5, status: 'HIJAU' },
        { date: '20 Okt', yield: 86.2, status: 'KUNING' },
        { date: '25 Okt', yield: 96.0, status: 'HIJAU' },
        { date: '28 Okt', yield: 98.9, status: 'HIJAU' },
        { date: '31 Okt', yield: 94.5, status: 'HIJAU' }
      ];
    }
    if (period === 'this_month') {
      return [
        { date: '1 Nov', yield: 94.0, status: 'HIJAU' },
        { date: '4 Nov', yield: 92.5, status: 'HIJAU' },
        { date: '7 Nov', yield: 94.2, status: 'HIJAU' },
        { date: '8 Nov', yield: 88.5, status: 'KUNING' },
        { date: '9 Nov', yield: 96.0, status: 'HIJAU' },
        { date: '10 Nov', yield: 91.0, status: 'HIJAU' },
        { date: '11 Nov', yield: 86.4, status: 'KUNING' },
        { date: '12 Nov', yield: 95.1, status: 'HIJAU' },
        { date: '13 Nov', yield: 97.4, status: 'HIJAU' }
      ];
    }
    if (period === 'today') {
      const todayList = this.getBatchesByPeriod('today');
      if (todayList.length >= 3) {
        return todayList.map((b, i) => ({
          date: `B-${b.id.split('-').pop() || (i + 1)}`,
          yield: Number(b.yield) || 95,
          status: b.status || 'HIJAU'
        }));
      }
    }
    // 7d default
    return [
      { date: '7 Nov', yield: 94.2, status: 'HIJAU' },
      { date: '8 Nov', yield: 88.5, status: 'KUNING' },
      { date: '9 Nov', yield: 96.0, status: 'HIJAU' },
      { date: '10 Nov', yield: 91.0, status: 'HIJAU' },
      { date: '11 Nov', yield: 86.4, status: 'KUNING' },
      { date: '12 Nov', yield: 95.1, status: 'HIJAU' },
      { date: '13 Nov (Hari Ini)', yield: 97.4, status: 'HIJAU' }
    ];
  }

  // --- Reports & Export ---
  getAuditCSV(period = 'today') {
    const list = this.getBatchesByPeriod(period);
    let title = "Hari_Ini";
    if (period === 'last_month') title = "Oktober_2026";
    else if (period === 'this_month') title = "November_2026";
    else if (period === '7d') title = "7_Hari_Terakhir";

    let csv = "Batch ID,Waktu,Produk,Bahan Terpakai,Target BOM,Hasil Riil,Yield (%),Alasan Deviasi,Status RAG\r\n";
    list.forEach(b => {
      csv += `"${b.id}","${b.time || ''}","${b.product || ''}","${b.usedBahan || ''}",${b.target || 0},${b.actual || 0},${b.yield || 0}%,"${b.reason || ''}","${b.status || 'HIJAU'}"\r\n`;
    });
    return {
      csv,
      filename: `Laporan_Batch_Jeol_${title}.csv`
    };
  }
}

export const store = new JeolStore();
