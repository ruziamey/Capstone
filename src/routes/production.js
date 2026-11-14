// routes/production.js
import { Hono } from "hono";
import { store } from "../db/store.js";

export const productionRouter = new Hono();

// Get current shift status
productionRouter.get("/status", (c) => {
  return c.json({
    success: true,
    isStoreOpened: store.isStoreOpened,
    openedAt: store.openedAt,
    closedAt: store.closedAt,
    activeBatch: store.activeBatch,
    closeDayRecord: store.closeDayRecord
  });
});

// Open store / start shift (Open Day Lock)
productionRouter.post("/open-store", async (c) => {
  try {
    let name = "Karyawan";
    try {
      const body = await c.req.json();
      if (body.operatorName) name = body.operatorName;
    } catch {}
    const result = store.openStore(name);
    return c.json(result);
  } catch (err) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

// Start a batch (Select menu + batch size 1-5, BOM calculation)
productionRouter.post("/batch/start", async (c) => {
  try {
    const body = await c.req.json();
    const batch = store.startBatch(body);
    return c.json({ success: true, batch });
  } catch (err) {
    return c.json({ success: false, message: err.message }, 400);
  }
});

// Finish cooking & input actual QC output (Calculates Yield RAG and Reason)
productionRouter.post("/batch/finish", async (c) => {
  try {
    const body = await c.req.json();
    const batch = store.finishCooking(body);
    return c.json({ success: true, batch });
  } catch (err) {
    return c.json({ success: false, message: err.message }, 400);
  }
});

// Allocate finished output into Freezer vs Kedai
productionRouter.post("/batch/allocate", async (c) => {
  try {
    const body = await c.req.json();
    const batch = store.allocateStock(body);
    return c.json({ success: true, batch });
  } catch (err) {
    return c.json({ success: false, message: err.message }, 400);
  }
});

// Close store & reconcile day with physical opname count
productionRouter.post("/close-store", async (c) => {
  try {
    let data = {};
    try {
      data = await c.req.json();
    } catch {}
    const result = store.closeStore(data);
    return c.json(result);
  } catch (err) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

// List batches (with optional period query: today, 7d, this_month, last_month)
productionRouter.get("/batches", (c) => {
  const period = c.req.query("period");
  const list = period ? store.getBatchesByPeriod(period) : store.batches;
  return c.json({
    success: true,
    totalBatches: list.length,
    period: period || "all",
    batches: list
  });
});
