import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { globalLimiter } from "./middlewares/rate-limit.js";
import { authMiddleware } from "./middlewares/auth.js";
import { headersMiddleware } from "./middlewares/headers.js";

const app: Express = express();

// ── Request logging ─────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id:     req.id,
          method: req.method,
          url:    req.url?.split("?")[0],
          // Include masked API key identity when present
          apiKey: (req.raw as Record<string, unknown>).apiKeyId ?? undefined,
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── Security & metadata headers ─────────────────────────────────────────────
app.use(headersMiddleware);

// ── CORS — allow all origins (public ASP) ──────────────────────────────────
app.use(
  cors({
    origin: "*",
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Key",
      "X-Request-Id",
      "X-Request-Source",
    ],
    exposedHeaders: [
      "X-API-Version",
      "X-Request-Id",
      "X-Auth-Mode",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ],
  }),
);

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Global rate limiter (all routes, generous baseline) ──────────────────────
app.use(globalLimiter);

// ── API key authentication (optional enforcement) ────────────────────────────
app.use("/api", authMiddleware);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", router);

export default app;
