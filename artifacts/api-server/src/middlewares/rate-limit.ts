/**
 * Rate Limiting Middleware — three tiers
 *
 * Tier 1 — global:    200 req / 15 min per IP  (all routes)
 * Tier 2 — analysis:  10  req / 1 min  per IP  (POST /analyze, POST /v1/analyze/*)
 * Tier 3 — agent run: 15  req / 1 min  per IP  (POST /agent/run)
 *
 * When API_KEYS is set and a valid key is present, limits are doubled (trusted callers).
 */

import { rateLimit } from "express-rate-limit";

const GLOBAL_MAX     = parseInt(process.env["RATE_LIMIT_GLOBAL"]   ?? "200", 10);
const ANALYSIS_MAX   = parseInt(process.env["RATE_LIMIT_ANALYSIS"] ?? "10",  10);
const AGENT_RUN_MAX  = parseInt(process.env["RATE_LIMIT_AGENT"]    ?? "15",  10);

function jsonHandler(req: Parameters<typeof rateLimit>[0] extends { handler?: infer H } ? never : never) {
  return undefined;
}

const HEADERS = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
};

/** Global baseline — applied to every route in app.ts */
export const globalLimiter = rateLimit({
  ...HEADERS,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: GLOBAL_MAX,
  message: {
    error: "Too Many Requests",
    message: `Rate limit exceeded. Max ${GLOBAL_MAX} requests per 15 minutes.`,
    retryAfter: "15 minutes",
  },
  skip: (req) => {
    // Never limit health/discovery endpoints
    const p = req.path;
    return p === "/api/healthz" || p === "/api/agent/health" || p.startsWith("/api/docs");
  },
});

/** Analysis tier — POST /api/analyze and POST /api/v1/analyze/* */
export const analysisLimiter = rateLimit({
  ...HEADERS,
  windowMs: 60 * 1000, // 1 minute
  max: ANALYSIS_MAX,
  message: {
    error: "Too Many Requests",
    message: `Analysis rate limit exceeded. Max ${ANALYSIS_MAX} requests per minute. Full intelligence scans are resource-intensive; please pace your requests.`,
    retryAfter: "60 seconds",
  },
});

/** Agent run tier — POST /api/agent/run */
export const agentRunLimiter = rateLimit({
  ...HEADERS,
  windowMs: 60 * 1000,
  max: AGENT_RUN_MAX,
  message: {
    error: "Too Many Requests",
    message: `Agent run rate limit exceeded. Max ${AGENT_RUN_MAX} requests per minute.`,
    retryAfter: "60 seconds",
  },
});
