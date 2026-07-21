import Anthropic from "@anthropic-ai/sdk";

const apiKey =
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ??
  process.env.ANTHROPIC_API_KEY;

/** True when the key is an OpenRouter key (sk-or-v1-...) */
export const IS_OPENROUTER = Boolean(apiKey?.startsWith("sk-or-v1-"));

// Base URL resolution (priority order):
//   1. Replit AI Integration proxy
//   2. Explicit override (ANTHROPIC_BASE_URL)
//   3. Auto-detected OpenRouter → use their OpenAI-compatible endpoint
//   4. Default → Anthropic (api.anthropic.com)
export const AI_BASE_URL: string | undefined =
  process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ??
  process.env.ANTHROPIC_BASE_URL ??
  (IS_OPENROUTER ? "https://openrouter.ai/api/v1" : undefined);

export const AI_API_KEY = apiKey;

if (!apiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY must be set. Add your Anthropic or OpenRouter API key as a Replit environment secret.",
  );
}

// Anthropic SDK client — only used when NOT on OpenRouter.
// OpenRouter exposes the OpenAI /chat/completions format, not /messages.
export const anthropic = new Anthropic({ apiKey });

/**
 * Canonical model IDs per provider.
 * - Anthropic native: claude-sonnet-4-6
 * - OpenRouter:       nvidia/nemotron-3-super-120b-a12b:free (no-cost tier, 120B)
 */
export const CLAUDE_MODEL = IS_OPENROUTER
  ? "nvidia/nemotron-3-super-120b-a12b:free"
  : "claude-sonnet-4-6";
