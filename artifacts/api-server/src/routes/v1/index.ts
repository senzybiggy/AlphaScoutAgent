/**
 * /api/v1 — Versioned API router
 *
 * All v1 routes return:
 *   { success: true|false, apiVersion: "v1", data: {...} }
 */

import { Router } from "express";
import v1AnalyzeRouter from "./analyze.js";

const router = Router();

/** Version metadata */
router.get("/", (_req, res) => {
  res.json({
    apiVersion: "v1",
    status: "stable",
    released: "2025-07-01",
    endpoints: {
      "POST /api/v1/analyze":          "Analyze any target (requires type in body)",
      "POST /api/v1/analyze/wallet":   "Wallet analysis — real on-chain data + AI",
      "POST /api/v1/analyze/token":    "Token analysis — DexScreener + GoPlus + AI",
      "POST /api/v1/analyze/contract": "Smart contract security — GoPlus audit + AI",
      "POST /api/v1/analyze/project":  "Project research — AI-powered analysis",
    },
    docs: "/api/docs",
  });
});

router.use("/analyze", v1AnalyzeRouter);

export default router;
