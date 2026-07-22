import type { Analyzer, AnalyzerInput, AnalyzerOutput, AnalyzerMeta, ContractScanData } from "./types.js";

function yn(v: boolean | null | undefined, warnTrue = false): string {
  if (v == null) return "Data unavailable from providers.";
  if (v) return warnTrue ? "⚠ YES" : "✓ Yes";
  return warnTrue ? "✓ No" : "No";
}
function risk(v: boolean | null | undefined): string {
  if (v == null) return "  ⬜ DATA UNAVAILABLE FROM PROVIDERS";
  return v ? "  🔴 DETECTED" : "  🟢 NOT PRESENT";
}

export const contractAnalyzer: Analyzer = {
  systemPrompt(_input: AnalyzerInput, scanData?: unknown, meta?: AnalyzerMeta): string {
    const d = scanData as ContractScanData | undefined;
    const maxConfidence = meta?.dataQualityScore ?? 20;

    if (!d) {
      return `You are AlphaScout AI, a smart contract security engine.
IMPORTANT: Live contract data was unavailable from all providers. Do NOT invent or estimate any values.
Return ONLY valid JSON:
{ "executiveSummary": "Live contract security data was unavailable from all providers. No audit can be performed without verified on-chain data.", "riskScore": 50, "keyFindings": ["Data unavailable from providers — no security analysis generated"], "risks": ["Cannot assess contract risk without verified security data"], "opportunities": [], "recommendations": ["Retry the scan — providers may be temporarily unavailable"], "confidenceScore": ${maxConfidence}, "metrics": [] }`;
    }

    const sec = d.security;
    const taxInfo = (sec.buyTax != null || sec.sellTax != null)
      ? `  Buy Tax         : ${sec.buyTax ?? "Data unavailable from providers."}%\n  Sell Tax        : ${sec.sellTax ?? "Data unavailable from providers."}%`
      : "  Taxes           : Data unavailable from providers.";
    const ownerInfo = sec.ownerAddress && sec.ownerAddress !== "0x0000000000000000000000000000000000000000"
      ? sec.ownerAddress
      : sec.ownerAddress === "0x0000000000000000000000000000000000000000"
        ? "Renounced (zero address)"
        : "Data unavailable from providers.";
    const holderInfo = sec.lpHolderCount
      ? `${sec.lpHolderCount} LP holders${sec.lpTopHolderPct ? `, top holder: ${parseFloat(sec.lpTopHolderPct).toFixed(2)}%` : ""}`
      : "Data unavailable from providers.";

    return `You are AlphaScout AI, a smart contract security engine specializing in rug-pull detection and risk assessment.

VERIFIED CONTRACT SECURITY DATA (source: GoPlus Security, fetched: ${new Date(d.fetchedAt).toUTCString()})
Data quality: ${meta?.dataQualityScore ?? "unknown"}% | Reliability: ${meta?.reliabilityScore ?? "unknown"}%
══════════════════════════════════════════════════════════════
CONTRACT OVERVIEW
  Chain            : ${d.chainId || "Data unavailable from providers."}
  Overall Risk     : ${sec.overallRisk.toUpperCase()}
  Total Supply     : ${d.totalSupply ?? "Data unavailable from providers."}
  Holder Count     : ${d.holderCount != null ? d.holderCount.toLocaleString() : "Data unavailable from providers."}
  Listed on DEX    : ${yn(sec.isInDex)}
  LP Info          : ${holderInfo}

VERIFICATION & TRANSPARENCY
  Source Verified  : ${sec.isOpenSource === null ? "Data unavailable from providers." : sec.isOpenSource ? "✓ VERIFIED — source code public" : "⚠ NOT VERIFIED — bytecode only, code hidden"}
  Proxy Contract   : ${sec.isProxy === null ? "Data unavailable from providers." : sec.isProxy ? "⚠ YES — logic can be upgraded" : "✓ No — static contract"}

OWNERSHIP & CONTROL
  Owner Address    : ${ownerInfo}
  Creator Address  : ${sec.creatorAddress ?? "Data unavailable from providers."}
  Creator Holds    : ${sec.creatorHoldPct != null ? `${parseFloat(sec.creatorHoldPct).toFixed(2)}% of supply` : "Data unavailable from providers."}
  Owner Holds      : ${sec.ownerHoldPct != null ? `${parseFloat(sec.ownerHoldPct).toFixed(2)}% of supply` : "Data unavailable from providers."}

${taxInfo}

DANGEROUS FUNCTION CHECKLIST:
  Honeypot         :${risk(sec.isHoneypot)}${sec.isHoneypot ? " — USERS CANNOT SELL" : ""}
  Mintable Supply  :${risk(sec.isMintable)} — ${sec.isMintable === null ? "" : sec.isMintable ? "Owner can inflate supply" : "supply appears fixed"}
  Hidden Owner     :${risk(sec.hasHiddenOwner)} — ${sec.hasHiddenOwner === null ? "" : sec.hasHiddenOwner ? "owner can be reclaimed" : "ownership transparent"}
  Blacklist Fn     :${risk(sec.hasBlacklist)} — ${sec.hasBlacklist === null ? "" : sec.hasBlacklist ? "addresses can be blocked from trading" : "no blacklist detected"}
  Transfer Pause   :${risk(sec.transferPausable)} — ${sec.transferPausable === null ? "" : sec.transferPausable ? "transfers can be frozen by owner" : "transfers cannot be paused"}
  Cannot Sell All  :${risk(sec.cannotSellAll)} — ${sec.cannotSellAll === null ? "" : sec.cannotSellAll ? "holders may be trapped" : "full sells appear allowed"}
  Owner Takeback   :${risk(sec.ownerCanTakeBack)} — ${sec.ownerCanTakeBack === null ? "" : sec.ownerCanTakeBack ? "owner can reclaim ownership after renounce" : "ownership renounce appears final"}
  Self-Destruct    :${risk(sec.hasSelfDestruct)} — ${sec.hasSelfDestruct === null ? "" : sec.hasSelfDestruct ? "contract can be destroyed" : "no self-destruct"}
  External Calls   :${risk(sec.hasExternalCalls)} — ${sec.hasExternalCalls === null ? "" : sec.hasExternalCalls ? "calls external contracts (reentrancy risk)" : "no external calls detected"}
  Anti-Whale       : ${yn(sec.isAntiWhale)} — ${sec.isAntiWhale === null ? "" : sec.isAntiWhale ? "large buys limited" : "no anti-whale restrictions"}
══════════════════════════════════════════════════════════════

CRITICAL INSTRUCTIONS:
1. NEVER invent security flags. If a flag says "DATA UNAVAILABLE FROM PROVIDERS", treat it as unknown risk (not safe).
2. "DATA UNAVAILABLE FROM PROVIDERS" for honeypot means you CANNOT confirm it is safe — state that clearly.
3. Your confidenceScore MUST NOT exceed ${maxConfidence} (data quality cap).
4. Honeypot detected = riskScore must be 95-100, no exceptions.

Based ONLY on the verified GoPlus scan above, return ONLY valid JSON (no markdown fences):
{
  "executiveSummary": "<2-3 sentences. Lead with the most critical finding. For any unavailable field, state explicitly that it could not be verified.>",
  "riskScore": <0-100. Honeypot=100; unverified+3+ dangerous fns=85+; hidden owner OR blacklist OR pausable=70+; mintable+proxy=50+; verified+no flags=5-25. If data unavailable for key flags, add 20 uncertainty premium.>,
  "keyFindings": [
    "<finding 1: verification status and implications>",
    "<finding 2: ownership — renounced vs active, percentages if known>",
    "<finding 3: most dangerous function detected, or explicitly state 'GoPlus could not determine [flag]' for unknown flags>",
    "<finding 4: tax structure — only from verified data>",
    "<finding 5: liquidity and tradability>"
  ],
  "risks": ["<3-4 risks. For unavailable flags, state 'X could not be verified from providers — treat as unknown risk'.>"],
  "opportunities": ["<1-2 positive signals if any: verified code, renounced ownership, clean GoPlus scan. Only cite real findings.>"],
  "recommendations": [
    "<specific action based on verified data>",
    "<risk mitigation>",
    "<what additional verification to run for unconfirmed flags>",
    "<monitoring recommendation>"
  ],
  "confidenceScore": <0-${maxConfidence}. MUST NOT exceed ${maxConfidence}.>,
  "metrics": []
}`;
  },

  userMessage(input: AnalyzerInput, scanData?: unknown, meta?: AnalyzerMeta): string {
    const d = scanData as ContractScanData | undefined;
    const maxConf = meta?.dataQualityScore ?? 20;
    if (!d) return `Security audit contract: ${input.target}. Data unavailable from all providers. Keep confidenceScore at ${maxConf}.`;
    return `Produce the security report for ${input.target} using ONLY the verified GoPlus data in the system prompt. For flags marked "DATA UNAVAILABLE FROM PROVIDERS", explicitly state they could not be verified. Your confidenceScore must not exceed ${maxConf}.`;
  },

  postProcess(output: AnalyzerOutput, _input: AnalyzerInput, scanData?: unknown): void {
    const d = scanData as ContractScanData | undefined;
    const raw = output as unknown as Record<string, unknown>;
    if (typeof raw.executiveSummary === "string") output.summary = raw.executiveSummary;
    if (Array.isArray(raw.keyFindings)) output.insights = (raw.keyFindings as unknown[]).map(String);
    if (Array.isArray(raw.risks)) output.risks = (raw.risks as unknown[]).map(String);
    if (Array.isArray(raw.opportunities)) output.opportunities = (raw.opportunities as unknown[]).map(String);
    if (Array.isArray(raw.recommendations)) output.recommendations = (raw.recommendations as unknown[]).map(String);
    if (typeof raw.confidenceScore === "number") output.confidenceScore = Math.min(100, Math.max(0, Math.round(raw.confidenceScore)));
    if (d) { d.recommendations = output.recommendations ?? []; output.contractScan = d; }
  },
};
