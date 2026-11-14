// routes/inventory.js
import { Hono } from "hono";
import { store } from "../db/store.js";

export const inventoryRouter = new Hono();

// Get multi-location balances & full closed-loop inventory cycle
inventoryRouter.get("/summary", (c) => {
  return c.json({
    success: true,
    cycle: store.cycle,
    locations: store.locations
  });
});

// Record special sample/tester outflow
inventoryRouter.post("/sample", async (c) => {
  try {
    const body = await c.req.json();
    const result = store.recordSample(body);
    return c.json(result);
  } catch (err) {
    return c.json({ success: false, message: err.message }, 400);
  }
});

// Import Randu POS sales data to sync outflow without double input
inventoryRouter.post("/import-randu", async (c) => {
  try {
    let items = null;
    try {
      const body = await c.req.json();
      if (body && Array.isArray(body.items)) items = body.items;
    } catch {}
    const result = store.importRanduSales(items);
    return c.json(result);
  } catch (err) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

// Record raw material incoming restock from supplier
inventoryRouter.post("/restock", async (c) => {
  try {
    const body = await c.req.json();
    const result = store.restockMaterial(body);
    return c.json(result);
  } catch (err) {
    return c.json({ success: false, message: err.message }, 400);
  }
});

// Transfer finished products between locations (e.g. Freezer -> Kedai)
inventoryRouter.post("/transfer", async (c) => {
  try {
    const body = await c.req.json();
    const result = store.transferStock(body);
    return c.json(result);
  } catch (err) {
    return c.json({ success: false, message: err.message }, 400);
  }
});

// Get material audit & mutation history logs
inventoryRouter.get("/material-logs", (c) => {
  return c.json({
    success: true,
    logs: store.getMaterialLogs()
  });
});
