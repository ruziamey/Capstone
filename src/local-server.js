// src/local-server.js - Local development server using Node.js
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import app from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = fs.existsSync(path.join(__dirname, "public"))
  ? path.relative(process.cwd(), path.join(__dirname, "public")).replace(/\\/g, "/")
  : (fs.existsSync("./src/public") ? "./src/public" : "./code app/src/public");

// Serve static frontend files from public folder
app.use("/*", serveStatic({ root: publicDir }));

// Fallback to index.html for single-page application routing
app.get("*", serveStatic({ path: `${publicDir}/index.html` }));

const PORT = Number(process.env.PORT) || 3000;

console.log("\n" + "=".repeat(65));
console.log("🐟 JEOL SMART STOCK CONTROL - SISTEM KONTROL PRODUKSI & STOK");
console.log("   Mitra: PT Jiva Mandala Dharma (Jeol Food Indonesia)");
console.log("=".repeat(65));
console.log(`🚀 Server lokal aktif dan siap diuji:`);
console.log(`   👉 Buka browser di: http://localhost:${PORT}`);
console.log(`   👉 API Health Check : http://localhost:${PORT}/health`);
console.log(`   👉 API Summary      : http://localhost:${PORT}/api/inventory/summary`);
console.log("=".repeat(65));
console.log("Tekan Ctrl+C untuk menghentikan server lokal.\n");

serve({
  fetch: app.fetch,
  port: PORT
});
