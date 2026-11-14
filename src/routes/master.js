// routes/master.js
import { Hono } from "hono";
import { store } from "../db/store.js";

export const masterRouter = new Hono();

// Get all products with current stock status and BOM
masterRouter.get("/products", (c) => {
  return c.json({
    success: true,
    data: store.getProducts()
  });
});

// Get single product details
masterRouter.get("/products/:key", (c) => {
  const key = c.req.param("key");
  const product = store.getProduct(key);
  if (!product) {
    return c.json({ success: false, message: "Produk tidak ditemukan." }, 404);
  }
  return c.json({ success: true, data: product });
});

// Create new product / recipe
masterRouter.post("/products", async (c) => {
  try {
    const body = await c.req.json();
    const product = store.saveProduct(body);
    return c.json({ success: true, data: product });
  } catch (err) {
    return c.json({ success: false, message: err.message }, 400);
  }
});

// Update product / recipe
masterRouter.put("/products/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const body = await c.req.json();
    const product = store.saveProduct({ ...body, key });
    return c.json({ success: true, data: product });
  } catch (err) {
    return c.json({ success: false, message: err.message }, 400);
  }
});

// Delete product
masterRouter.delete("/products/:key", (c) => {
  const key = c.req.param("key");
  const success = store.deleteProduct(key);
  if (!success) {
    return c.json({ success: false, message: "Produk tidak ditemukan." }, 404);
  }
  return c.json({ success: true, message: "Produk berhasil dihapus." });
});
