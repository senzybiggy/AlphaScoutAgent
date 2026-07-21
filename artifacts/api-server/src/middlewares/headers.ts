/**
 * Response Headers Middleware
 *
 * Attaches standard API metadata headers to every response:
 *   X-API-Version   — semver of this service
 *   X-Request-Id    — unique request ID (from pino-http)
 *   X-Powered-By    — branding
 *   Access-Control-Expose-Headers — ensures JS clients can read custom headers
 */

import type { Request, Response, NextFunction } from "express";

const SERVICE_VERSION = "1.0.0";
const EXPOSED = ["X-API-Version", "X-Request-Id", "X-Auth-Mode", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"].join(", ");

export function headersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-API-Version", SERVICE_VERSION);
  res.setHeader("X-Powered-By", "AlphaScout AI / OKX AI Agent Service Provider");
  res.setHeader("Access-Control-Expose-Headers", EXPOSED);
  next();
}
