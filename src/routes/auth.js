// routes/auth.js
import { Hono } from "hono";
import { store } from "../db/store.js";

export const authRouter = new Hono();

authRouter.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { pin, role } = body;
    if (!pin) {
      return c.json({ success: false, message: "PIN wajib diisi." }, 400);
    }
    const result = store.authenticate(pin, role);
    if (!result.success) {
      return c.json(result, 401);
    }
    return c.json(result);
  } catch (err) {
    return c.json({ success: false, message: err.message }, 500);
  }
});
