/**
 * Provider-agnostic AI call helpers.
 *
 * Internally routes to:
 *   - Anthropic SDK (/v1/messages)  when using a native Anthropic key
 *   - OpenAI-compatible fetch       when using an OpenRouter key (sk-or-v1-…)
 *
 * Consumers import { callAI, streamAI } and never touch provider-specific
 * SDKs or model strings directly.
 */

import { anthropic, IS_OPENROUTER, AI_BASE_URL, AI_API_KEY, CLAUDE_MODEL } from "./client.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CallAIOptions {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

/** One-shot AI call — returns the full response text. */
export async function callAI(opts: CallAIOptions): Promise<string> {
  const { system, messages, maxTokens = 8192 } = opts;

  if (IS_OPENROUTER) {
    const url = `${AI_BASE_URL}/chat/completions`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://alphascout.ai",
        "X-Title": "AlphaScout AI",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`OpenRouter error ${resp.status}: ${body.slice(0, 300)}`);
    }

    const data = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
      error?: { message: string };
    };

    if (data.error) throw new Error(`OpenRouter: ${data.error.message}`);

    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenRouter returned no content");
    return text;
  }

  // Native Anthropic SDK path
  const msg = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  });

  const block = msg.content.find((c) => c.type === "text");
  if (!block || block.type !== "text") throw new Error("Anthropic returned no text content");
  return block.text;
}

/**
 * Streaming AI call — yields text deltas via an async generator.
 * Caller is responsible for flushing SSE to the response.
 */
export async function* streamAI(opts: CallAIOptions): AsyncGenerator<string> {
  const { system, messages, maxTokens = 8192 } = opts;

  if (IS_OPENROUTER) {
    const url = `${AI_BASE_URL}/chat/completions`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://alphascout.ai",
        "X-Title": "AlphaScout AI",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        stream: true,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });

    if (!resp.ok || !resp.body) {
      const body = await resp.text().catch(() => "");
      throw new Error(`OpenRouter stream error ${resp.status}: ${body.slice(0, 300)}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;
        try {
          const chunk = JSON.parse(trimmed.slice(6)) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // skip malformed chunks
        }
      }
    }
    return;
  }

  // Native Anthropic streaming path
  const stream = anthropic.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
