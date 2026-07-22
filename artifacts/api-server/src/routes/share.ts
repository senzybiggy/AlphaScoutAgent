/**
 * Share report endpoints.
 * POST /api/share        — store a result JSON with a UUID token
 * GET  /api/share/:token — retrieve a stored result by token
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sharedReports } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

function uuid(): string {
  return "xxxx-xxxx-xxxx-xxxx".replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  ) + "-" + Date.now().toString(36);
}

const router = Router();

router.post("/", async (req, res) => {
  const { result } = req.body as { result?: Record<string, unknown> };
  if (!result || typeof result !== "object") {
    res.status(400).json({ error: "result is required" });
    return;
  }
  try {
    const token = uuid();
    // Expire after 30 days
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(sharedReports).values({
      token,
      result,
      target: String(result.target ?? ""),
      type: String(result.type ?? ""),
      expiresAt,
    });
    res.json({ token, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    logger.error({ err }, "Failed to create shared report");
    res.status(500).json({ error: "Failed to create share link" });
  }
});

router.get("/:token", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(sharedReports)
      .where(eq(sharedReports.token, req.params.token))
      .limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "Shared report not found or expired" });
      return;
    }
    const row = rows[0];
    // Check expiry
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
      res.status(404).json({ error: "Shared report has expired" });
      return;
    }
    res.json({ result: row.result, createdAt: row.createdAt });
  } catch (err) {
    logger.error({ err }, "Failed to fetch shared report");
    res.status(500).json({ error: "Failed to load shared report" });
  }
});

export default router;
