/**
 * API Key Authentication Middleware
 *
 * Accepts keys via:
 *   X-API-Key: <key>
 *   Authorization: Bearer <key>
 *
 * Enforcement mode:
 *   - If API_KEYS env var is set (comma-separated list), keys are enforced.
 *   - If not set, middleware runs in "open" evaluation mode (no key required).
 *
 * Skipped entirely for: /healthz, /agent/health, /docs
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

const BYPASS_PATHS = new Set([
  "/api/healthz",
  "/api/agent/health",
  "/api/agent/manifest",
  "/api/agent/card",
  "/api/docs",
  "/api/docs/ui",
]);

function getConfiguredKeys(): Set<string> | null {
  const raw = process.env["API_KEYS"] ?? process.env["API_KEY"] ?? "";
  if (!raw.trim()) return null;
  const keys = raw.split(",").map((k) => k.trim()).filter(Boolean);
  return keys.length > 0 ? new Set(keys) : null;
}

function extractKey(req: Request): string | null {
  const fromHeader = req.headers["x-api-key"];
  if (typeof fromHeader === "string" && fromHeader.trim()) return fromHeader.trim();

  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  return null;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Bypass for public discovery endpoints
  if (BYPASS_PATHS.has(req.path)) {
    res.setHeader("X-Auth-Mode", "open");
    next();
    return;
  }

  const configuredKeys = getConfiguredKeys();

  if (!configuredKeys) {
    // Evaluation mode — no keys configured, all requests pass
    res.setHeader("X-Auth-Mode", "open");
    next();
    return;
  }

  // Enforcement mode
  res.setHeader("X-Auth-Mode", "enforced");
  const providedKey = extractKey(req);

  if (!providedKey) {
    res.status(401).json({
      error: "Unauthorized",
      message: "API key required. Pass via X-API-Key header or Authorization: Bearer <key>.",
      docs: "/api/docs",
    });
    return;
  }

  if (!configuredKeys.has(providedKey)) {
    logger.warn({ path: req.path, method: req.method }, "Auth rejected — invalid API key");
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid API key.",
      docs: "/api/docs",
    });
    return;
  }

  // Key is valid — attach a masked identity for logging
  (req as Request & { apiKeyId?: string }).apiKeyId = `key:${providedKey.slice(0, 4)}****`;
  next();
}
