// src/index.js - Main Cloudflare Worker entry point
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { authRouter } from "./routes/auth.js";
import { masterRouter } from "./routes/master.js";
import { inventoryRouter } from "./routes/inventory.js";
import { productionRouter } from "./routes/production.js";
import { reportsRouter } from "./routes/reports.js";

const app = new Hono();

// Global Middlewares
app.use("*", logger());
app.use("*", cors());

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    app: "Jeol Smart Stock Control",
    platform: "Cloudflare Workers / Hono",
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.route("/api/auth", authRouter);
app.route("/api/master", masterRouter);
app.route("/api/inventory", inventoryRouter);
app.route("/api/production", productionRouter);
app.route("/api/reports", reportsRouter);

// Fallback for Cloudflare Workers Static Assets binding (when deployed with assets)
app.all("*", async (c, next) => {
  if (c.env && c.env.ASSETS && typeof c.env.ASSETS.fetch === "function") {
    return await c.env.ASSETS.fetch(c.req.raw);
  }
  return next();
});

export default app;
