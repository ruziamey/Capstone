// routes/reports.js
import { Hono } from "hono";
import { store } from "../db/store.js";

export const reportsRouter = new Hono();

// Get yield history for trend chart (today, 7d, this_month, last_month)
reportsRouter.get("/yield-trend", (c) => {
  const period = c.req.query("period") || (c.req.query("days") === "30" ? "this_month" : (c.req.query("days") === "14" ? "7d" : "today"));
  const history = store.getYieldTrendByPeriod(period);
  return c.json({
    success: true,
    period,
    history
  });
});

// Download Finance CSV audit file with dynamic period filtering
reportsRouter.get("/export-csv", (c) => {
  const period = c.req.query("period") || "today";
  const { csv, filename } = store.getAuditCSV(period);
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.body(csv);
});
