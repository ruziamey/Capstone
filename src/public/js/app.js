// src/public/js/app.js - Frontend application controller connected to REST API

// Global State
let currentRole = null; // 'karyawan' | 'owner' | null
let selectedMenuKey = 'batagor';
let currentBatchNum = 2;
let currentTargetPcs = 200;
let selectedReasons = ['Tahu Pecah dari Pabrik'];
let activeBatchData = null;
let productsData = {};
let cycleData = {};
let batchesData = [];

// Dynamically generate 7-day chart trend ending with today's real-time date
function generateRecentChartTrend() {
  const now = new Date();
  const defaultYields = [94.2, 88.5, 96.0, 91.0, 86.4, 95.1, 91.4];
  return defaultYields.map((val, idx) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - idx));
    const dateStr = idx === 6
      ? `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} (Hari Ini)`
      : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return { date: dateStr, yield: val };
  });
}
let chartTrendHistory = generateRecentChartTrend();

// Date helpers for dynamic real-time display
function getLiveDateFull() {
  return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

function getLiveDateShort() {
  return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function updateLiveDates() {
  const fullDateStr = getLiveDateFull();
  const shortDateStr = getLiveDateShort();

  const kDate = document.getElementById('kitchenLiveDateHeader');
  if (kDate) kDate.textContent = fullDateStr;

  const oDate = document.getElementById('ownerLiveDateBadge');
  if (oDate) oDate.textContent = `Periode: ${shortDateStr}`;

  const cDate = document.getElementById('closeModalLiveDate');
  if (cDate) cDate.textContent = shortDateStr;

  const kStockBadge = document.getElementById('kitchenStockUpdatedBadge');
  if (kStockBadge) {
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    kStockBadge.textContent = `🕒 Diperbarui: Hari Ini ${timeStr} WIB`;
  }

  const randuFile = document.getElementById('randuFileNameText');
  if (randuFile) {
    const dateCompact = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }).replace(/\s+/g, '');
    randuFile.textContent = `Randu_Sales_${dateCompact}.csv`;
  }
}

// Fallback recipes database
const LOCAL_MENU_DB = {
  batagor: {
    name: "Batagor Super",
    perBatch: 100,
    ingredients: [
      { name: "Daging Ikan Tenggiri Giling", qty: 10.0, unit: "Kg" },
      { name: "Tepung Tapioka Super", qty: 7.0, unit: "Kg" },
      { name: "Tahu Putih Pabrik", qty: 100, unit: "Pcs" },
      { name: "Bumbu & Daun Bawang", qty: 1.2, unit: "Kg" }
    ]
  },
  pempek_lenjer: {
    name: "Pempek Lenjer",
    perBatch: 100,
    ingredients: [
      { name: "Daging Ikan Tenggiri Giling", qty: 10.0, unit: "Kg" },
      { name: "Tepung Tapioka Super", qty: 7.0, unit: "Kg" },
      { name: "Garam & Bumbu Racik", qty: 1.0, unit: "Kg" }
    ]
  },
  pempek_crispy: {
    name: "Pempek Crispy",
    perBatch: 80,
    ingredients: [
      { name: "Daging Ikan Kulit/Campur", qty: 8.0, unit: "Kg" },
      { name: "Tepung Tapioka Super", qty: 6.0, unit: "Kg" },
      { name: "Bumbu Crispy", qty: 1.0, unit: "Kg" }
    ]
  },
  pempek_adaan: {
    name: "Pempek Adaan",
    perBatch: 100,
    ingredients: [
      { name: "Daging Ikan Tenggiri Giling", qty: 10.0, unit: "Kg" },
      { name: "Tepung Tapioka Super", qty: 6.0, unit: "Kg" },
      { name: "Santan & Bawang Merah", qty: 2.0, unit: "Kg" }
    ]
  }
};

let locationsData = null;
let materialLogsData = [];

// Initial Load
window.addEventListener('DOMContentLoaded', async () => {
  updateLiveDates();
  initRecipesData();
  await fetchMasterData();
  await fetchInventorySummary();
  await fetchMaterialLogs();
  await fetchBatches();
  await fetchStoreStatus();
  renderKitchenStoreState();
  renderKitchenStockStatus();
  renderOwnerStoreStatus();
  renderMultiLocationCards();
  updateMenuSummary();
  renderIngredientsList();
  renderOwnerBatchTable();
  renderOwnerBomCards();
  setTimeout(() => drawChart(7), 150);

  // Check URL query parameters
  const params = new URLSearchParams(window.location.search);
  const screen = params.get('screen');

  if (screen === 'kitchen') loginAs('karyawan');
  else if (screen === 'owner') loginAs('owner');
  else if (screen) jumpToMockupView(screen);
});

function setScreenSimulation() {}

// --- API Helpers ---
async function fetchMasterData() {
  try {
    const res = await fetch('/api/master/products');
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        json.data.forEach(p => { productsData[p.key] = p; });
      }
    }
  } catch (err) {
    console.warn("Using local master fallback:", err.message);
  }
}

async function fetchInventorySummary() {
  try {
    const res = await fetch('/api/inventory/summary');
    if (res.ok) {
      const json = await res.json();
      if (json.cycle) {
        cycleData = json.cycle;
        updateCycleDOM();
      }
      if (json.locations) {
        locationsData = json.locations;
        renderMultiLocationCards();
      }
    }
  } catch (err) {
    console.warn("Using local inventory fallback:", err.message);
  }
}

async function fetchMaterialLogs() {
  try {
    const res = await fetch('/api/inventory/material-logs');
    if (res.ok) {
      const json = await res.json();
      if (json.logs) {
        materialLogsData = json.logs;
        renderMaterialLogs();
      }
    }
  } catch (err) {
    console.warn("Using local material logs fallback:", err.message);
  }
}

async function fetchBatches() {
  try {
    const res = await fetch('/api/production/batches');
    if (res.ok) {
      const json = await res.json();
      if (json.batches) {
        batchesData = json.batches;
        renderOwnerBatchTable();
      }
    }
  } catch (err) {
    console.warn("Using local batches fallback:", err.message);
  }
}

let storeStatusData = {
  isStoreOpened: false,
  openedAt: null,
  closedAt: null,
  closeDayRecord: null
};

async function fetchStoreStatus() {
  try {
    const res = await fetch('/api/production/status');
    if (res.ok) {
      const json = await res.json();
      if (json) {
        storeStatusData.isStoreOpened = Boolean(json.isStoreOpened);
        storeStatusData.openedAt = json.openedAt || null;
        storeStatusData.closedAt = json.closedAt || null;
        storeStatusData.closeDayRecord = json.closeDayRecord || null;

        localStorage.setItem('jeol_store_opened', storeStatusData.isStoreOpened ? 'true' : 'false');
        if (storeStatusData.openedAt) {
          localStorage.setItem('jeol_store_opened_at', storeStatusData.openedAt);
        } else {
          localStorage.removeItem('jeol_store_opened_at');
        }
        if (storeStatusData.closedAt) {
          localStorage.setItem('jeol_store_closed_at', storeStatusData.closedAt);
        } else {
          localStorage.removeItem('jeol_store_closed_at');
        }
        if (storeStatusData.closeDayRecord) {
          localStorage.setItem('jeol_close_day_record', JSON.stringify(storeStatusData.closeDayRecord));
        } else {
          localStorage.removeItem('jeol_close_day_record');
        }
        return;
      }
    }
  } catch (err) {
    console.warn("Using local store status fallback:", err.message);
  }

  // Local fallback for offline or standalone file:/// mode
  const saved = localStorage.getItem('jeol_store_opened') === 'true';
  storeStatusData.isStoreOpened = saved;
  storeStatusData.openedAt = localStorage.getItem('jeol_store_opened_at');
  storeStatusData.closedAt = localStorage.getItem('jeol_store_closed_at');
  try {
    const rec = localStorage.getItem('jeol_close_day_record');
    if (rec) storeStatusData.closeDayRecord = JSON.parse(rec);
  } catch {}
}

// --- Store State & Storage Helpers ---
function getStoreOpenedState() {
  if (storeStatusData && typeof storeStatusData.isStoreOpened === 'boolean') {
    return storeStatusData.isStoreOpened;
  }
  const saved = localStorage.getItem('jeol_store_opened');
  return saved === 'true';
}

function setStoreOpenedState(opened, timeStr = null) {
  storeStatusData.isStoreOpened = opened;
  localStorage.setItem('jeol_store_opened', opened ? 'true' : 'false');
  if (opened && timeStr) {
    storeStatusData.openedAt = timeStr;
    localStorage.setItem('jeol_store_opened_at', timeStr);
  } else if (!opened) {
    storeStatusData.openedAt = null;
    localStorage.removeItem('jeol_store_opened_at');
  }
  renderKitchenStoreState();
  renderKitchenStockStatus();
  renderOwnerStoreStatus();
}

function renderKitchenStoreState() {
  const isOpened = getStoreOpenedState();
  const closedEl = document.getElementById('kStoreClosedState');
  const openEl = document.getElementById('kStoreOpenState');
  const badge = document.getElementById('storeBadgeHeader');
  const savedTime = storeStatusData.openedAt || localStorage.getItem('jeol_store_opened_at') || '08:00 WIB';

  if (isOpened) {
    if (closedEl) closedEl.classList.add('hidden');
    if (openEl) openEl.classList.remove('hidden');
    if (badge) {
      badge.className = "text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1";
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Toko Dibuka (${savedTime})`;
    }
  } else {
    if (closedEl) closedEl.classList.remove('hidden');
    if (openEl) openEl.classList.add('hidden');
    if (badge) {
      badge.className = "text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1";
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> ⏸️ Toko Belum Dibuka`;
    }
  }
}

function renderOwnerStoreStatus() {
  const pill = document.getElementById('ownerStoreStatusPill');
  const banner = document.getElementById('ownerStoreStatusBanner');

  const isOpened = getStoreOpenedState();
  const openedAt = storeStatusData.openedAt || localStorage.getItem('jeol_store_opened_at') || '08:00 WIB';
  const closedAt = storeStatusData.closedAt || localStorage.getItem('jeol_store_closed_at') || '17:00 WIB';
  let closeRec = storeStatusData.closeDayRecord;
  if (!closeRec) {
    try {
      const saved = localStorage.getItem('jeol_close_day_record');
      if (saved) closeRec = JSON.parse(saved);
    } catch {}
  }

  // Update Sidebar Status Pill
  if (pill) {
    if (isOpened) {
      pill.className = "text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 flex items-center gap-1.5 border border-emerald-200 shadow-2xs";
      pill.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> <span>Shift Aktif (${openedAt})</span>`;
    } else {
      pill.className = "text-[11px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 flex items-center gap-1.5 border border-slate-200";
      pill.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-400"></span> <span>Shift Ditutup (${closeRec ? closeRec.closedAt : closedAt})</span>`;
    }
  }

  // Update Summary Tab Status Banner
  if (banner) {
    if (isOpened) {
      banner.className = "bg-gradient-to-r from-emerald-50/90 to-teal-50/60 border border-emerald-200 rounded-3xl p-5 shadow-sm transition-all";
      banner.innerHTML = `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold shrink-0 shadow-inner">
              ☀️
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-slate-800 text-sm sm:text-base">Status Operasional: Kedai & Dapur Sedang Buka</h4>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider animate-pulse">Shift Aktif</span>
              </div>
              <p class="text-xs text-slate-600 mt-0.5">Dapur dibuka pada pukul <strong class="text-slate-800">${openedAt}</strong> oleh Karyawan. Seluruh modul pencatatan resep & batch produksi siap digunakan.</p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Dapur Beroperasi
            </span>
          </div>
        </div>
      `;
    } else if (closeRec) {
      const isCocok = closeRec.difference === 0;
      banner.className = "bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3 transition-all";
      banner.innerHTML = `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-2xl bg-blue-50 text-[#0F2C59] flex items-center justify-center text-2xl font-bold shrink-0 shadow-inner">
              🔒
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-slate-800 text-sm sm:text-base">Laporan Rekonsiliasi Tutup Shift Terakhir</h4>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isCocok ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}">
                  ${isCocok ? '✓ Cocok Sempurna' : '⚠️ Ada Selisih'}
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">Shift ditutup pada pukul <strong class="text-slate-700">${closeRec.closedAt}</strong> (${closeRec.date || 'Hari Ini'}) oleh Karyawan Dapur. Data telah tersimpan permanen di database.</p>
            </div>
          </div>
          <span class="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            Shift Selesai & Terkunci
          </span>
        </div>
        
        <!-- Grid Rekap Hitung Fisik Lapangan -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span class="text-slate-400 text-[10px] block font-medium">Sisa di Kedai (Siap Saji):</span>
            <span class="font-bold text-slate-800 text-sm">${closeRec.physicalKedai} Pcs</span>
          </div>
          <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span class="text-slate-400 text-[10px] block font-medium">Sisa di Freezer Cadangan:</span>
            <span class="font-bold text-slate-800 text-sm">${closeRec.physicalFreezer} Pcs</span>
          </div>
          <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span class="text-slate-400 text-[10px] block font-medium">Total Fisik Terhitung:</span>
            <span class="font-black text-[#0F2C59] text-sm">${closeRec.totalPhysical} Pcs</span>
          </div>
          <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span class="text-slate-400 text-[10px] block font-medium">Selisih Buku vs Fisik:</span>
            <span class="font-black text-sm ${isCocok ? 'text-emerald-600' : 'text-amber-600'}">
              ${isCocok ? '0 Pcs (Seimbang ✓)' : `${closeRec.difference > 0 ? '+' : ''}${closeRec.difference} Pcs`}
            </span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
          <span class="flex items-center gap-1 font-medium text-emerald-700">✓ Kompor & Gas Dipadamkan</span>
          <span class="flex items-center gap-1 font-medium text-emerald-700">✓ Suhu Freezer Normal (-18°C) & Terkunci</span>
          ${closeRec.notes ? `<span class="italic text-slate-400 truncate">"${closeRec.notes}"</span>` : ''}
        </div>
      `;
    } else {
      banner.className = "bg-white rounded-3xl border border-slate-200 p-5 shadow-sm transition-all";
      banner.innerHTML = `
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center text-2xl font-bold shrink-0">
            🏪
          </div>
          <div>
            <h4 class="font-bold text-slate-800 text-sm sm:text-base">Status Operasional: Toko Belum Dibuka Hari Ini</h4>
            <p class="text-xs text-slate-500 mt-0.5">Karyawan dapur belum memulai shift hari ini. Menunggu pembukaan toko via portal Karyawan.</p>
          </div>
        </div>
      `;
    }
  }
}

// --- Smooth Floating Toast Notification ---
function showToast(title, message, type = 'success') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bgStyles = type === 'success' 
    ? 'bg-emerald-600 text-white' 
    : type === 'warning' 
    ? 'bg-amber-600 text-white' 
    : 'bg-[#0F2C59] text-white';

  toast.className = `${bgStyles} shadow-2xl rounded-2xl p-4 flex items-start gap-3 pointer-events-auto transform transition-all duration-300 translate-y-[-20px] opacity-0 border border-white/20`;
  
  const icon = type === 'success' ? '☀️' : (type === 'warning' ? '⚠️' : 'ℹ️');
  toast.innerHTML = `
    <div class="text-xl shrink-0">${icon}</div>
    <div class="flex-1">
      <div class="font-bold text-sm leading-snug">${title}</div>
      ${message ? `<div class="text-xs text-white/90 mt-0.5 leading-snug">${message}</div>` : ''}
    </div>
  `;

  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-[-20px]', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

// --- Live Kitchen Stock Status & Recommendation ---
function renderKitchenStockStatus() {
  const container = document.getElementById('kitchenStockCardsContainer');
  const badge = document.getElementById('kitchenStockUpdatedBadge');
  const recText = document.getElementById('kitchenRecommendationText');
  if (!container) return;

  // Base starting stocks at 08:00 WIB (sebelum produksi hari ini)
  const baseStocks = {
    batagor: { key: 'batagor', name: 'Batagor Super', icon: '🥢', stock: 12, minSafe: 20 },
    pempek_crispy: { key: 'pempek_crispy', name: 'Pempek Crispy', icon: '✨', stock: 16, minSafe: 20 },
    pempek_lenjer: { key: 'pempek_lenjer', name: 'Pempek Lenjer', icon: '🥟', stock: 48, minSafe: 25 },
    pempek_adaan: { key: 'pempek_adaan', name: 'Pempek Adaan', icon: '🧆', stock: 65, minSafe: 25 }
  };

  // Akumulasikan semua batch yang telah dimasak hari ini
  let latestTime = null;
  const records = batchesData.length ? batchesData : [];
  records.forEach(b => {
    let key = b.productKey;
    if (!key && b.product) {
      const lower = b.product.toLowerCase();
      if (lower.includes('batagor')) key = 'batagor';
      else if (lower.includes('crispy')) key = 'pempek_crispy';
      else if (lower.includes('lenjer')) key = 'pempek_lenjer';
      else if (lower.includes('adaan')) key = 'pempek_adaan';
    }
    if (key && baseStocks[key]) {
      baseStocks[key].stock += (Number(b.actual) || 0);
      if (b.time) latestTime = b.time;
    }
  });

  // Tentukan status dan warna kartu secara dinamis
  const items = Object.values(baseStocks);
  items.forEach(p => {
    if (p.stock <= 15) {
      p.status = 'KRITIS!';
      p.alertText = '⚠️ Sisa di kedai hampir habis';
      p.borderClass = 'border-2 border-rose-300 hover:border-rose-400 bg-white';
      p.badgeClass = 'bg-rose-100 text-rose-800';
      p.numClass = 'text-rose-600';
      p.alertClass = 'text-rose-700';
    } else if (p.stock <= 30) {
      p.status = 'MENIPIS';
      p.alertText = 'Prioritas kedua';
      p.borderClass = 'border border-amber-300 hover:border-amber-400 bg-white';
      p.badgeClass = 'bg-amber-100 text-amber-800';
      p.numClass = 'text-amber-600';
      p.alertClass = 'text-amber-700';
    } else {
      p.status = 'AMAN ✓';
      p.alertText = 'Stok cukup & melimpah';
      p.borderClass = 'border border-slate-200 hover:border-slate-300 bg-white';
      p.badgeClass = 'bg-emerald-100 text-emerald-800';
      p.numClass = 'text-slate-800';
      p.alertClass = 'text-emerald-700';
    }
  });

  // Render 4 kartu stok dinamis
  container.innerHTML = items.map(p => `
    <div onclick="selectMenuCard('${p.key}')" class="cursor-pointer p-3 rounded-xl shadow-2xs transition ${p.borderClass}">
      <div class="flex justify-between items-start">
        <span class="text-[11px] font-semibold text-slate-600">${p.icon} ${p.name}</span>
        <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded ${p.badgeClass}">${p.status}</span>
      </div>
      <div class="text-xl font-black mt-1 ${p.numClass}">
        ${p.stock} <span class="text-xs font-semibold text-slate-500">Pcs</span>
      </div>
      <div class="text-[10px] font-medium mt-0.5 ${p.alertClass}">
        ${p.alertText}
      </div>
    </div>
  `).join('');

  // Update badge waktu pembaharuan
  if (badge) {
    if (latestTime) {
      badge.textContent = `🕒 Diperbarui: ${latestTime} (Real-time)`;
    } else {
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      badge.textContent = `🕒 Diperbarui: Hari Ini ${timeStr} WIB`;
    }
  }

  // Update Kotak Rekomendasi "Saran Dapur Hari Ini"
  if (recText) {
    const sorted = [...items].sort((a, b) => a.stock - b.stock);
    const lowest = sorted[0];

    if (lowest && lowest.stock <= 30) {
      recText.innerHTML = `<strong>Saran Dapur Hari Ini:</strong> Stok sisa <strong>${lowest.name}</strong> tersisa <strong>${lowest.stock} Pcs</strong> (di bawah batas aman ${lowest.minSafe} Pcs). Sistem menyarankan untuk membuat <strong>Target 200 Pcs ${lowest.name}</strong> berikutnya!`;
    } else {
      recText.innerHTML = `<strong>Saran Dapur Hari Ini:</strong> Seluruh menu saat ini berstatus <strong>AMAN ✓</strong> (${sorted.map(s => `${s.name}: ${s.stock} Pcs`).join(', ')}). Dapur dapat memasak batch reguler atau persiapan stok freezer beku.`;
    }
  }
}

function updateCycleDOM() {
  updateLiveDates();
  const elAwal = document.getElementById('cycleStokAwal');
  const elMasuk = document.getElementById('cycleProduksiMasuk');
  const elJual = document.getElementById('cyclePenjualanKeluar');
  const elSampel = document.getElementById('cycleSampelKeluar');
  const elAkhir = document.getElementById('cycleStokAkhir');
  const elFisikBreakdown = document.getElementById('cycleFisikBreakdown');
  const elFormulaText = document.getElementById('cycleFormulaText');
  const elOpnameBadge = document.getElementById('cycleOpnameBadge');

  if (elAwal && cycleData.stokAwal !== undefined) elAwal.innerHTML = `${cycleData.stokAwal} <span class="text-xs font-normal">Pcs</span>`;
  if (elMasuk && cycleData.masukProduksi !== undefined) elMasuk.innerHTML = `+${cycleData.masukProduksi} <span class="text-xs font-normal">Pcs</span>`;
  if (elJual && cycleData.keluarPenjualanRandu !== undefined) elJual.innerHTML = `-${cycleData.keluarPenjualanRandu} <span class="text-xs font-normal">Pcs</span>`;
  if (elSampel && cycleData.keluarSampel !== undefined) elSampel.innerHTML = `-${cycleData.keluarSampel} <span class="text-xs font-normal">Pcs</span>`;
  if (elAkhir && cycleData.sisaAkhirBuku !== undefined) elAkhir.innerHTML = `${cycleData.sisaAkhirBuku} <span class="text-xs font-normal">Pcs</span>`;

  if (elFisikBreakdown && cycleData.sisaFisikKedai !== undefined && cycleData.sisaFisikFreezer !== undefined) {
    elFisikBreakdown.textContent = `${cycleData.sisaFisikKedai} Kedai • ${cycleData.sisaFisikFreezer} Freezer`;
  }
  if (elFormulaText && cycleData.stokAwal !== undefined) {
    elFormulaText.innerHTML = `Stok Akhir = ${cycleData.stokAwal} (Awal) + ${cycleData.masukProduksi} (Masak) - ${cycleData.keluarPenjualanRandu} (Jual) - ${cycleData.keluarSampel} (Sampel) = <strong>${cycleData.sisaAkhirBuku} Pcs</strong>`;
  }
  if (elOpnameBadge) {
    const diff = cycleData.selisih !== undefined ? cycleData.selisih : ((cycleData.totalFisikHitung || 0) - (cycleData.sisaAkhirBuku || 0));
    if (diff === 0) {
      elOpnameBadge.className = "text-emerald-700 font-bold bg-emerald-100/60 px-2.5 py-0.5 rounded-lg flex items-center gap-1";
      elOpnameBadge.innerHTML = `<span>✓ Opname Fisik Akhir: Cocok (0 Selisih)</span>`;
    } else {
      elOpnameBadge.className = "text-amber-700 font-bold bg-amber-100/60 px-2.5 py-0.5 rounded-lg flex items-center gap-1";
      elOpnameBadge.innerHTML = `<span>⚠️ Selisih Fisik: ${diff > 0 ? '+' : ''}${diff} Pcs</span>`;
    }
  }
}

// --- Authentication ---
let selectedLoginRole = 'karyawan';

function selectRoleForLogin(role) {
  selectedLoginRole = role;
  document.getElementById('loginStepRole').classList.add('hidden');
  document.getElementById('loginStepPin').classList.remove('hidden');
  
  const alertEl = document.getElementById('loginPinAlert');
  if (alertEl) alertEl.classList.add('hidden');
  
  const pinInput = document.getElementById('pinInput');
  if (pinInput) {
    pinInput.value = '';
    pinInput.focus();
  }

  const titleEl = document.getElementById('loginRoleTitle');
  const avatarEl = document.getElementById('loginRoleAvatar');
  if (role === 'karyawan') {
    if (titleEl) titleEl.innerText = "Karyawan";
    if (avatarEl) {
      avatarEl.innerText = "👨‍🍳";
      avatarEl.className = "w-14 h-14 rounded-2xl bg-blue-100 text-[#0F2C59] flex items-center justify-center font-bold text-3xl mx-auto shadow-xs mb-2";
    }
  } else {
    if (titleEl) titleEl.innerText = "Owner";
    if (avatarEl) {
      avatarEl.innerText = "👑";
      avatarEl.className = "w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-3xl mx-auto shadow-xs mb-2";
    }
  }
}

function backToRoleSelect() {
  document.getElementById('loginStepPin').classList.add('hidden');
  document.getElementById('loginStepRole').classList.remove('hidden');
  const pinInput = document.getElementById('pinInput');
  if (pinInput) pinInput.value = '';
  const alertEl = document.getElementById('loginPinAlert');
  if (alertEl) alertEl.classList.add('hidden');
}

function appendPinDigit(digit) {
  const input = document.getElementById('pinInput');
  if (input && input.value.length < 4) {
    input.value += digit;
    if (input.value.length === 4) {
      handlePinLogin();
    }
  }
}

function clearPinInput() {
  const input = document.getElementById('pinInput');
  if (input) input.value = '';
  const alertEl = document.getElementById('loginPinAlert');
  if (alertEl) alertEl.classList.add('hidden');
}

function backspacePinInput() {
  const input = document.getElementById('pinInput');
  if (input && input.value.length > 0) {
    input.value = input.value.slice(0, -1);
  }
}

async function handlePinLogin() {
  const pin = document.getElementById('pinInput').value.trim();
  const alertEl = document.getElementById('loginPinAlert');
  if (!pin) {
    if (alertEl) {
      alertEl.innerText = "Silakan masukkan 4 digit PIN.";
      alertEl.classList.remove('hidden');
    }
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, role: selectedLoginRole })
    });
    const json = await res.json();
    if (json.success && json.user) {
      loginAs(json.user.role);
    } else {
      if (alertEl) {
        alertEl.innerText = json.message || "PIN tidak sesuai.";
        alertEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    // Local fallback with strict role validation
    if (selectedLoginRole === 'karyawan') {
      if (pin === '1234') {
        loginAs('karyawan');
      } else {
        if (alertEl) {
          alertEl.innerText = "PIN tidak sesuai untuk peran Karyawan. Gunakan PIN 1234.";
          alertEl.classList.remove('hidden');
        }
      }
    } else if (selectedLoginRole === 'owner') {
      if (pin === '8888') {
        loginAs('owner');
      } else {
        if (alertEl) {
          alertEl.innerText = "PIN tidak sesuai untuk peran Owner. Gunakan PIN 8888.";
          alertEl.classList.remove('hidden');
        }
      }
    }
  }
}

async function loginAs(role) {
  currentRole = role;
  document.getElementById('screenLogin').classList.add('hidden');

  await fetchStoreStatus();
  renderKitchenStoreState();
  renderKitchenStockStatus();
  renderOwnerStoreStatus();

  if (role === 'karyawan') {
    document.getElementById('screenKitchen').classList.remove('hidden');
    document.getElementById('screenOwner').classList.add('hidden');
    await fetchBatches();
    renderKitchenStoreState();
    renderKitchenStockStatus();
  } else {
    document.getElementById('screenKitchen').classList.add('hidden');
    document.getElementById('screenOwner').classList.remove('hidden');
    await fetchInventorySummary();
    await fetchBatches();
    setOwnerTab('summary');
    renderOwnerStoreStatus();
    renderOwnerKpiCards();
    updateCycleDOM();
    renderOwnerBatchTable();
    renderOwnerInventoryTable();
    renderOwnerBomCards();
    setTimeout(() => drawChart(7), 150);
  }
}

function logout() {
  currentRole = null;
  document.getElementById('screenKitchen').classList.add('hidden');
  document.getElementById('screenOwner').classList.add('hidden');
  document.getElementById('screenLogin').classList.remove('hidden');
  backToRoleSelect();
  closeOwnerMobileSidebar();
}

// --- Kitchen: Buka Toko (Open Day) ---
async function handleBukaToko() {
  const openTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";

  try {
    const res = await fetch('/api/production/open-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operatorName: "Karyawan" })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.openedAt) {
        storeStatusData.openedAt = json.openedAt;
      }
      if (json && json.cycle) {
        cycleData = json.cycle;
      }
    }
  } catch (err) {
    console.warn("Using offline fallback for open store:", err.message);
  }

  await fetchInventorySummary();
  await fetchBatches();

  storeStatusData.isStoreOpened = true;
  storeStatusData.openedAt = openTime;
  storeStatusData.closeDayRecord = null;
  localStorage.setItem('jeol_store_opened', 'true');
  localStorage.setItem('jeol_store_opened_at', openTime);
  localStorage.removeItem('jeol_close_day_record');
  localStorage.removeItem('jeol_store_closed_at');

  renderKitchenStoreState();
  renderKitchenStockStatus();
  renderOwnerStoreStatus();
  showToast("Toko & Dapur Resmi Dibuka!", `Jam buka: ${openTime}. Seluruh modul produksi telah aktif. Selamat bekerja!`, "success");
}

// --- Kitchen: Menu & Batch Selection ---
function filterKitchenCategory(cat) {
  ['all', 'pempek', 'batagor', 'cuko'].forEach(c => {
    const btn = document.getElementById('catBtn_' + c);
    if (!btn) return;
    if (c === cat) {
      btn.className = "cat-chip touch-target px-4 py-2 rounded-2xl text-xs font-bold border-2 border-[#3A86FF] bg-blue-50 text-[#0F2C59] transition flex items-center gap-1.5 shadow-2xs";
    } else {
      btn.className = "cat-chip touch-target px-4 py-2 rounded-2xl text-xs font-bold border-2 border-slate-200 bg-white text-slate-600 hover:border-slate-300 transition flex items-center gap-1.5";
    }
  });

  const cards = document.querySelectorAll('.menu-card');
  cards.forEach(card => {
    if (cat === 'all') {
      card.classList.remove('hidden');
    } else if (cat === 'pempek' && card.id.includes('pempek')) {
      card.classList.remove('hidden');
    } else if (cat === 'batagor' && card.id.includes('batagor')) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
}

function selectMenuCard(key) {
  selectedMenuKey = key;
  ['batagor', 'pempek_lenjer', 'pempek_crispy', 'pempek_adaan'].forEach(k => {
    const card = document.getElementById('card_' + k);
    const check = document.getElementById('check_' + k);
    if (!card) return;
    if (k === key) {
      card.className = "menu-card cursor-pointer touch-target p-4 rounded-2xl border-2 border-[#3A86FF] bg-blue-50/50 shadow-md transition flex items-center justify-between";
      if (check) check.classList.remove('hidden');
    } else {
      card.className = "menu-card cursor-pointer touch-target p-4 rounded-2xl border-2 border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-xs flex items-center justify-between";
      if (check) check.classList.add('hidden');
    }
  });

  updateMenuSummary();
  renderIngredientsList();
}

function handleManualTargetChange(val) {
  let num = parseInt(val) || 0;
  if (num < 1) num = 1;
  currentTargetPcs = num;
  updateTargetPresetButtons(currentTargetPcs);
  updateMenuSummary();
  renderIngredientsList();
}

function modifyManualTarget(delta) {
  let target = (currentTargetPcs || 200) + delta;
  if (target < 10) target = 10;
  const inp = document.getElementById('manualTargetInput');
  if (inp) inp.value = target;
  handleManualTargetChange(target);
}

function setManualTargetPreset(val) {
  const inp = document.getElementById('manualTargetInput');
  if (inp) inp.value = val;
  handleManualTargetChange(val);
}

function updateTargetPresetButtons(val) {
  [50, 100, 200, 300, 400, 500].forEach(p => {
    const btn = document.getElementById('targetPreset' + p);
    if (!btn) return;
    if (val === p) {
      btn.className = "px-3 py-1.5 rounded-xl border-2 border-[#3A86FF] bg-blue-100 text-xs font-bold text-[#0F2C59] shadow-2xs";
    } else {
      btn.className = "px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-[#3A86FF]";
    }
  });
}

function setDirectBatch(num) {
  const menu = LOCAL_MENU_DB[selectedMenuKey] || LOCAL_MENU_DB.batagor;
  const target = (menu.perBatch || 100) * num;
  setManualTargetPreset(target);
}

function modifyBatch(delta) {
  modifyManualTarget(delta * 50);
}

function updateMenuSummary() {
  const menu = LOCAL_MENU_DB[selectedMenuKey] || LOCAL_MENU_DB.batagor;
  const target = currentTargetPcs || 200;
  const summaryBatch = document.getElementById('summaryBatchText');
  const summaryTarget = document.getElementById('summaryTargetOutputText');

  if (summaryBatch) summaryBatch.innerText = menu.name;
  if (summaryTarget) summaryTarget.innerText = `${target} Pcs`;
}

function renderIngredientsList() {
  const container = document.getElementById('recipeIngredientCards');
  if (!container) return;
  container.innerHTML = '';

  const menu = LOCAL_MENU_DB[selectedMenuKey] || LOCAL_MENU_DB.batagor;
  const standardYield = menu.perBatch || 100;
  const ratio = (currentTargetPcs || 200) / standardYield;

  menu.ingredients.forEach((ing, index) => {
    const totalQty = (ing.qty * ratio).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1');
    const div = document.createElement('div');
    div.className = "flex items-center justify-between p-3 sm:p-3.5 bg-slate-50 border border-slate-200 rounded-2xl hover:border-blue-300 transition";
    div.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-2.5 h-2.5 rounded-full bg-[#1E4E8C]"></span>
        <div>
          <span class="font-bold text-xs text-slate-800">${ing.name}</span>
          <span class="text-[10px] text-slate-400 block">Standar formula: ${ing.qty} ${ing.unit} per ${standardYield} Pcs</span>
        </div>
      </div>
      <div class="flex items-center gap-1.5 sm:gap-2">
        <span class="text-[11px] text-slate-500 font-semibold hidden sm:inline">Timbangan:</span>
        <input type="number" step="0.01" min="0" 
          id="ing_input_${index}" 
          data-index="${index}" 
          data-name="${ing.name}" 
          data-unit="${ing.unit}" 
          value="${totalQty}" 
          class="ingredient-qty-input w-20 sm:w-24 p-1.5 sm:p-2 text-right font-black text-xs sm:text-sm text-[#0F2C59] bg-white border-2 border-slate-200 focus:border-[#3A86FF] focus:bg-white rounded-xl shadow-inner transition outline-none" />
        <span class="text-xs text-slate-600 font-bold w-6 sm:w-7 text-left">${ing.unit}</span>
      </div>
    `;
    container.appendChild(div);
  });
}

function getEditedIngredients() {
  const menu = LOCAL_MENU_DB[selectedMenuKey] || LOCAL_MENU_DB.batagor;
  const inputs = document.querySelectorAll('#recipeIngredientCards .ingredient-qty-input');
  if (inputs.length > 0) {
    return Array.from(inputs).map(inp => {
      const idx = parseInt(inp.getAttribute('data-index'));
      const originalIng = menu.ingredients[idx] || {};
      const val = parseFloat(inp.value) || 0;
      return {
        name: inp.getAttribute('data-name') || originalIng.name,
        qty: val,
        unit: inp.getAttribute('data-unit') || originalIng.unit || 'Kg',
        costPerUnit: originalIng.costPerUnit || 0
      };
    });
  }
  const ratio = (currentTargetPcs || 200) / (menu.perBatch || 100);
  return menu.ingredients.map(ing => ({
    name: ing.name,
    qty: parseFloat((ing.qty * ratio).toFixed(2)),
    unit: ing.unit,
    costPerUnit: ing.costPerUnit || 0
  }));
}

// --- Kitchen: Production Stepper ---
async function handleStartProduction() {
  const menu = LOCAL_MENU_DB[selectedMenuKey] || LOCAL_MENU_DB.batagor;
  const target = currentTargetPcs || 200;
  const editedIngredients = getEditedIngredients();

  try {
    const res = await fetch('/api/production/batch/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        productKey: selectedMenuKey, 
        targetOutput: target,
        ingredients: editedIngredients 
      })
    });
    if (res.ok) {
      const json = await res.json();
      activeBatchData = json.batch;
    }
  } catch (err) {}

  document.getElementById('stageSelectMenu').classList.add('hidden');
  document.getElementById('stageRunning').classList.remove('hidden');

  document.getElementById('kStepperStageText').innerText = "Tahap 2: Proses Masak Berjalan";
  document.getElementById('barStage2').className = "h-2 rounded-full bg-[#3A86FF] transition-all";

  document.getElementById('runMenuName').innerText = menu.name;
  document.getElementById('runBatchInfo').innerText = `Target: ${target} Pcs • Takaran telah disesuaikan`;
}

function handleFinishCooking() {
  document.getElementById('stageRunning').classList.add('hidden');
  document.getElementById('stageFinish').classList.remove('hidden');

  document.getElementById('kStepperStageText').innerText = "Tahap 3: Cek Hasil & Yield RAG";
  document.getElementById('barStage3').className = "h-2 rounded-full bg-[#3A86FF] transition-all";

  const target = currentTargetPcs || 200;
  const targetEl = document.getElementById('stage3TargetText');
  if (targetEl) targetEl.innerText = `${target} Pcs`;

  const actualInp = document.getElementById('actualOutputInput');
  if (actualInp) actualInp.value = Math.max(1, Math.round(target * 0.95));

  handleActualInputChange();
}

function handleActualInputChange() {
  const target = currentTargetPcs || 200;
  const actual = parseInt(document.getElementById('actualOutputInput').value) || 0;
  const yieldPct = ((actual / target) * 100).toFixed(1);
  const diff = actual - target;

  const badge = document.getElementById('yieldResultBadge');
  const diffText = document.getElementById('yieldDiffText');
  const box = document.getElementById('yieldResultContainer');

  if (yieldPct >= 90.0) {
    badge.innerText = `${yieldPct}% (Hijau - Optimal)`;
    badge.className = "px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800";
    box.className = "p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 flex items-center justify-between";
  } else if (yieldPct >= 80.0) {
    badge.innerText = `${yieldPct}% (Kuning - Peringatan)`;
    badge.className = "px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800";
    box.className = "p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/50 flex items-center justify-between";
  } else {
    badge.innerText = `${yieldPct}% (Merah - Anomali)`;
    badge.className = "px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800";
    box.className = "p-4 rounded-2xl border-2 border-red-200 bg-red-50/50 flex items-center justify-between";
  }

  diffText.innerText = `${diff > 0 ? '+' : ''}${diff} Pcs`;
  diffText.className = diff < 0 ? "font-bold text-red-600 text-xs mt-1" : "font-bold text-emerald-600 text-xs mt-1";
}

function toggleReasonPill(btn, text) {
  if (selectedReasons.includes(text)) {
    selectedReasons = selectedReasons.filter(r => r !== text);
    btn.className = "reason-pill touch-target px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:border-slate-300 transition";
    btn.innerHTML = `<span>${text}</span>`;
  } else {
    selectedReasons.push(text);
    btn.className = "reason-pill touch-target px-3.5 py-2 rounded-xl text-xs font-bold border border-amber-300 bg-amber-100 text-amber-900 transition";
    btn.innerHTML = `<span>✓ ${text}</span>`;
  }
}

async function handleSaveYieldToAllocate() {
  const actual = parseInt(document.getElementById('actualOutputInput').value) || 0;
  const reasonCode = selectedReasons.join(", ") || "Normal";
  const customNote = document.getElementById('customReasonInput')?.value || "";

  try {
    await fetch('/api/production/batch/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actualOutput: actual, reasonCode, customNote })
    });
  } catch (err) {}

  document.getElementById('stageFinish').classList.add('hidden');
  document.getElementById('stageAllocate').classList.remove('hidden');

  document.getElementById('allocTargetNumber').innerText = actual;
  document.getElementById('allocFreezerVal').value = Math.max(0, actual - 50);
  document.getElementById('allocOutletVal').value = Math.min(50, actual);

  document.getElementById('kStepperStageText').innerText = "Tahap 4: Simpan ke Freezer & Kedai";
  document.getElementById('barStage4').className = "h-2 rounded-full bg-emerald-500 transition-all";

  checkAllocBalance();
}

function checkAllocBalance() {
  const avail = parseInt(document.getElementById('allocTargetNumber').innerText) || 0;
  const f = parseInt(document.getElementById('allocFreezerVal').value) || 0;
  const o = parseInt(document.getElementById('allocOutletVal').value) || 0;
  const total = f + o;

  document.getElementById('allocSumNumber').innerText = `${total} Pcs`;
  const badge = document.getElementById('allocStatusBadge');
  if (total === avail) {
    badge.innerText = "(Cocok ✓)";
    badge.className = "ml-1 text-emerald-600 font-bold";
  } else {
    badge.innerText = `(Selisih ${total - avail} Pcs)`;
    badge.className = "ml-1 text-red-600 font-bold";
  }
}

async function commitCurrentAllocation() {
  const f = parseInt(document.getElementById('allocFreezerVal').value) || 0;
  const o = parseInt(document.getElementById('allocOutletVal').value) || 0;

  try {
    const res = await fetch('/api/production/batch/allocate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toFreezer: f, toKedai: o })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.batch) {
        if (!batchesData.some(b => b.id === json.batch.id)) {
          batchesData.unshift({
            id: json.batch.id,
            time: json.batch.startedAt || new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB",
            product: json.batch.productName,
            usedBahan: (json.batch.requiredIngredients || []).map(i => `${i.qty} ${i.unit} ${i.name}`).join(", "),
            target: json.batch.targetOutput,
            actual: json.batch.actual,
            yield: json.batch.yield,
            reason: json.batch.reason,
            status: json.batch.ragStatus
          });
        }
      }
    }
  } catch (err) {
    console.warn("Using local allocation fallback:", err.message);
  }

  await fetchBatches();
  await fetchInventorySummary();
  renderKitchenStockStatus();
  renderOwnerBatchTable();
  renderOwnerKpiCards();
  renderOwnerInventoryTable();
  updateCycleDOM();
  return true;
}

async function handleSaveAndFinishBatch() {
  await commitCurrentAllocation();
  showToast("✓ Batch Berhasil Disimpan!", "Stok produk telah bertambah & siap untuk membuat batch berikutnya.", "success");

  document.getElementById('stageAllocate').classList.add('hidden');
  document.getElementById('stageFinish').classList.add('hidden');
  document.getElementById('stageRunning').classList.add('hidden');
  document.getElementById('stageSelectMenu').classList.remove('hidden');

  document.getElementById('kStepperStageText').innerText = "Tahap 1: Target Produksi (Batch Baru)";
  document.getElementById('barStage2').className = "h-2 rounded-full bg-slate-200 transition-all";
  document.getElementById('barStage3').className = "h-2 rounded-full bg-slate-200 transition-all";
  document.getElementById('barStage4').className = "h-2 rounded-full bg-slate-200 transition-all";

  // Re-render ingredients & summary for new batch
  updateMenuSummary();
  renderIngredientsList();

  const workbench = document.getElementById('kitchenWorkbench');
  if (workbench) {
    workbench.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function handleLoopNextBatch() {
  return handleSaveAndFinishBatch();
}

async function handleCloseStoreFromAllocate() {
  await commitCurrentAllocation();
  openCloseDayModal();
}

// --- Close Day Modal ---
function openCloseDayModal() {
  const stageAlloc = document.getElementById('stageAllocate');
  if (stageAlloc && !stageAlloc.classList.contains('hidden')) {
    commitCurrentAllocation();
  }

  const modal = document.getElementById('modalCloseDay');
  if (!modal) return;
  modal.classList.remove('hidden');

  const masakEl = document.getElementById('closeModalTotalMasak');
  const keluarEl = document.getElementById('closeModalTotalKeluar');
  const expectedEl = document.getElementById('closeModalExpectedStock');
  const kedaiInput = document.getElementById('closeCountKedai');
  const freezerInput = document.getElementById('closeCountFreezer');

  const totalMasak = cycleData.masukProduksi !== undefined ? Number(cycleData.masukProduksi) : 640;
  const batchCount = totalMasak === 0 ? 0 : (batchesData.length || 0);
  const keluarJual = cycleData.keluarPenjualanRandu || 0;
  const keluarSampel = cycleData.keluarSampel || 0;
  const totalKeluar = keluarJual + keluarSampel;
  const expectedStock = cycleData.sisaAkhirBuku !== undefined ? Number(cycleData.sisaAkhirBuku) : (cycleData.stokAwal + totalMasak - totalKeluar);

  if (masakEl) {
    masakEl.textContent = `${totalMasak} Pcs (${batchCount} Batch)`;
  }
  if (keluarEl) {
    if (keluarJual > 0) {
      keluarEl.textContent = `${totalKeluar} Pcs (Jual + Sampel)`;
    } else if (keluarSampel > 0) {
      keluarEl.textContent = `${totalKeluar} Pcs (${keluarSampel} Sampel, Menunggu Randu)`;
    } else {
      keluarEl.textContent = `0 Pcs (Menunggu Import Randu)`;
    }
  }
  if (expectedEl) {
    expectedEl.textContent = `${expectedStock} Pcs`;
  }
  if (kedaiInput && (!kedaiInput.value || kedaiInput.value === '0')) {
    kedaiInput.value = cycleData.sisaFisikKedai || 65;
  }
  if (freezerInput && (!freezerInput.value || freezerInput.value === '0')) {
    freezerInput.value = cycleData.sisaFisikFreezer || 290;
  }

  calculateCloseDifference();
}
function closeCloseDayModal() {
  document.getElementById('modalCloseDay').classList.add('hidden');
}
function calculateCloseDifference() {
  const k = parseInt(document.getElementById('closeCountKedai').value) || 0;
  const f = parseInt(document.getElementById('closeCountFreezer').value) || 0;
  const total = k + f;
  const keluarJual = cycleData.keluarPenjualanRandu || 0;
  const expected = cycleData.sisaAkhirBuku || 355;
  const badge = document.getElementById('closeDiffBadge');
  if (!badge) return;

  if (total === expected) {
    badge.className = "p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] font-bold flex items-center justify-between";
    badge.innerHTML = `<span>Total Fisik Terhitung: ${total} Pcs</span><span>✓ Cocok Sempurna (Selisih 0 Pcs)</span>`;
  } else {
    const diff = total - expected;
    if (keluarJual === 0) {
      badge.className = "p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-[11px] font-bold flex items-center justify-between";
      badge.innerHTML = `<span>Total Fisik: ${total} Pcs</span><span>💡 Menunggu Import Randu (Fisik Tersimpan)</span>`;
    } else {
      badge.className = "p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-bold flex items-center justify-between";
      badge.innerHTML = `<span>Total Fisik: ${total} Pcs</span><span>⚠️ Selisih ${diff > 0 ? '+' : ''}${diff} Pcs</span>`;
    }
  }
}

async function submitCloseDay() {
  const k = parseInt(document.getElementById('closeCountKedai').value) || 65;
  const f = parseInt(document.getElementById('closeCountFreezer').value) || 290;
  const closeTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";

  try {
    const res = await fetch('/api/production/close-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kedaiCount: k, freezerCount: f })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.record) {
        storeStatusData.closeDayRecord = json.record;
        storeStatusData.closedAt = json.record.closedAt;
      }
      if (json && json.cycle) {
        cycleData = json.cycle;
      }
    }
  } catch (err) {
    console.warn("Using offline fallback for close store:", err.message);
  }

  // Update in-memory & local storage state
  storeStatusData.isStoreOpened = false;
  storeStatusData.closedAt = closeTime;
  if (!storeStatusData.closeDayRecord) {
    const totalPhysical = k + f;
    const diff = totalPhysical - (cycleData.sisaAkhirBuku || 355);
    storeStatusData.closeDayRecord = {
      closedAt: closeTime,
      date: cycleData.date || "28 Okt 2026",
      expectedStock: cycleData.sisaAkhirBuku || 355,
      physicalKedai: k,
      physicalFreezer: f,
      totalPhysical: totalPhysical,
      difference: diff,
      status: diff === 0 ? "COCOK_SEMPURNA" : "ADA_SELISIH",
      checklistGas: true,
      checklistFreezer: true,
      notes: "Operasional selesai, kondisi dapur bersih."
    };
  }

  localStorage.setItem('jeol_store_opened', 'false');
  localStorage.removeItem('jeol_store_opened_at');
  localStorage.setItem('jeol_store_closed_at', closeTime);
  localStorage.setItem('jeol_close_day_record', JSON.stringify(storeStatusData.closeDayRecord));

  cycleData.sisaFisikKedai = k;
  cycleData.sisaFisikFreezer = f;
  cycleData.totalFisikHitung = k + f;
  cycleData.selisih = (k + f) - (cycleData.sisaAkhirBuku || 355);

  updateCycleDOM();
  renderKitchenStoreState();
  renderKitchenStockStatus();
  renderOwnerStoreStatus();

  closeCloseDayModal();
  showToast("Shift Ditutup & Direkonsiliasi", "Seluruh data persediaan hari ini telah tersimpan dan siap dipantau Owner. Kembali ke login...", "info");

  // Otomatis kembali ke layar Login PIN (Decision 5 Opsi A)
  setTimeout(() => {
    logout();
  }, 1200);
}

// --- Import Randu Modal & CSV Processing ---
let currentRanduImportItems = [
  { key: "batagor", name: "Batagor Super", qty: 140, omzet: 1680000, icon: "🥟" },
  { key: "pempek_lenjer", name: "Pempek Lenjer", qty: 90, omzet: 990000, icon: "🥖" },
  { key: "pempek_crispy", name: "Pempek Crispy", qty: 130, omzet: 1300000, icon: "✨" },
  { key: "pempek_adaan", name: "Pempek Adaan", qty: 120, omzet: 1320000, icon: "🧆" }
];

function openImportRanduModal() {
  const modal = document.getElementById('modalImportRandu');
  if (modal) {
    modal.classList.remove('hidden');
    renderRanduPreview(currentRanduImportItems);
  }
}

function closeImportRanduModal() {
  const modal = document.getElementById('modalImportRandu');
  if (modal) modal.classList.add('hidden');
}

function triggerRanduFileInput() {
  const input = document.getElementById('randuFileInput');
  if (input) {
    input.click();
  }
}

function resetRanduFileInput() {
  const input = document.getElementById('randuFileInput');
  if (input) input.value = '';

  const badge = document.getElementById('randuSelectedFileBadge');
  if (badge) badge.classList.add('hidden');

  currentRanduImportItems = [
    { key: "batagor", name: "Batagor Super", qty: 140, omzet: 1680000, icon: "🥟" },
    { key: "pempek_lenjer", name: "Pempek Lenjer", qty: 90, omzet: 990000, icon: "🥖" },
    { key: "pempek_crispy", name: "Pempek Crispy", qty: 130, omzet: 1300000, icon: "✨" },
    { key: "pempek_adaan", name: "Pempek Adaan", qty: 120, omzet: 1320000, icon: "🧆" }
  ];
  renderRanduPreview(currentRanduImportItems);
}

function handleRanduFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (file) {
    parseAndProcessRanduFile(file);
  }
}

function handleRanduFileDrop(event) {
  if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
    const file = event.dataTransfer.files[0];
    parseAndProcessRanduFile(file);
  }
}

function parseAndProcessRanduFile(file) {
  const badge = document.getElementById('randuSelectedFileBadge');
  const nameEl = document.getElementById('randuFileNameText');
  const sizeEl = document.getElementById('randuFileSizeText');

  if (badge && nameEl && sizeEl) {
    nameEl.textContent = file.name;
    const sizeKb = (file.size / 1024).toFixed(1);
    sizeEl.textContent = `(${sizeKb} KB)`;
    badge.classList.remove('hidden');
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    parseRanduCsvContent(text, file.name);
  };
  reader.onerror = function() {
    showToast("Gagal Membaca File", "Berkas CSV tidak dapat dibaca oleh peramban.", "warning");
  };
  reader.readAsText(file);
}

function parseRanduCsvContent(csvText, filename) {
  if (!csvText || !csvText.trim()) {
    showToast("Berkas Kosong", "Berkas CSV tidak memiliki baris data penjualan.", "warning");
    return;
  }

  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return;

  const parsedItems = [];

  function getIcon(name) {
    const lower = name.toLowerCase();
    if (lower.includes('batagor')) return '🥟';
    if (lower.includes('lenjer')) return '🥖';
    if (lower.includes('crispy')) return '✨';
    if (lower.includes('adaan')) return '🧆';
    if (lower.includes('kapal')) return '⚓';
    if (lower.includes('kulit')) return '🍘';
    return '🍱';
  }

  const defaultPrices = {
    batagor: 12000,
    pempek_lenjer: 11000,
    pempek_crispy: 10000,
    pempek_adaan: 11000
  };

  const headerLine = lines[0];
  let delimiter = ',';
  if (headerLine.includes(';') && !headerLine.includes(',')) delimiter = ';';
  else if (headerLine.includes('\t')) delimiter = '\t';

  const isHeader = /produk|product|item|nama|menu|qty|jumlah|terjual/i.test(headerLine);
  const dataRows = isHeader ? lines.slice(1) : lines;

  dataRows.forEach(row => {
    const cols = row.split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length >= 2) {
      let name = cols[0];
      let qty = parseInt(cols[1].replace(/[^0-9]/g, '')) || 0;
      let omzet = 0;
      if (cols.length >= 3) {
        omzet = parseInt(cols[2].replace(/[^0-9]/g, '')) || 0;
      }

      if (name && qty > 0) {
        let key = name.toLowerCase().replace(/\s+/g, '_');
        if (!omzet) {
          const unitPrice = defaultPrices[key] || 11000;
          omzet = qty * unitPrice;
        }
        parsedItems.push({
          key,
          name,
          qty,
          omzet,
          icon: getIcon(name)
        });
      }
    }
  });

  if (parsedItems.length > 0) {
    currentRanduImportItems = parsedItems;
    renderRanduPreview(currentRanduImportItems);
    showToast("Berkas CSV Terbaca", `${parsedItems.length} menu berhasil dimuat dari ${filename}!`, "success");
  } else {
    renderRanduPreview(currentRanduImportItems);
    showToast("Format Terdeteksi", `Data ${filename} telah disesuaikan ke format neraca Randu POS.`, "success");
  }
}

function loadSampleRanduData() {
  const badge = document.getElementById('randuSelectedFileBadge');
  const nameEl = document.getElementById('randuFileNameText');
  const sizeEl = document.getElementById('randuFileSizeText');

  if (badge && nameEl && sizeEl) {
    const dateCompact = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }).replace(/\s+/g, '');
    nameEl.textContent = `Randu_Sales_${dateCompact}.csv (Demo Otomatis)`;
    sizeEl.textContent = "(1.4 KB)";
    badge.classList.remove('hidden');
  }

  currentRanduImportItems = [
    { key: "batagor", name: "Batagor Super", qty: 140, omzet: 1680000, icon: "🥟" },
    { key: "pempek_lenjer", name: "Pempek Lenjer", qty: 90, omzet: 990000, icon: "🥖" },
    { key: "pempek_crispy", name: "Pempek Crispy", qty: 130, omzet: 1300000, icon: "✨" },
    { key: "pempek_adaan", name: "Pempek Adaan", qty: 120, omzet: 1320000, icon: "🧆" }
  ];

  renderRanduPreview(currentRanduImportItems);
  showToast("Demo Randu POS Dimuat", "480 Pcs penjualan (Rp 2.880.000) siap disinkronkan.", "success");
}

function renderRanduPreview(items) {
  const listEl = document.getElementById('randuPreviewList');
  const countBadge = document.getElementById('randuMenuCountBadge');
  const totalText = document.getElementById('randuTotalReductionText');

  if (!listEl) return;

  const validItems = (items && items.length) ? items : [
    { key: "batagor", name: "Batagor Super", qty: 140, omzet: 1680000, icon: "🥟" },
    { key: "pempek_lenjer", name: "Pempek Lenjer", qty: 90, omzet: 990000, icon: "🥖" },
    { key: "pempek_crispy", name: "Pempek Crispy", qty: 130, omzet: 1300000, icon: "✨" },
    { key: "pempek_adaan", name: "Pempek Adaan", qty: 120, omzet: 1320000, icon: "🧆" }
  ];

  let totalQty = 0;
  let totalOmzet = 0;

  listEl.innerHTML = validItems.map(item => {
    totalQty += item.qty;
    totalOmzet += item.omzet;
    const formattedOmzet = "Rp " + item.omzet.toLocaleString("id-ID");
    return `
      <div class="flex justify-between items-center py-0.5">
        <span>${item.icon || '🍱'} ${item.name}:</span>
        <span class="font-bold text-rose-600">${item.qty} Pcs (${formattedOmzet})</span>
      </div>
    `;
  }).join('');

  if (countBadge) {
    countBadge.textContent = `${validItems.length} Menu Terdeteksi`;
  }

  if (totalText) {
    const formattedTotalOmzet = "Rp " + totalOmzet.toLocaleString("id-ID");
    totalText.textContent = `-${totalQty} Pcs (${formattedTotalOmzet})`;
  }
}

async function processImportRandu() {
  const totalQty = currentRanduImportItems.reduce((sum, item) => sum + item.qty, 0);
  const totalOmzet = currentRanduImportItems.reduce((sum, item) => sum + item.omzet, 0);

  try {
    const res = await fetch('/api/inventory/import-randu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: currentRanduImportItems })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.newCycle) {
        cycleData = json.newCycle;
        updateCycleDOM();
      }
    } else {
      // Local fallback for standalone file:/// mode
      cycleData.keluarPenjualanRandu = totalQty;
      cycleData.sisaAkhirBuku = cycleData.stokAwal + cycleData.masukProduksi - cycleData.keluarPenjualanRandu - cycleData.keluarSampel;
      updateCycleDOM();
    }
  } catch (err) {
    // Local fallback for offline mode
    cycleData.keluarPenjualanRandu = totalQty;
    cycleData.sisaAkhirBuku = cycleData.stokAwal + cycleData.masukProduksi - cycleData.keluarPenjualanRandu - cycleData.keluarSampel;
    updateCycleDOM();
  }

  showToast("Sinkronisasi Selesai", `Pengurangan stok kasir Randu (-${totalQty} Pcs / Rp ${totalOmzet.toLocaleString("id-ID")}) tercatat ke neraca arus barang.`, "success");
  closeImportRanduModal();
}

// --- Sample Outflow Modal ---
function openSpecialModal() {
  document.getElementById('modalSpecial').classList.remove('hidden');
}
function closeSpecialModal() {
  document.getElementById('modalSpecial').classList.add('hidden');
}
async function saveSpecialSample() {
  const prod = document.getElementById('sampleProdSelect').value;
  const qty = parseInt(document.getElementById('sampleQtyVal').value) || 5;

  try {
    await fetch('/api/inventory/sample', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productKey: prod, qty, purpose: "Tester / Pitching" })
    });
    await fetchInventorySummary();
  } catch (err) {}

  alert("Pengeluaran Sampel Berhasil Dicatat!");
  closeSpecialModal();
}

// --- Multi-Location Real-time Cards & Restock / Transfer Handlers ---
function renderMultiLocationCards() {
  const container = document.getElementById('multiLocationCardsGrid');
  if (!container) return;

  const locs = locationsData || {
    freezer_dapur: {
      items: [
        { name: "Daging Ikan Tenggiri Giling", qty: 25.0, unit: "Kg" },
        { name: "Daging Ikan Kulit / Campur", qty: 12.0, unit: "Kg" }
      ]
    },
    gudang_kering: {
      items: [
        { name: "Tepung Tapioka Super", qty: 32.0, unit: "Kg" },
        { name: "Bumbu & Garam Racik", qty: 8.5, unit: "Kg" },
        { name: "Tahu Putih Segar (Supplier Pabrik)", qty: 200, unit: "Pcs" }
      ]
    },
    freezer_produk_jadi: {
      items: [
        { name: "Batagor Super (Vakum)", qty: 124, unit: "Pcs" },
        { name: "Pempek Lenjer (Vakum)", qty: 166, unit: "Pcs" },
        { name: "Pempek Crispy (Vakum)", qty: 62, unit: "Pcs" },
        { name: "Pempek Adaan (Vakum)", qty: 32, unit: "Pcs" }
      ]
    },
    kedai_outlet: {
      items: [
        { name: "Batagor Fresh", qty: 35, unit: "Pcs" },
        { name: "Pempek Fresh", qty: 30, unit: "Pcs" },
        { name: "Pempek Crispy Fresh", qty: 16, unit: "Pcs" },
        { name: "Pempek Adaan Fresh", qty: 15, unit: "Pcs" }
      ]
    }
  };

  const cardsHtml = `
    <!-- 1. FREEZER DAPUR (BAHAN BAKU) -->
    <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3 hover:border-blue-300 transition">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2">
        <h4 class="font-bold text-slate-800 text-xs">🧊 Freezer Dapur (Bahan Baku)</h4>
        <span class="text-[10px] bg-blue-50 text-[#1E4E8C] px-2 py-0.5 rounded font-bold">Bahan Beku</span>
      </div>
      <div class="space-y-2 text-xs">
        ${(locs.freezer_dapur?.items || []).map(i => `
          <div class="flex justify-between items-center p-2 bg-slate-50 rounded-xl">
            <span class="text-slate-600 truncate mr-2">${i.name}</span>
            <span class="font-black text-slate-800 shrink-0 font-mono">${Number(i.qty).toFixed(1)} ${i.unit || 'Kg'}</span>
          </div>
        `).join('')}
      </div>
      <button onclick="openRestockModalFor('ikan_tenggiri')" class="w-full text-center py-2 text-[11px] font-bold text-blue-700 bg-blue-50/70 hover:bg-blue-100 rounded-xl transition">
        + Restock Ikan Giling
      </button>
    </div>

    <!-- 2. GUDANG BAHAN KERING -->
    <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3 hover:border-amber-300 transition">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2">
        <h4 class="font-bold text-slate-800 text-xs">🌾 Gudang Bahan Kering</h4>
        <span class="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-bold">Suhu Ruang</span>
      </div>
      <div class="space-y-2 text-xs">
        ${(locs.gudang_kering?.items || []).map(i => `
          <div class="flex justify-between items-center p-2 bg-slate-50 rounded-xl">
            <span class="text-slate-600 truncate mr-2">${i.name}</span>
            <span class="font-black text-slate-800 shrink-0 font-mono">${typeof i.qty === 'number' && i.unit !== 'Pcs' ? Number(i.qty).toFixed(1) : i.qty} ${i.unit || 'Kg'}</span>
          </div>
        `).join('')}
      </div>
      <button onclick="openRestockModalFor('tapioka')" class="w-full text-center py-2 text-[11px] font-bold text-amber-700 bg-amber-50/70 hover:bg-amber-100 rounded-xl transition">
        + Restock Tepung / Tahu
      </button>
    </div>

    <!-- 3. FREEZER PRODUK JADI -->
    <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3 hover:border-emerald-300 transition">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2">
        <h4 class="font-bold text-slate-800 text-xs">📦 Freezer Produk Jadi</h4>
        <span class="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold">Cadangan</span>
      </div>
      <div class="space-y-2 text-xs">
        ${(locs.freezer_produk_jadi?.items || []).map(i => `
          <div class="flex justify-between items-center p-2 bg-slate-50 rounded-xl">
            <span class="text-slate-600 truncate mr-2">${i.name}</span>
            <span class="font-black text-[#0F2C59] shrink-0 font-mono">${i.qty} Pcs</span>
          </div>
        `).join('')}
      </div>
      <button onclick="openTransferModal()" class="w-full text-center py-2 text-[11px] font-bold text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100 rounded-xl transition">
        🔄 Transfer ke Kedai
      </button>
    </div>

    <!-- 4. STOK TRANSIT KEDAI -->
    <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3 hover:border-purple-300 transition">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2">
        <h4 class="font-bold text-slate-800 text-xs">🥢 Stok Transit Kedai</h4>
        <span class="text-[10px] bg-purple-50 text-purple-800 px-2 py-0.5 rounded font-bold">Siap Saji</span>
      </div>
      <div class="space-y-2 text-xs">
        ${(locs.kedai_outlet?.items || []).map(i => `
          <div class="flex justify-between items-center p-2 bg-slate-50 rounded-xl">
            <span class="text-slate-600 truncate mr-2">${i.name}</span>
            <span class="font-black text-purple-900 shrink-0 font-mono">${i.qty} Pcs</span>
          </div>
        `).join('')}
      </div>
      <div class="w-full text-center py-2 text-[11px] font-semibold text-slate-400 bg-slate-50 rounded-xl">
        Terjual via Randu POS
      </div>
    </div>
  `;

  container.innerHTML = cardsHtml;
}

function renderMaterialLogs() {
  const tbody = document.getElementById('materialLogsTableBody');
  if (!tbody) return;

  if (!materialLogsData || materialLogsData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-6 text-center text-slate-400">
          Belum ada riwayat penerimaan bahan atau mutasi stok yang tercatat.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = materialLogsData.map(log => {
    const isRestock = log.type === 'RESTOCK';
    const badge = isRestock
      ? `<span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">📥 Restock Masuk</span>`
      : `<span class="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">🔄 Transfer Lokasi</span>`;

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3.5 font-mono font-bold text-slate-700">${log.id}</td>
        <td class="p-3.5 text-slate-500">${log.date} • ${log.time}</td>
        <td class="p-3.5">${badge}</td>
        <td class="p-3.5 font-bold text-[#0F2C59]">${log.materialName}</td>
        <td class="p-3.5 text-center font-black ${isRestock ? 'text-emerald-600' : 'text-blue-600'}">
          ${isRestock ? '+' : ''}${log.qty} ${log.unit || 'Kg'}
        </td>
        <td class="p-3.5 text-slate-600">${log.location}</td>
        <td class="p-3.5 font-medium text-slate-700">${log.partner || '-'}</td>
        <td class="p-3.5 text-slate-500 italic">${log.notes || '-'}</td>
      </tr>
    `;
  }).join('');
}

function openRestockModal() {
  const modal = document.getElementById('modalRestock');
  if (modal) modal.classList.remove('hidden');
  updateRestockUnitLabel();
}

function openRestockModalFor(matKey) {
  openRestockModal();
  const sel = document.getElementById('restockMaterialSelect');
  if (sel) {
    sel.value = matKey;
    updateRestockUnitLabel();
  }
}

function closeRestockModal() {
  const modal = document.getElementById('modalRestock');
  if (modal) modal.classList.add('hidden');
}

function updateRestockUnitLabel() {
  const sel = document.getElementById('restockMaterialSelect');
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  const unit = opt?.getAttribute('data-unit') || 'Kg';
  const loc = opt?.getAttribute('data-loc') || 'Freezer Dapur Utama';
  const lbl = document.getElementById('restockUnitLabel');
  const locPrev = document.getElementById('restockLocPreview');
  if (lbl) lbl.textContent = unit;
  if (locPrev) locPrev.value = loc;
}

async function saveRestockMaterial() {
  const matKey = document.getElementById('restockMaterialSelect').value;
  const qty = parseFloat(document.getElementById('restockQtyVal').value);
  const supplier = document.getElementById('restockSupplierVal').value.trim();
  const notes = document.getElementById('restockNotesVal').value.trim();

  if (!qty || qty <= 0) {
    alert("Silakan masukkan jumlah kuantitas bahan yang valid!");
    return;
  }

  try {
    const res = await fetch('/api/inventory/restock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialKey: matKey, qty, supplier, notes })
    });
    const json = await res.json();
    if (json.success) {
      if (json.locations) locationsData = json.locations;
      renderMultiLocationCards();
      await fetchMaterialLogs();
      alert(json.message || "Bahan masuk berhasil dicatat!");
      closeRestockModal();
      document.getElementById('restockQtyVal').value = '';
      document.getElementById('restockSupplierVal').value = '';
      document.getElementById('restockNotesVal').value = '';
    } else {
      alert("Gagal mencatat: " + (json.message || "Error server"));
    }
  } catch (err) {
    alert("Terjadi kesalahan jaringan: " + err.message);
  }
}

function openTransferModal() {
  const modal = document.getElementById('modalTransfer');
  if (modal) modal.classList.remove('hidden');
}

function closeTransferModal() {
  const modal = document.getElementById('modalTransfer');
  if (modal) modal.classList.add('hidden');
}

async function saveTransferStock() {
  const prodKey = document.getElementById('transferProdSelect').value;
  const qty = parseInt(document.getElementById('transferQtyVal').value);
  const notes = document.getElementById('transferNotesVal').value.trim();

  if (!qty || qty <= 0) {
    alert("Silakan masukkan jumlah Pcs yang valid!");
    return;
  }

  try {
    const res = await fetch('/api/inventory/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productKey: prodKey, qty, notes })
    });
    const json = await res.json();
    if (json.success) {
      if (json.locations) locationsData = json.locations;
      if (json.cycle) {
        cycleData = json.cycle;
        updateCycleDOM();
      }
      renderMultiLocationCards();
      await fetchMaterialLogs();
      alert(json.message || "Transfer produk berhasil dicatat!");
      closeTransferModal();
      document.getElementById('transferQtyVal').value = '';
      document.getElementById('transferNotesVal').value = '';
    } else {
      alert("Gagal transfer: " + (json.message || "Stok tidak mencukupi"));
    }
  } catch (err) {
    alert("Terjadi kesalahan jaringan: " + err.message);
  }
}

// --- Master Resep (BOM) & HPP Costing CRUD ---
let recipesData = {};

function initRecipesData() {
  const saved = localStorage.getItem('jeol_recipes_db');
  if (saved) {
    try {
      recipesData = JSON.parse(saved);
    } catch (e) {
      recipesData = null;
    }
  }

  if (!recipesData || Object.keys(recipesData).length === 0) {
    recipesData = {
      batagor: {
        id: "PROD-01",
        key: "batagor",
        category: "batagor",
        name: "Batagor Super",
        perBatch: 100,
        unit: "Pcs",
        shelfLifeDays: 30,
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
        perBatch: 100,
        unit: "Pcs",
        shelfLifeDays: 45,
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
        perBatch: 80,
        unit: "Pcs",
        shelfLifeDays: 30,
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
        perBatch: 100,
        unit: "Pcs",
        shelfLifeDays: 45,
        estHpp: 7450,
        sellingPrice: 11000,
        ingredients: [
          { name: "Daging Ikan Tenggiri Giling", qty: 10.0, unit: "Kg", costPerUnit: 65000 },
          { name: "Tepung Tapioka Super", qty: 6.0, unit: "Kg", costPerUnit: 12000 },
          { name: "Santan & Bawang Merah", qty: 2.0, unit: "Kg", costPerUnit: 22000 }
        ]
      }
    };
    saveRecipesToStorage();
  } else {
    syncLocalMenuWithRecipes();
  }
}

function syncLocalMenuWithRecipes() {
  Object.keys(recipesData).forEach(k => {
    const r = recipesData[k];
    LOCAL_MENU_DB[k] = {
      name: r.name,
      perBatch: r.perBatch,
      ingredients: (r.ingredients || []).map(ing => ({
        name: ing.name,
        qty: ing.qty,
        unit: ing.unit
      }))
    };
    productsData[k] = r;
  });
}

function saveRecipesToStorage() {
  localStorage.setItem('jeol_recipes_db', JSON.stringify(recipesData));
  syncLocalMenuWithRecipes();
}

function renderOwnerBomCards() {
  const container = document.getElementById('bomCardsGrid');
  const countBadge = document.getElementById('bomCountBadge');
  if (!container) return;

  const keys = Object.keys(recipesData);
  if (countBadge) {
    countBadge.innerText = `${keys.length} Menu Terdaftar`;
  }

  if (keys.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
        <div class="text-3xl mb-2">📋</div>
        <div class="font-bold text-slate-600">Belum ada standar resep terdaftar</div>
        <div class="text-xs mt-1">Klik tombol "+ Tambah Menu Baru" di atas untuk menambahkan formula batch & harga bahan.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = keys.map(key => {
    const prod = recipesData[key];
    const totalCost = (prod.ingredients || []).reduce((acc, ing) => {
      return acc + ((Number(ing.qty) || 0) * (Number(ing.costPerUnit) || 0));
    }, 0);
    const perBatch = Number(prod.perBatch) || 1;
    const estHpp = Math.round(totalCost / perBatch);
    const sellingPrice = Number(prod.sellingPrice) || 0;
    const margin = sellingPrice > 0 ? sellingPrice - estHpp : 0;
    const marginPercent = sellingPrice > 0 ? Math.round((margin / sellingPrice) * 100) : 0;

    const categoryBadgeStyles = prod.category === 'batagor'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : prod.category === 'pempek'
      ? 'bg-blue-50 text-blue-800 border-blue-200'
      : 'bg-emerald-50 text-emerald-800 border-emerald-200';

    return `
      <div class="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between hover:border-slate-300 transition shadow-2xs">
        <div>
          <!-- Header Kartu -->
          <div class="flex items-start justify-between gap-1 mb-1">
            <div>
              <div class="font-bold text-sm text-[#0F2C59] leading-tight">${prod.name}</div>
              <div class="text-[11px] text-slate-500 font-medium mt-0.5">1 Batch = ${perBatch} Pcs</div>
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-md border ${categoryBadgeStyles} uppercase">
              ${prod.category || 'Menu'}
            </span>
          </div>

          <!-- Rincian Bahan Mentah -->
          <div class="mt-2.5 text-slate-700 space-y-1.5 text-[11px] bg-white p-3 rounded-xl border border-slate-200/80">
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Komposisi & Biaya:</div>
            ${(prod.ingredients || []).map(ing => `
              <div class="flex justify-between items-center text-slate-600">
                <span>• ${ing.qty} ${ing.unit} ${ing.name}</span>
                <span class="text-slate-400 font-medium">@Rp ${(Number(ing.costPerUnit) || 0).toLocaleString('id-ID')}</span>
              </div>
            `).join('')}
          </div>

          <!-- Perhitungan HPP & Margin -->
          <div class="mt-3 pt-2.5 border-t border-slate-200 space-y-1">
            <div class="flex justify-between items-center text-xs">
              <span class="text-slate-500 font-semibold">Est. HPP Bahan:</span>
              <span class="font-black text-[#1E4E8C] text-sm">Rp ${estHpp.toLocaleString('id-ID')} <span class="text-[10px] font-normal text-slate-400">/ pcs</span></span>
            </div>
            ${sellingPrice > 0 ? `
              <div class="flex justify-between items-center text-[11px] text-slate-500 pt-0.5">
                <span>Jual: Rp ${sellingPrice.toLocaleString('id-ID')}</span>
                <span class="text-emerald-700 font-bold">Margin Rp ${margin.toLocaleString('id-ID')} (${marginPercent}%)</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Tombol Aksi Kartu -->
        <div class="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between">
          <span class="text-[10px] text-slate-400 font-semibold">Modal: Rp ${totalCost.toLocaleString('id-ID')}</span>
          <div class="flex items-center gap-1.5">
            <button onclick="openEditRecipeModal('${key}')" class="px-2.5 py-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-slate-700 hover:text-[#1E4E8C] font-bold text-[11px] transition flex items-center gap-1 shadow-2xs">
              <span>✏️ Edit</span>
            </button>
            <button onclick="deleteRecipe('${key}')" class="px-2.5 py-1.5 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-300 rounded-lg text-slate-400 hover:text-red-600 font-bold text-[11px] transition shadow-2xs" title="Hapus Resep">
              <span>🗑️</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openAddRecipeModal() {
  document.getElementById('recipeFormKey').value = '';
  document.getElementById('recipeModalTitle').innerText = 'Tambah Formula Menu Baru';
  document.getElementById('recipeFormName').value = '';
  document.getElementById('recipeFormCategory').value = 'pempek';
  document.getElementById('recipeFormPerBatch').value = '100';
  document.getElementById('recipeFormSellingPrice').value = '12000';
  document.getElementById('recipeFormShelfLife').value = '30';

  const rows = document.getElementById('recipeIngredientRows');
  rows.innerHTML = '';
  addIngredientRow("Daging Ikan Tenggiri Giling", "10.0", "Kg", "65000");
  addIngredientRow("Tepung Tapioka Super", "6.0", "Kg", "12000");
  addIngredientRow("Garam & Bumbu Racik", "1.0", "Kg", "30000");

  recalculateModalHpp();
  document.getElementById('modalRecipeForm').classList.remove('hidden');
}

function openEditRecipeModal(key) {
  const prod = recipesData[key];
  if (!prod) return;

  document.getElementById('recipeFormKey').value = key;
  document.getElementById('recipeModalTitle').innerText = 'Edit Resep & Biaya: ' + prod.name;
  document.getElementById('recipeFormName').value = prod.name;
  document.getElementById('recipeFormCategory').value = prod.category || 'pempek';
  document.getElementById('recipeFormPerBatch').value = prod.perBatch || 100;
  document.getElementById('recipeFormSellingPrice').value = prod.sellingPrice || 0;
  document.getElementById('recipeFormShelfLife').value = prod.shelfLifeDays || 30;

  const rows = document.getElementById('recipeIngredientRows');
  rows.innerHTML = '';
  if (Array.isArray(prod.ingredients) && prod.ingredients.length > 0) {
    prod.ingredients.forEach(ing => {
      addIngredientRow(ing.name, ing.qty, ing.unit, ing.costPerUnit);
    });
  } else {
    addIngredientRow("", "", "Kg", "");
  }

  recalculateModalHpp();
  document.getElementById('modalRecipeForm').classList.remove('hidden');
}

function closeRecipeModal() {
  document.getElementById('modalRecipeForm').classList.add('hidden');
}

function addIngredientRow(name = '', qty = '', unit = 'Kg', cost = '') {
  const rows = document.getElementById('recipeIngredientRows');
  if (!rows) return;
  const div = document.createElement('div');
  div.className = 'recipe-ing-row grid grid-cols-12 gap-2 items-center';
  div.innerHTML = `
    <input type="text" value="${name}" placeholder="Nama bahan mentah..." class="recipe-ing-name col-span-5 px-2.5 py-1.5 border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs focus:outline-hidden focus:border-[#3A86FF]">
    <input type="number" step="0.1" min="0" value="${qty}" placeholder="0.0" oninput="recalculateModalHpp()" class="recipe-ing-qty col-span-2 px-2 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-800 text-right text-xs focus:outline-hidden focus:border-[#3A86FF]">
    <select class="recipe-ing-unit col-span-2 px-1.5 py-1.5 border border-slate-200 rounded-lg font-semibold text-slate-700 bg-white text-xs focus:outline-hidden focus:border-[#3A86FF]">
      <option value="Kg" ${unit === 'Kg' ? 'selected' : ''}>Kg</option>
      <option value="Pcs" ${unit === 'Pcs' ? 'selected' : ''}>Pcs</option>
      <option value="Gram" ${unit === 'Gram' ? 'selected' : ''}>Gram</option>
      <option value="Liter" ${unit === 'Liter' ? 'selected' : ''}>Liter</option>
      <option value="Bungkus" ${unit === 'Bungkus' ? 'selected' : ''}>Bungkus</option>
    </select>
    <input type="number" min="0" value="${cost}" placeholder="65000" oninput="recalculateModalHpp()" class="recipe-ing-cost col-span-2 px-2 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-800 text-right text-xs focus:outline-hidden focus:border-[#3A86FF]">
    <button type="button" onclick="this.closest('.recipe-ing-row').remove(); recalculateModalHpp();" class="col-span-1 text-slate-400 hover:text-red-500 font-black text-center text-sm transition" title="Hapus Bahan">&times;</button>
  `;
  rows.appendChild(div);
  recalculateModalHpp();
}

function recalculateModalHpp() {
  const perBatchInput = document.getElementById('recipeFormPerBatch');
  const sellingPriceInput = document.getElementById('recipeFormSellingPrice');
  if (!perBatchInput || !sellingPriceInput) return;

  const perBatch = Number(perBatchInput.value) || 1;
  const sellingPrice = Number(sellingPriceInput.value) || 0;
  const rows = document.querySelectorAll('.recipe-ing-row');
  let totalCost = 0;

  rows.forEach(r => {
    const qty = Number(r.querySelector('.recipe-ing-qty')?.value) || 0;
    const cost = Number(r.querySelector('.recipe-ing-cost')?.value) || 0;
    totalCost += (qty * cost);
  });

  const estHpp = Math.round(totalCost / perBatch);
  const margin = sellingPrice - estHpp;
  const marginPercent = sellingPrice > 0 ? Math.round((margin / sellingPrice) * 100) : 0;

  const hppEl = document.getElementById('modalEstHppText');
  const totalCostEl = document.getElementById('modalTotalCostText');
  const sellEl = document.getElementById('modalSellingPriceText');
  const marginEl = document.getElementById('modalMarginText');

  if (hppEl) hppEl.innerText = `Rp ${estHpp.toLocaleString('id-ID')} / pcs`;
  if (totalCostEl) totalCostEl.innerText = `Rp ${totalCost.toLocaleString('id-ID')}`;
  if (sellEl) sellEl.innerText = `Rp ${sellingPrice.toLocaleString('id-ID')}`;
  if (marginEl) {
    if (sellingPrice > 0) {
      marginEl.className = margin >= 0 ? "font-bold text-emerald-700" : "font-bold text-rose-600";
      marginEl.innerText = `Rp ${margin.toLocaleString('id-ID')} (${marginPercent}%)`;
    } else {
      marginEl.innerText = "-";
    }
  }
}

async function saveRecipeForm() {
  const name = document.getElementById('recipeFormName').value.trim();
  if (!name) {
    alert("Silakan masukkan nama produk / menu.");
    return;
  }

  let key = document.getElementById('recipeFormKey').value.trim();
  if (!key) {
    key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  const category = document.getElementById('recipeFormCategory').value;
  const perBatch = Number(document.getElementById('recipeFormPerBatch').value) || 100;
  const sellingPrice = Number(document.getElementById('recipeFormSellingPrice').value) || 0;
  const shelfLifeDays = Number(document.getElementById('recipeFormShelfLife').value) || 30;

  const rows = document.querySelectorAll('.recipe-ing-row');
  const ingredients = [];
  let totalCost = 0;

  rows.forEach(r => {
    const ingName = r.querySelector('.recipe-ing-name')?.value.trim();
    const qty = Number(r.querySelector('.recipe-ing-qty')?.value) || 0;
    const unit = r.querySelector('.recipe-ing-unit')?.value || 'Kg';
    const costPerUnit = Number(r.querySelector('.recipe-ing-cost')?.value) || 0;
    if (ingName) {
      ingredients.push({ name: ingName, qty, unit, costPerUnit });
      totalCost += (qty * costPerUnit);
    }
  });

  if (ingredients.length === 0) {
    alert("Silakan tambahkan minimal 1 baris bahan baku.");
    return;
  }

  const estHpp = Math.round(totalCost / perBatch);

  const productData = {
    id: recipesData[key]?.id || `PROD-${String(Object.keys(recipesData).length + 1).padStart(2, '0')}`,
    key,
    name,
    category,
    perBatch,
    unit: "Pcs",
    shelfLifeDays,
    sellingPrice,
    estHpp,
    ingredients
  };

  recipesData[key] = productData;
  saveRecipesToStorage();

  // Async push to backend API
  try {
    await fetch('/api/master/products/' + key, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
  } catch (err) {
    console.warn("Using local recipe storage fallback:", err.message);
  }

  closeRecipeModal();
  renderOwnerBomCards();
  updateMenuSummary();
  renderIngredientsList();
  showToast("Resep Berhasil Disimpan!", `Formula ${name} dan estimasi HPP (Rp ${estHpp.toLocaleString('id-ID')}/pcs) telah diperbarui.`, "success");
}

async function deleteRecipe(key) {
  if (!recipesData[key]) return;
  const keys = Object.keys(recipesData);
  if (keys.length <= 1) {
    alert("Minimal harus tersisa 1 menu pada Master Resep.");
    return;
  }

  const prodName = recipesData[key].name;
  if (!confirm(`Hapus formula resep "${prodName}" dari Master Data?`)) {
    return;
  }

  delete recipesData[key];
  saveRecipesToStorage();

  // Async delete from backend API
  try {
    await fetch('/api/master/products/' + key, {
      method: 'DELETE'
    });
  } catch (err) {}

  renderOwnerBomCards();
  updateMenuSummary();
  renderIngredientsList();
  showToast("Resep Dihapus", `Menu "${prodName}" berhasil dihapus dari Master Resep.`, "warning");
}

// --- Owner Tabs & Dedicated Sidebar ---
function setOwnerTab(tab) {
  const titles = {
    summary: "Ringkasan Eksekutif & RAG",
    batches: "Log Rincian Batch & Alasan Deviasi",
    inventory: "Stok Multi-Lokasi",
    bom: "Master Resep (BOM) & HPP Costing"
  };

  ['summary', 'batches', 'inventory', 'bom'].forEach(t => {
    document.getElementById('ownerTabContent_' + t)?.classList.add('hidden');
    const sBtn = document.getElementById('sidebarBtn_' + t);
    if (sBtn) {
      sBtn.className = "sidebar-link w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition text-left";
    }
  });

  document.getElementById('ownerTabContent_' + tab)?.classList.remove('hidden');
  const activeSidebarBtn = document.getElementById('sidebarBtn_' + tab);
  if (activeSidebarBtn) {
    activeSidebarBtn.className = "sidebar-link active w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition text-left";
  }

  const pageTitle = document.getElementById('ownerPageHeaderTitle');
  if (pageTitle && titles[tab]) {
    pageTitle.innerText = titles[tab];
  }

  if (tab === 'summary') {
    renderOwnerStoreStatus();
    renderOwnerKpiCards();
    updateCycleDOM();
    setTimeout(() => drawChart(7), 100);
  } else if (tab === 'batches') {
    renderOwnerBatchTable();
  } else if (tab === 'inventory') {
    renderOwnerInventoryTable();
  } else if (tab === 'bom') {
    renderOwnerBomCards();
  }
  closeOwnerMobileSidebar();
}

function toggleOwnerMobileSidebar() {
  const sidebar = document.getElementById('ownerSidebar');
  const backdrop = document.getElementById('ownerDrawerBackdrop');
  if (sidebar && backdrop) {
    const isClosed = sidebar.classList.contains('-translate-x-full');
    if (isClosed) {
      sidebar.classList.remove('-translate-x-full');
      backdrop.classList.remove('hidden');
    } else {
      sidebar.classList.add('-translate-x-full');
      backdrop.classList.add('hidden');
    }
  }
}

function closeOwnerMobileSidebar() {
  const sidebar = document.getElementById('ownerSidebar');
  const backdrop = document.getElementById('ownerDrawerBackdrop');
  if (sidebar) sidebar.classList.add('-translate-x-full');
  if (backdrop) backdrop.classList.add('hidden');
}

// --- Global Period Filtering State (Owner & Finance) ---
let currentOwnerPeriod = 'today'; // 'today' | '7d' | 'this_month' | 'last_month'

function getFilteredBatches(period = currentOwnerPeriod) {
  if (period === 'last_month') {
    return batchesData.filter(b => (b.id && b.id.includes("202610")) || (b.date && b.date.toLowerCase().includes("okt")));
  }
  if (period === 'this_month') {
    return batchesData.filter(b => (b.id && b.id.includes("202611")) || (b.date && b.date.toLowerCase().includes("nov")));
  }
  if (period === '7d') {
    return batchesData.slice(0, 10);
  }
  // 'today' default
  const todayList = batchesData.filter(b => (b.id && b.id.includes("20261113")) || (b.date && b.date.includes("13 Nov")));
  return todayList;
}

function setOwnerPeriodFilter(period) {
  currentOwnerPeriod = period;

  // 1. Sync Dropdown Selector
  const periodSel = document.getElementById('ownerPeriodSelect');
  if (periodSel && periodSel.value !== period) {
    periodSel.value = period;
  }

  // 2. Update Chart Card buttons
  ['today', '7d', 'this_month', 'last_month'].forEach(p => {
    const cbtn = document.getElementById('btnC_' + p);
    if (cbtn) {
      if (p === period) {
        cbtn.className = "px-2.5 py-1 rounded-lg bg-white text-[#0F2C59] shadow-xs transition font-bold";
      } else {
        cbtn.className = "px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800 transition font-bold";
      }
    }
  });

  // 3. Update Period Pill & Headers
  const pill = document.getElementById('ownerActivePeriodPill');
  const tableTitle = document.getElementById('ownerBatchTableTitle');
  const tableSubtitle = document.getElementById('ownerBatchTableSubtitle');
  const chartTitle = document.getElementById('chartTrendTitle');
  const btnExport = document.getElementById('ownerBtnExportCsv');

  let titleText = "Hari Ini (13 Nov 2026)";
  let shortTitle = "Hari Ini";
  if (period === '7d') {
    titleText = "7 Hari Terakhir";
    shortTitle = "7 Hari";
  } else if (period === 'this_month') {
    titleText = "November 2026";
    shortTitle = "November 2026";
  } else if (period === 'last_month') {
    titleText = "Oktober 2026";
    shortTitle = "Oktober 2026";
  }

  if (pill) pill.textContent = titleText;
  if (tableTitle) tableTitle.textContent = `Riwayat Lengkap Batch: ${shortTitle}`;
  if (tableSubtitle) {
    tableSubtitle.textContent = period === 'last_month' 
      ? "Arsip audit batch bulan Oktober 2026 terintegrasi dengan BOM, output riil, dan alasan deviasi."
      : "Terintegrasi dengan nama staf, bahan, target BOM, dan pencatatan alasan berkurangnya hasil.";
  }
  if (chartTitle) chartTitle.textContent = `Grafik Tren Yield Efisiensi Dapur (%) - ${shortTitle}`;
  if (btnExport) {
    btnExport.innerHTML = `<span>Download Berkas CSV Finance (${shortTitle})</span> &rarr;`;
  }

  // 4. Render components
  const filtered = getFilteredBatches(period);
  renderOwnerKpiCards(filtered);
  renderOwnerBatchTable(filtered);
  drawChart(period);

  showToast("Filter Periode Diperbarui", `Menampilkan data produksi untuk periode: ${shortTitle}`, "info");
}

function renderOwnerKpiCards(customBatches = null) {
  const elTotalBatchLabel = document.getElementById('kpiTotalBatchLabel');
  const elTotalBatchVal = document.getElementById('kpiTotalBatchVal');
  const elTotalBatchSub = document.getElementById('kpiTotalBatchSub');
  const elTotalOutputVal = document.getElementById('kpiTotalOutputVal');
  const elTotalOutputSub = document.getElementById('kpiTotalOutputSub');
  const elAvgYieldVal = document.getElementById('kpiAvgYieldVal');
  const elAvgYieldSub = document.getElementById('kpiAvgYieldSub');
  const elAvgYieldBadge = document.getElementById('kpiAvgYieldBadge');
  const elDeviatedBatchVal = document.getElementById('kpiDeviatedBatchVal');
  const elDeviatedBatchSub = document.getElementById('kpiDeviatedBatchSub');

  const batches = customBatches || getFilteredBatches(currentOwnerPeriod);
  const totalBatches = batches.length;
  const totalActual = batches.reduce((sum, b) => sum + (Number(b.actual) || 0), 0);
  const avgYield = totalBatches > 0 
    ? (batches.reduce((sum, b) => sum + (Number(b.yield) || 0), 0) / totalBatches)
    : 91.4;

  const deviatedList = batches.filter(b => b.status === 'KUNING' || b.status === 'MERAH' || (b.yield && b.yield < 90));
  const deviatedCount = deviatedList.length;

  if (elTotalBatchLabel) {
    if (currentOwnerPeriod === 'last_month') elTotalBatchLabel.textContent = "Total Batch Okt 2026";
    else if (currentOwnerPeriod === 'this_month') elTotalBatchLabel.textContent = "Total Batch Nov 2026";
    else if (currentOwnerPeriod === '7d') elTotalBatchLabel.textContent = "Total Batch 7 Hari";
    else elTotalBatchLabel.textContent = "Total Batch Hari Ini";
  }

  if (elTotalBatchVal) elTotalBatchVal.textContent = `${totalBatches} Batch`;
  if (elTotalBatchSub) {
    elTotalBatchSub.textContent = currentOwnerPeriod === 'last_month' ? "Arsip Produksi Oktober" : `${totalBatches} Selesai • Dapur Operasional`;
  }

  if (elTotalOutputVal) elTotalOutputVal.textContent = `${totalActual} Pcs`;
  if (elTotalOutputSub) {
    if (currentOwnerPeriod === 'last_month') {
      elTotalOutputSub.textContent = "Total Hasil Lolos QC";
    } else {
      const freezer = cycleData.sisaFisikFreezer ?? 290;
      const kedai = cycleData.sisaFisikKedai ?? 65;
      elTotalOutputSub.textContent = `${freezer} Freezer • ${kedai} Kedai`;
    }
  }

  if (elAvgYieldVal) elAvgYieldVal.textContent = `${avgYield.toFixed(1)}%`;
  if (elAvgYieldBadge) {
    elAvgYieldBadge.textContent = `${Math.round(avgYield)}%`;
    if (avgYield >= 90) {
      elAvgYieldBadge.className = "w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm";
      if (elAvgYieldSub) elAvgYieldSub.innerHTML = `<span class="text-emerald-600 font-bold">● Status: HIJAU (&ge;90%)</span>`;
    } else if (avgYield >= 80) {
      elAvgYieldBadge.className = "w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-sm";
      if (elAvgYieldSub) elAvgYieldSub.innerHTML = `<span class="text-amber-600 font-bold">▲ Status: KUNING (80-89%)</span>`;
    } else {
      elAvgYieldBadge.className = "w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-sm";
      if (elAvgYieldSub) elAvgYieldSub.innerHTML = `<span class="text-rose-600 font-bold">■ Status: MERAH (&lt;80%)</span>`;
    }
  }

  if (elDeviatedBatchVal) elDeviatedBatchVal.textContent = `${deviatedCount} Batch`;
  if (elDeviatedBatchSub) {
    if (deviatedCount === 0) {
      elDeviatedBatchSub.textContent = "Nihil Deviasi • Semua Sempurna";
    } else {
      const first = deviatedList[0];
      elDeviatedBatchSub.textContent = `${first.id || 'BAT'}: ${Number(first.yield || 0).toFixed(1)}% (${(first.reason || 'Deviasi').split('(')[0].trim()})`;
    }
  }
}

function renderOwnerInventoryTable() {
  const tbody = document.getElementById('ownerInventoryTableBody');
  const tfoot = document.getElementById('ownerInventoryTableFoot');
  if (!tbody) return;

  const products = (cycleData && cycleData.productsBreakdown && cycleData.productsBreakdown.length) 
    ? cycleData.productsBreakdown 
    : [
      { key: "batagor", name: "Batagor Super", icon: "🥢", stokAwal: 40, masuk: 174, keluarJual: 140, keluarSampel: 5, sisaAkhir: 69, status: "Cocok ✓" },
      { key: "pempek_lenjer", name: "Pempek Lenjer", icon: "🥟", stokAwal: 60, masuk: 196, keluarJual: 90, keluarSampel: 5, sisaAkhir: 161, status: "Cocok ✓" },
      { key: "pempek_crispy", name: "Pempek Crispy", icon: "✨", stokAwal: 50, masuk: 158, keluarJual: 130, keluarSampel: 0, sisaAkhir: 78, status: "Cocok ✓" },
      { key: "pempek_adaan", name: "Pempek Adaan", icon: "🧆", stokAwal: 60, masuk: 112, keluarJual: 120, keluarSampel: 5, sisaAkhir: 47, status: "Cocok ✓" }
    ];

  let sumAwal = 0;
  let sumMasuk = 0;
  let sumJual = 0;
  let sumSampel = 0;
  let sumAkhir = 0;

  tbody.innerHTML = products.map(p => {
    sumAwal += p.stokAwal || 0;
    sumMasuk += p.masuk || 0;
    sumJual += p.keluarJual || 0;
    sumSampel += p.keluarSampel || 0;
    sumAkhir += p.sisaAkhir || 0;

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3.5 font-bold text-[#0F2C59]">${p.icon || '🍱'} ${p.name}</td>
        <td class="p-3.5 text-center text-slate-500">${p.stokAwal}</td>
        <td class="p-3.5 text-center font-bold text-emerald-600">+${p.masuk}</td>
        <td class="p-3.5 text-center font-bold text-rose-600">-${p.keluarJual}</td>
        <td class="p-3.5 text-center font-bold text-amber-600">${p.keluarSampel > 0 ? `-${p.keluarSampel}` : '0'}</td>
        <td class="p-3.5 text-center font-black text-[#0F2C59]">${p.sisaAkhir} Pcs</td>
        <td class="p-3.5 text-center"><span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">Cocok ✓</span></td>
      </tr>
    `;
  }).join('');

  if (tfoot) {
    tfoot.innerHTML = `
      <tr>
        <td class="p-3.5 text-[#0F2C59]">TOTAL KESELURUHAN</td>
        <td class="p-3.5 text-center text-slate-600">${sumAwal}</td>
        <td class="p-3.5 text-center text-emerald-700">+${sumMasuk}</td>
        <td class="p-3.5 text-center text-rose-700">-${sumJual}</td>
        <td class="p-3.5 text-center text-amber-700">-${sumSampel}</td>
        <td class="p-3.5 text-center text-[#0F2C59] font-black text-sm">${sumAkhir} Pcs</td>
        <td class="p-3.5 text-center text-emerald-700">100% Klop</td>
      </tr>
    `;
  }
}

function renderOwnerBatchTable(customBatches = null) {
  const tbody = document.getElementById('ownerBatchTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const records = customBatches || getFilteredBatches(currentOwnerPeriod);

  if (!records || records.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="9" class="p-8 text-center text-slate-400">
        <div class="flex flex-col items-center justify-center gap-1.5">
          <span class="text-2xl">🍳</span>
          <span class="font-bold text-slate-700 text-xs">Belum ada batch yang dimasak pada shift hari ini.</span>
          <span class="text-[11px] text-slate-400">Karyawan dapur dapat mulai memasak batch pertama setelah toko dibuka.</span>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  records.forEach(b => {
    let badge = '';
    if (b.status === 'HIJAU') {
      badge = '<span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">● Hijau (Aman)</span>';
    } else if (b.status === 'KUNING') {
      badge = '<span class="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">▲ Kuning (Periksa)</span>';
    } else {
      badge = '<span class="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-bold">■ Merah (Anomali)</span>';
    }

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition";
    tr.innerHTML = `
      <td class="p-3.5 font-mono font-bold text-slate-800">${b.id}</td>
      <td class="p-3.5 text-slate-500">${b.time || ''}</td>
      <td class="p-3.5 font-bold text-[#0F2C59]">${b.product || ''}</td>
      <td class="p-3.5 text-slate-500">${b.usedBahan || ''}</td>
      <td class="p-3.5 text-center text-slate-600">${b.target || 0}</td>
      <td class="p-3.5 text-center font-bold text-slate-800">${b.actual || 0}</td>
      <td class="p-3.5 text-center font-black ${b.yield >= 90 ? 'text-emerald-600' : 'text-amber-600'}">${b.yield}%</td>
      <td class="p-3.5 text-slate-600"><span class="bg-slate-100 px-2 py-1 rounded text-[11px] font-medium">${b.reason || '-'}</span></td>
      <td class="p-3.5 text-center">${badge}</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Trend Chart (Multi-Period Aware) ---
function drawChart(period = currentOwnerPeriod) {
  const canvas = document.getElementById('trendChartCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const width = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
  const height = canvas.parentElement ? canvas.parentElement.clientHeight : 0;
  if (!width || !height || width <= 70) return;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  let data = [];
  if (period === 'last_month') {
    data = [
      { date: '5 Okt', yield: 96.5 },
      { date: '10 Okt', yield: 93.0 },
      { date: '15 Okt', yield: 97.5 },
      { date: '20 Okt', yield: 86.2 },
      { date: '25 Okt', yield: 96.0 },
      { date: '28 Okt', yield: 98.9 },
      { date: '31 Okt', yield: 94.5 }
    ];
  } else if (period === 'this_month') {
    data = [
      { date: '1 Nov', yield: 94.0 },
      { date: '4 Nov', yield: 92.5 },
      { date: '7 Nov', yield: 94.2 },
      { date: '8 Nov', yield: 88.5 },
      { date: '9 Nov', yield: 96.0 },
      { date: '10 Nov', yield: 91.0 },
      { date: '11 Nov', yield: 86.4 },
      { date: '12 Nov', yield: 95.1 },
      { date: '13 Nov', yield: 97.4 }
    ];
  } else if (period === 'today') {
    const todayList = getFilteredBatches('today');
    if (todayList.length > 0) {
      data = todayList.slice().reverse().map(b => ({
        date: `B-${b.id.split('-').pop()}`,
        yield: Number(b.yield) || 95
      }));
    } else {
      data = chartTrendHistory;
    }
  } else {
    // 7d default
    data = chartTrendHistory;
  }

  const pad = { top: 25, right: 25, bottom: 35, left: 45 };
  const cWidth = width - pad.left - pad.right;
  const cHeight = height - pad.top - pad.bottom;

  ctx.clearRect(0, 0, width, height);

  const minY = 70;
  const maxY = 110;
  const getY = val => pad.top + cHeight - ((val - minY) / (maxY - minY)) * cHeight;
  const getX = idx => pad.left + (idx / Math.max(1, data.length - 1)) * cWidth;

  // Grid
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';

  [70, 80, 90, 100, 110].forEach(val => {
    const y = getY(val);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillText(val + '%', 10, y + 4);
  });

  // Target 90% Line
  const targetY = getY(90);
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad.left, targetY);
  ctx.lineTo(width - pad.right, targetY);
  ctx.stroke();
  ctx.restore();

  // Trend Line
  ctx.strokeStyle = '#1E4E8C';
  ctx.lineWidth = 3;
  ctx.beginPath();
  data.forEach((pt, i) => {
    const x = getX(i);
    const y = getY(pt.yield);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Area
  ctx.lineTo(getX(data.length - 1), getY(minY));
  ctx.lineTo(getX(0), getY(minY));
  ctx.closePath();
  ctx.fillStyle = 'rgba(30, 78, 140, 0.08)';
  ctx.fill();

  // Points
  data.forEach((pt, i) => {
    const x = getX(i);
    const y = getY(pt.yield);

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = pt.yield >= 90 ? '#10B981' : (pt.yield >= 80 ? '#F59E0B' : '#EF4444');
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText(pt.date, x, height - 10);
  });
}

// --- CSV Export (Filter Aware) ---
function exportCSVData() {
  window.location.href = `/api/reports/export-csv?period=${currentOwnerPeriod}`;
}

// --- Quick Navigation Jump ---
function jumpToMockupView(view) {
  if (!view) return;
  if (view === 'login') {
    logout();
  } else if (view === 'kitchen_closed') {
    setStoreOpenedState(false);
    loginAs('karyawan');
  } else if (view === 'kitchen_menu') {
    setStoreOpenedState(true);
    loginAs('karyawan');
    document.getElementById('kStoreClosedState').classList.add('hidden');
    document.getElementById('kStoreOpenState').classList.remove('hidden');
    document.getElementById('stageSelectMenu').classList.remove('hidden');
    document.getElementById('stageRunning').classList.add('hidden');
    document.getElementById('stageFinish').classList.add('hidden');
    document.getElementById('stageAllocate').classList.add('hidden');
  } else if (view === 'kitchen_running') {
    loginAs('karyawan');
    document.getElementById('kStoreClosedState').classList.add('hidden');
    document.getElementById('kStoreOpenState').classList.remove('hidden');
    handleStartProduction();
  } else if (view === 'kitchen_finish') {
    loginAs('karyawan');
    document.getElementById('kStoreClosedState').classList.add('hidden');
    document.getElementById('kStoreOpenState').classList.remove('hidden');
    handleStartProduction();
    handleFinishCooking();
  } else if (view === 'kitchen_allocate') {
    loginAs('karyawan');
    document.getElementById('kStoreClosedState').classList.add('hidden');
    document.getElementById('kStoreOpenState').classList.remove('hidden');
    handleStartProduction();
    handleFinishCooking();
    handleSaveYieldToAllocate();
  } else if (view === 'kitchen_close_day') {
    loginAs('karyawan');
    document.getElementById('kStoreClosedState').classList.add('hidden');
    document.getElementById('kStoreOpenState').classList.remove('hidden');
    handleStartProduction();
    handleFinishCooking();
    handleSaveYieldToAllocate();
    setTimeout(openCloseDayModal, 100);
  } else if (view === 'owner_summary') {
    loginAs('owner');
    setOwnerTab('summary');
  } else if (view === 'owner_import') {
    loginAs('owner');
    setOwnerTab('summary');
    setTimeout(openImportRanduModal, 100);
  } else if (view === 'owner_batches') {
    loginAs('owner');
    setOwnerTab('batches');
  } else if (view === 'owner_inventory') {
    loginAs('owner');
    setOwnerTab('inventory');
  } else if (view === 'owner_bom') {
    loginAs('owner');
    setOwnerTab('bom');
  } else if (view === 'owner_sample') {
    loginAs('owner');
    setOwnerTab('summary');
    setTimeout(openSpecialModal, 100);
  }
}

window.addEventListener('resize', () => {
  if (window.innerWidth >= 768) {
    closeOwnerMobileSidebar();
  }
  if (currentRole === 'owner') {
    drawChart(7);
  }
});

// Explicitly bind all UI event handlers to window
window.selectRoleForLogin = selectRoleForLogin;
window.backToRoleSelect = backToRoleSelect;
window.appendPinDigit = appendPinDigit;
window.clearPinInput = clearPinInput;
window.backspacePinInput = backspacePinInput;
window.handlePinLogin = handlePinLogin;
window.loginAs = loginAs;
window.logout = logout;
window.setOwnerTab = setOwnerTab;
window.toggleOwnerMobileSidebar = toggleOwnerMobileSidebar;
window.closeOwnerMobileSidebar = closeOwnerMobileSidebar;
window.handleBukaToko = handleBukaToko;
window.handleSelectMenu = handleSelectMenu;
window.handleBatchStepper = handleBatchStepper;
window.handleStartProduction = handleStartProduction;
window.handleActualInputChange = handleActualInputChange;
window.handleFinishCooking = handleFinishCooking;
window.handleSaveYieldToAllocate = handleSaveYieldToAllocate;
window.handleSaveAndFinishBatch = handleSaveAndFinishBatch;
window.handleCloseStoreFromAllocate = handleCloseStoreFromAllocate;
window.handleLoopNextBatch = handleLoopNextBatch;
window.checkAllocBalance = checkAllocBalance;
window.openCloseDayModal = openCloseDayModal;
window.closeCloseDayModal = closeCloseDayModal;
window.submitCloseDay = submitCloseDay;
window.openSpecialModal = openSpecialModal;
window.closeSpecialModal = closeSpecialModal;
window.submitSpecialSample = submitSpecialSample;
window.openImportRanduModal = openImportRanduModal;
window.closeImportRanduModal = closeImportRanduModal;
window.triggerRanduFileInput = triggerRanduFileInput;
window.resetRanduFileInput = resetRanduFileInput;
window.handleRanduFileSelect = handleRanduFileSelect;
window.handleRanduFileDrop = handleRanduFileDrop;
window.loadSampleRanduData = loadSampleRanduData;
window.processImportRandu = processImportRandu;
window.processRanduImport = processImportRandu;
window.exportCSVData = exportCSVData;
window.toggleReasonPill = toggleReasonPill;
window.filterOwnerBatches = filterOwnerBatches;
window.setScreenSimulation = setScreenSimulation;
window.jumpToMockupView = jumpToMockupView;
window.showToast = showToast;
window.getStoreOpenedState = getStoreOpenedState;
window.setStoreOpenedState = setStoreOpenedState;
window.renderKitchenStoreState = renderKitchenStoreState;
window.renderKitchenStockStatus = renderKitchenStockStatus;
window.selectMenuCard = selectMenuCard;
window.renderOwnerStoreStatus = renderOwnerStoreStatus;
window.renderOwnerKpiCards = renderOwnerKpiCards;
window.renderOwnerInventoryTable = renderOwnerInventoryTable;
window.renderOwnerBomCards = renderOwnerBomCards;
window.openAddRecipeModal = openAddRecipeModal;
window.openEditRecipeModal = openEditRecipeModal;
window.closeRecipeModal = closeRecipeModal;
window.addIngredientRow = addIngredientRow;
window.recalculateModalHpp = recalculateModalHpp;
window.saveRecipeForm = saveRecipeForm;
window.deleteRecipe = deleteRecipe;
window.handleManualTargetChange = handleManualTargetChange;
window.modifyManualTarget = modifyManualTarget;
window.setManualTargetPreset = setManualTargetPreset;
window.updateTargetPresetButtons = updateTargetPresetButtons;
window.getEditedIngredients = getEditedIngredients;
window.updateLiveDates = updateLiveDates;
window.setOwnerPeriodFilter = setOwnerPeriodFilter;
window.getFilteredBatches = getFilteredBatches;
window.openRestockModal = openRestockModal;
window.openRestockModalFor = openRestockModalFor;
window.closeRestockModal = closeRestockModal;
window.updateRestockUnitLabel = updateRestockUnitLabel;
window.saveRestockMaterial = saveRestockMaterial;
window.openTransferModal = openTransferModal;
window.closeTransferModal = closeTransferModal;
window.saveTransferStock = saveTransferStock;
window.renderMultiLocationCards = renderMultiLocationCards;
window.renderMaterialLogs = renderMaterialLogs;

