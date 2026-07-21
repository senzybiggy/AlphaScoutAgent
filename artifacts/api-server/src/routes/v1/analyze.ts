/**
 * POST /api/v1/analyze/wallet
 * POST /api/v1/analyze/token
 * POST /api/v1/analyze/contract
 * POST /api/v1/analyze/project
 *
 * Versioned, typed wrappers around the core analysis service.
 * Returns a clean, structured JSON response with an explicit API version field.
 */

import { Router } from "express";
import { analyzeTarget, VALID_TYPES } from "../../services/analyze-service.js";
import { analysisLimiter } from "../../middlewares/rate-limit.js";

const router = Router();

/** Shared type → handler for all four analysis types */
function makeHandler(type: (typeof VALID_TYPES)[number]) {
  return async (req: Parameters<typeof router.post>[1], res: Parameters<typeof router.post>[2]) => {
    const body = req.body as Record<string, unknown>;
    const target = typeof body.target === "string" ? body.target.trim() : "";
    const chain  = typeof body.chain  === "string" ? body.chain.trim()  : undefined;

    if (!target) {
      res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "target is required",
        field: "target",
        docs: "/api/docs",
      });
      return;
    }

    try {
      const result = await analyzeTarget({ target, type, chain });
      res.json({
        success:    true,
        apiVersion: "v1",
        data:       result,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes("rate_limit") || msg.includes("429");
      const is402 = msg.includes("402") || msg.toLowerCase().includes("insufficient credits") || msg.toLowerCase().includes("payment");
      const is401 = msg.includes("401") || msg.includes("invalid_api_key") || msg.includes("authentication");

      if (is429) { res.status(429).json({ success: false, error: "RATE_LIMITED",           message: "AI rate limit reached. Please retry." }); return; }
      if (is402) { res.status(402).json({ success: false, error: "INSUFFICIENT_CREDITS",   message: "AI provider has insufficient credits." }); return; }
      if (is401) { res.status(401).json({ success: false, error: "AI_AUTH_FAILED",         message: "AI API key is invalid or missing." }); return; }

      req.log.error({ err, type, target }, "v1 analyze error");
      res.status(500).json({ success: false, error: "ANALYSIS_FAILED", message: "Analysis failed. Please try again." });
    }
  };
}

// Apply the analysis rate-limiter to all v1 analyze routes
router.use(analysisLimiter);

router.post("/wallet",   makeHandler("wallet"));
router.post("/token",    makeHandler("token"));
router.post("/contract", makeHandler("contract"));
router.post("/project",  makeHandler("project"));

/** Catch calls to /analyze (without subpath) */
router.post("/", (req, res) => {
  const body = req.body as Record<string, unknown>;
  const type = String(body.type ?? "").trim();
  if (!type || !(VALID_TYPES as string[]).includes(type)) {
    res.status(400).json({
      success: false,
      error: "INVALID_TYPE",
      message: `type must be one of: ${VALID_TYPES.join(", ")}. Or use the typed endpoints: /api/v1/analyze/{type}`,
      validTypes: VALID_TYPES,
      docs: "/api/docs",
    });
    return;
  }
  return makeHandler(type as (typeof VALID_TYPES)[number])(req, res);
});

export default router;
