import type { Analyzer, AnalyzerInput, AnalyzerOutput, ProjectScanData } from "./types.js";
import { fetchProjectData, isUrl } from "../../services/project-fetcher.js";

export const projectAnalyzer: Analyzer = {
  systemPrompt(input: AnalyzerInput, scanData?: unknown): string {
    const d = scanData as ProjectScanData | undefined;

    if (!d || !d.url) {
      // No URL — AI knowledge only
      return `You are AlphaScout AI, a blockchain project intelligence analyst.
Analyze the blockchain project: "${input.target}"

You are using your training knowledge. Use hedged language ("appears to", "likely", "based on known information").
Return ONLY valid JSON (no markdown fences):
{
  "executiveSummary": "<2-3 sentences: what the project does, market position, legitimacy assessment>",
  "riskScore": <0-100. Established projects=5-30; newer/unverified=40-60; unknown=50-70; scam signals=80-100>,
  "keyFindings": ["<5 specific observations about the project>"],
  "risks": ["<3-4 risk factors>"],
  "opportunities": ["<2-3 upside factors>"],
  "recommendations": ["<3-4 due diligence steps>"],
  "confidenceScore": <0-100. Well-known project=70-90; partially known=40-69; unknown=10-39>,
  "metrics": [],
  "sections": [
    { "title": "Project Overview", "items": [
      { "label": "Category", "value": "<DeFi/NFT/L2/Gaming/DAO/etc>", "trend": null },
      { "label": "Primary Chain", "value": "<chain>", "trend": null },
      { "label": "Status", "value": "<Active/Unknown/Inactive>", "trend": null },
      { "label": "Active Since", "value": "<year or Unknown>", "trend": null }
    ]},
    { "title": "Token & Economics", "items": [
      { "label": "Has Token", "value": "<Yes/No/Unknown>", "trend": null },
      { "label": "Token Utility", "value": "<governance/fee/staking/Unknown>", "trend": null },
      { "label": "TVL", "value": "<estimate or Unknown>", "trend": null }
    ]},
    { "title": "Team & Trust", "items": [
      { "label": "Team Doxxed", "value": "<Yes/Partial/Anonymous/Unknown>", "trend": null },
      { "label": "Audit Status", "value": "<Audited by X/Unknown/Not audited>", "trend": null },
      { "label": "VC Backing", "value": "<known backers or Unknown>", "trend": null }
    ]},
    { "title": "Intelligence Verdict", "items": [
      { "label": "Bull Case", "value": "<strongest reason to be optimistic>", "trend": "up" },
      { "label": "Bear Case", "value": "<main risk or concern>", "trend": "down" },
      { "label": "Final Verdict", "value": "<one sentence conclusion>", "trend": null }
    ]}
  ]
}`;
    }

    const socialStr = d.socials.map((s) => `  • ${s.platform}: ${s.url}`).join("\n") || "  None detected";
    const keywordsStr = d.keywords.length > 0 ? d.keywords.join(", ") : "None";
    const tokensStr = d.tokenMentions.length > 0 ? d.tokenMentions.join(", ") : "None";

    return `You are AlphaScout AI, a blockchain project intelligence analyst.

LIVE WEB DATA (fetched from ${d.url} at ${d.fetchedAt})
══════════════════════════════════════════════════════════════
URL              : ${d.url}
Page Title       : ${d.title ?? "Could not extract"}
Meta Description : ${d.description ?? "Not found"}
Phishing Check   : ${d.isPhishingSite ? "🚨 FLAGGED AS PHISHING SITE" : "✓ Not flagged by GoPlus"}
Has Whitepaper   : ${d.hasWhitepaper ? "✓ Yes" : "Not detected on page"}
Has Audit Mention: ${d.hasAudit ? "✓ Yes — audit reference found on page" : "Not detected on page"}
Fetch Status     : ${d.fetchError ? `ERROR: ${d.fetchError}` : "Success"}

SOCIAL LINKS FOUND ON PAGE:
${socialStr}

TOKEN MENTIONS:
  ${tokensStr}

CRYPTO KEYWORDS DETECTED:
  ${keywordsStr}

PAGE CONTENT PREVIEW (first ~6000 chars of cleaned text):
───────────────────────────────────────────────────────────
${d.bodyPreview || "Could not extract page content"}
───────────────────────────────────────────────────────────
══════════════════════════════════════════════════════════════

Based on the LIVE FETCHED CONTENT above (not training data), return ONLY valid JSON (no markdown fences):
{
  "executiveSummary": "<2-3 sentences. What does this project actually do based on the page content? Is it legitimate? What are the most important signals from the fetched page?>",
  "riskScore": <0-100. Phishing=100; no whitepaper+no audit+no team=75+; missing social+vague content=60+; well-documented+audited+doxxed=10-30>,
  "keyFindings": [
    "<finding 1: what the project does — cite actual page content>",
    "<finding 2: team and transparency signals from page>",
    "<finding 3: security signals — audit mention, whitepaper, etc.>",
    "<finding 4: community presence — social links found on page>",
    "<finding 5: token/ecosystem information from page content>"
  ],
  "risks": ["<3-4 risks based on what was/wasn't found on the page>"],
  "opportunities": ["<2-3 positive signals found on the page>"],
  "recommendations": ["<3-4 specific due diligence steps based on what the page showed>"],
  "confidenceScore": <0-100. Full page content fetched=60-85; partial=40-60; fetch failed=10-30>,
  "metrics": [],
  "sections": [
    { "title": "Project Overview", "items": [
      { "label": "Category", "value": "<category inferred from page content>", "trend": null },
      { "label": "Primary Chain", "value": "<chain found on page or Unknown>", "trend": null },
      { "label": "Has Whitepaper", "value": "${d.hasWhitepaper ? "✓ Yes" : "Not found"}", "trend": null },
      { "label": "Audit Mentioned", "value": "${d.hasAudit ? "✓ Yes (verify independently)" : "Not mentioned"}", "trend": null }
    ]},
    { "title": "Token & Economics", "items": [
      { "label": "Token Mentions", "value": "${tokensStr || "None"}", "trend": null },
      { "label": "Token Utility", "value": "<inferred from page content>", "trend": null },
      { "label": "TVL / Scale", "value": "<any metrics mentioned on page or Unknown>", "trend": null }
    ]},
    { "title": "Community & Trust", "items": [
      { "label": "Social Links", "value": "${d.socials.length > 0 ? d.socials.map((s) => s.platform).join(", ") : "None detected"}", "trend": null },
      { "label": "Phishing Status", "value": "${d.isPhishingSite ? "⚠ FLAGGED" : "✓ Clean"}", "trend": null },
      { "label": "Team Transparency", "value": "<any team info on page or Anonymous>", "trend": null }
    ]},
    { "title": "Intelligence Verdict", "items": [
      { "label": "Bull Case", "value": "<strongest positive signal from the page>", "trend": "up" },
      { "label": "Bear Case", "value": "<biggest red flag or missing information>", "trend": "down" },
      { "label": "Final Verdict", "value": "<one-sentence conclusion based on fetched content>", "trend": null }
    ]}
  ]
}

CRITICAL RULES:
- Base your analysis on the FETCHED PAGE CONTENT, not training data
- If the fetch failed or content is sparse, say so and lower confidence
- Never invent team names, audit firms, or partnerships not mentioned on the page
- If the page is flagged as phishing, lead with that warning`;
  },

  userMessage(input: AnalyzerInput, scanData?: unknown): string {
    const d = scanData as ProjectScanData | undefined;
    if (d?.url) return `Analyze this blockchain project at ${d.url} using the live fetched page content in the system prompt. Base analysis on actual page content only.`;
    return `Analyze this blockchain project: "${input.target}". Use your training knowledge with appropriate uncertainty.`;
  },

  postProcess(output: AnalyzerOutput, _input: AnalyzerInput, scanData?: unknown): void {
    const d = scanData as ProjectScanData | undefined;
    const raw = output as unknown as Record<string, unknown>;
    if (typeof raw.executiveSummary === "string") output.summary = raw.executiveSummary;
    if (Array.isArray(raw.keyFindings)) output.insights = (raw.keyFindings as unknown[]).map(String);
    if (Array.isArray(raw.risks)) output.risks = (raw.risks as unknown[]).map(String);
    if (Array.isArray(raw.opportunities)) output.opportunities = (raw.opportunities as unknown[]).map(String);
    if (Array.isArray(raw.recommendations)) output.recommendations = (raw.recommendations as unknown[]).map(String);
    if (typeof raw.confidenceScore === "number") output.confidenceScore = Math.min(100, Math.max(0, Math.round(raw.confidenceScore)));
    if (d) output.projectScan = d;
  },
};

// ── Data fetcher (called before AI) ─────────────────────────────────────────

export async function fetchProjectScanData(input: AnalyzerInput): Promise<ProjectScanData | undefined> {
  if (!isUrl(input.target)) return undefined;
  try {
    const page = await fetchProjectData(input.target);
    return {
      dataSource: "web-fetch",
      fetchedAt: page.fetchedAt,
      url: page.url,
      title: page.title,
      description: page.description,
      bodyPreview: (page.bodyText || "").slice(0, 500),
      socials: page.socials,
      tokenMentions: page.tokenMentions,
      keywords: page.keywords,
      hasWhitepaper: page.hasWhitepaper,
      hasAudit: page.hasAudit,
      isPhishingSite: page.isPhishingSite,
      fetchError: page.fetchError,
    };
  } catch {
    return undefined;
  }
}
