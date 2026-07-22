import type { Analyzer, AnalyzerInput, AnalyzerOutput, ContractScanData } from "./types.js";

function yn(v: boolean | null | undefined, warnTrue = false): string {
  if (v == null) return "Unknown";
  if (v) return warnTrue ? "⚠ YES" : "✓ Yes";
  return warnTrue ? "✓ No" : "No";
}
function risk(v: boolean | null | undefined): string {
  if (v == null) return "  ⬜ UNKNOWN";
  return v ? "  🔴 DETECTED" : "  🟢 NOT PRESENT";
}

export const contractAnalyzer: Analyzer = {
  systemPrompt(_input: AnalyzerInput, scanData?: unknown): string {
    const d = scanData as ContractScanData | undefined;
    if (!d) {
      return `You are AlphaScout AI, a smart contract security engine. State live data was unavailable.
Return ONLY valid JSON: { "executiveSummary": "...", "riskScore": 50, "keyFindings": ["..."], "risks": ["..."], "opportunities": ["..."], "recommendations": ["..."], "confidenceScore": 20, "metrics": [] }`;
    }

    const sec = d.security;
    const taxInfo = (sec.buyTax != null || sec.sellTax != null)
      ? `  Buy Tax         : ${sec.buyTax ?? "Unknown"}%\n  Sell Tax        : ${sec.sellTax ?? "Unknown"}%`
      : "  Taxes           : Unknown";
    const ownerInfo = sec.ownerAddress && sec.ownerAddress !== "0x0000000000000000000000000000000000000000"
      ? sec.ownerAddress
      : "Renounced or Zero Address";
    const holderInfo = sec.lpHolderCount
      ? `${sec.lpHolderCount} LP holders${sec.lpTopHolderPct ? `, top holder: ${parseFloat(sec.lpTopHolderPct).toFixed(2)}%` : ""}`
      : "Unknown";

    return `You are AlphaScout AI, a smart contract security engine specializing in rug-pull detection and risk assessment.

LIVE CONTRACT SECURITY DATA (source: GoPlus Security, fetched: ${new Date(d.fetchedAt).toUTCString()})
══════════════════════════════════════════════════════════════
CONTRACT OVERVIEW
  Chain            : ${d.chainId || "Unknown"}
  Overall Risk     : ${sec.overallRisk.toUpperCase()}
  Total Supply     : ${d.totalSupply ?? "Unknown"}
  Holder Count     : ${d.holderCount?.toLocaleString() ?? "Unknown"}
  Listed on DEX    : ${yn(sec.isInDex)}
  LP Info          : ${holderInfo}

VERIFICATION & TRANSPARENCY
  Source Verified  : ${sec.isOpenSource === null ? "Unknown" : sec.isOpenSource ? "✓ VERIFIED — source code public" : "⚠ NOT VERIFIED — bytecode only, code hidden"}
  Proxy Contract   : ${sec.isProxy === null ? "Unknown" : sec.isProxy ? "⚠ YES — logic can be upgraded" : "✓ No — static contract"}

OWNERSHIP & CONTROL
  Owner Address    : ${ownerInfo}
  Creator Address  : ${sec.creatorAddress ?? "Unknown"}
  Creator Holds    : ${sec.creatorHoldPct != null ? `${parseFloat(sec.creatorHoldPct).toFixed(2)}% of supply` : "Unknown"}
  Owner Holds      : ${sec.ownerHoldPct  != null ? `${parseFloat(sec.ownerHoldPct).toFixed(2)}% of supply`  : "Unknown"}

${taxInfo}

DANGEROUS FUNCTION CHECKLIST:
  Honeypot         :${risk(sec.isHoneypot)}${sec.isHoneypot ? " — USERS CANNOT SELL" : ""}
  Mintable Supply  :${risk(sec.isMintable)} — ${sec.isMintable ? "Owner can inflate supply" : "supply appears fixed"}
  Hidden Owner     :${risk(sec.hasHiddenOwner)} — ${sec.hasHiddenOwner ? "owner can be reclaimed" : "ownership transparent"}
  Blacklist Fn     :${risk(sec.hasBlacklist)} — ${sec.hasBlacklist ? "addresses can be blocked from trading" : "no blacklist detected"}
  Transfer Pause   :${risk(sec.transferPausable)} — ${sec.transferPausable ? "transfers can be frozen by owner" : "transfers cannot be paused"}
  Cannot Sell All  :${risk(sec.cannotSellAll)} — ${sec.cannotSellAll ? "holders may be trapped" : "full sells appear allowed"}
  Owner Takeback   :${risk(sec.ownerCanTakeBack)} — ${sec.ownerCanTakeBack ? "owner can reclaim ownership after renounce" : "ownership renounce appears final"}
  Self-Destruct    :${risk(sec.hasSelfDestruct)} — ${sec.hasSelfDestruct ? "contract can be destroyed" : "no self-destruct"}
  External Calls   :${risk(sec.hasExternalCalls)} — ${sec.hasExternalCalls ? "calls external contracts (reentrancy risk)" : "no external calls detected"}
  Anti-Whale       : ${yn(sec.isAntiWhale)} — ${sec.isAntiWhale ? "large buys limited (slippage/max tx)" : "no anti-whale restrictions"}
══════════════════════════════════════════════════════════════

Based ONLY on the real security scan above, return ONLY valid JSON (no markdown fences):
{
  "executiveSummary": "<2-3 sentences. Lead with the most critical finding (honeypot status, verification status, overall risk). State chain and what the data shows.>",
  "riskScore": <0-100. Honeypot=100; unverified+3+ dangerous fns=85+; hidden owner OR blacklist OR pausable=70+; mintable+proxy=50+; verified+no flags=5-25>,
  "keyFindings": [
    "<finding 1: verification status and implications>",
    "<finding 2: ownership — renounced vs active, percentages if known>",
    "<finding 3: most dangerous function detected or absence of dangerous functions>",
    "<finding 4: tax structure and trading restrictions>",
    "<finding 5: liquidity and tradability assessment>"
  ],
  "risks": ["<3-4 specific risks citing exact GoPlus findings above. Reference actual flags.>"],
  "opportunities": ["<1-2 positive signals if any: verified code, renounced ownership, no dangerous functions, etc. Only cite real findings.>"],
  "recommendations": [
    "<specific action: 'Do not buy — honeypot confirmed' OR 'Verify contract on Etherscan before trading'>",
    "<risk mitigation: position sizing given risk level>",
    "<due diligence: what additional checks to run>",
    "<monitoring: what to watch for>"
  ],
  "confidenceScore": <0-100. GoPlus scan complete=75+; partial data=40-74; no data=<40>,
  "metrics": []
}

Rules: Every risk must name the specific flag from the GoPlus scan. If a flag is Unknown, state that it could not be determined (treat as moderate risk). Never make up security findings.`;
  },

  userMessage(input: AnalyzerInput, scanData?: unknown): string {
    const d = scanData as ContractScanData | undefined;
    if (!d) return `Security audit contract: ${input.target}${input.chain ? ` on ${input.chain}` : ""}. State data unavailable.`;
    return `Produce the security report for ${input.target} using the GoPlus scan data in the system prompt. Reference specific flags found.`;
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
