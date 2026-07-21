import { Router, type IRouter } from "express";
import healthRouter   from "./health.js";
import agentRouter    from "./agent.js";
import anthropicRouter from "./anthropic/conversations.js";
import analyzeRouter  from "./analyze/index.js";
import agentsRouter   from "./agents.js";
import v1Router       from "./v1/index.js";
import openApiRouter  from "./openapi.js";

const router: IRouter = Router();

// ── Health (no auth, no rate-limit bypass needed — handled in middleware) ────
router.use(healthRouter);

// ── OpenAPI docs ─────────────────────────────────────────────────────────────
router.use("/docs", openApiRouter);

// ── OKX AI Agent Service Provider protocol ───────────────────────────────────
router.use("/agent", agentRouter);

// ── Versioned typed analysis endpoints (v1) ───────────────────────────────────
router.use("/v1", v1Router);

// ── Legacy routes — kept for UI and backward compatibility ───────────────────
router.use("/anthropic/conversations", anthropicRouter);
router.use("/analyze", analyzeRouter);
router.use("/agents", agentsRouter);   // UI agent listing

export default router;
