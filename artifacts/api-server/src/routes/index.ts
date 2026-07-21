import { Router, type IRouter } from "express";
import healthRouter from "./health";
import anthropicRouter from "./anthropic/conversations";
import analyzeRouter from "./analyze";
import agentsRouter from "./agents";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/anthropic/conversations", anthropicRouter);
router.use("/analyze", analyzeRouter);
router.use("/agents", agentsRouter);

export default router;
