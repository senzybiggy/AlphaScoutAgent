import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentRouter from "./agent.js";
import anthropicRouter from "./anthropic/conversations";
import analyzeRouter from "./analyze/index.js";
import agentsRouter from "./agents";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/agent", agentRouter);          // OKX AI Agent Service Provider
router.use("/anthropic/conversations", anthropicRouter);
router.use("/analyze", analyzeRouter);      // legacy — kept for UI compatibility
router.use("/agents", agentsRouter);        // legacy — kept for UI compatibility

export default router;
