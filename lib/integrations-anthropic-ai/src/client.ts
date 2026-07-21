import Anthropic from "@anthropic-ai/sdk";

// Support both Replit AI Integration vars and user's own API key
const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

if (!apiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY must be set. Please add your Anthropic API key as an environment secret.",
  );
}

export const anthropic = new Anthropic({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});
