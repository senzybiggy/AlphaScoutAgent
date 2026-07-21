import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

// POST /api/analyze
router.post("/", async (req, res) => {
  const { target, type, chain } = req.body as {
    target: string;
    type: "wallet" | "token" | "contract" | "project";
    chain?: string;
  };

  if (!target || !type) {
    res.status(400).json({ error: "target and type are required" });
    return;
  }

  const systemPrompt = `You are AlphaScout AI, an expert blockchain intelligence engine. Analyze the given ${type} and return a structured JSON analysis.

Return ONLY valid JSON with this exact structure:
{
  "summary": "2-3 sentence executive summary of findings",
  "riskScore": <integer 0-100, where 0=no risk, 100=extreme risk>,
  "metrics": [
    { "label": "Metric Name", "value": "value string", "trend": "up|down|neutral|null" }
  ],
  "insights": [
    "Key insight string 1",
    "Key insight string 2",
    "Key insight string 3"
  ]
}

Include 4-6 metrics relevant to the ${type} type. Be specific and data-driven. For wallets include transaction count, balance range, activity patterns. For tokens include market cap range, liquidity, holder concentration. For contracts include code quality indicators, audit status, risk factors. For projects include team transparency, tokenomics, roadmap credibility.`;

  const userMessage = `Analyze this ${type}${chain ? ` on ${chain}` : ""}: ${target}

Provide a realistic but clearly simulated analysis (since you don't have live blockchain access). Make it detailed and professional.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    res.status(500).json({ error: "No response from AI" });
    return;
  }

  let parsed: {
    summary: string;
    riskScore: number;
    metrics: Array<{ label: string; value: string; trend: string | null }>;
    insights: string[];
  };

  try {
    // Extract JSON from response (may have markdown code fences)
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    res.status(500).json({ error: "Failed to parse AI analysis" });
    return;
  }

  res.json({
    target,
    type,
    chain: chain ?? null,
    summary: parsed.summary,
    riskScore: parsed.riskScore,
    metrics: parsed.metrics,
    insights: parsed.insights,
    analyzedAt: new Date().toISOString(),
  });
});

export default router;
