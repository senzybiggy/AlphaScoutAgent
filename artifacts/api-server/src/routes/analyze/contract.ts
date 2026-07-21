import type { Analyzer, AnalyzerInput, AnalyzerOutput, ContractScanData } from "./types.js";

function yn(v: boolean | null | undefined, warnTrue = false): string {
  if (v == null) return "Unknown";
  if (v) return warnTrue ? "⚠ Yes" : "✓ Yes";
  return warnTrue ? "✓ No" : "No";
}

export const contractAnalyzer: Analyzer = {
  systemPrompt(_input: AnalyzerInput, scanData?: unknown): string {
    const d = scanData as ContractScanData | undefined;

    if (!d) {
      return `You are AlphaScout AI, a smart contract security engine.
Analyze the provided contract address and return ONLY valid JSON with: summary, riskScore (0-100), insights (5 strings), recommendations (3-4 strings), metrics (empty array).
Clearly state that live security data was unavailable and base your analysis on address patterns.`;
    }

    const sec = d.security;

    return `You are AlphaScout AI, a smart contract security engine.

REAL CONTRACT SECURITY DATA (sourced from GoPlus):
════════════════════════════════════════════════════
Chain          : ${d.chainId || "Unknown"}
Overall Risk   : ${sec.overallRisk.toUpperCase()}
Verification   : ${sec.isOpenSource === null ? "Unknown" : sec.isOpenSource ? "✓ Source code verified" : "⚠ NOT VERIFIED — source code hidden"}
Proxy Contract : ${yn(sec.isProxy)}
Honeypot       : ${sec.isHoneypot === null ? "Unknown" : sec.isHoneypot ? "🚨 HONEYPOT CONFIRMED" : "✓ Not a honeypot"}
Mintable       : ${yn(sec.isMintable, true)}
Hidden Owner   : ${yn(sec.hasHiddenOwner, true)}
Blacklist Fn   : ${yn(sec.hasBlacklist, true)}
Transfer Pause : ${yn(sec.transferPausable, true)}
Owner Takeback : ${yn(sec.ownerCanTakeBack, true)}
Cannot Sell    : ${yn(sec.cannotSellAll, true)}
Self-Destruct  : ${yn(sec.hasSelfDestruct, true)}
External Calls : Unknown
Buy Tax        : ${sec.buyTax ?? "Unknown"}%
Sell Tax       : ${sec.sellTax ?? "Unknown"}%
Owner Address  : ${sec.ownerAddress ?? "Unknown"}
Creator        : ${sec.creatorAddress ?? "Unknown"}
Total Supply   : ${d.totalSupply ?? "Unknown"}
Holder Count   : ${d.holderCount?.toLocaleString() ?? "Unknown"}
════════════════════════════════════════════════════

Based ONLY on the above real security data, return ONLY valid JSON (no markdown):
{
  "riskScore": <0-100 based on security findings>,
  "summary": "<2-3 sentences describing the contract's security posture based on real findings>",
  "insights": [
    "<critical: specific security issues found or absence of issues>",
    "<verification status and implications>",
    "<ownership and control risks>",
    "<dangerous functions identified>",
    "<overall assessment>"
  ],
  "recommendations": ["<3-4 specific actions for users based on actual findings>"],
  "metrics": []
}

Risk scoring: honeypot/unverified+dangerous = critical (76-100); hidden owner/pausable/blacklist = high (51-75); mintable/proxy = medium (26-50); verified+clean = low (0-25).
NEVER invent security findings. If data is "Unknown", state clearly it could not be determined.`;
  },

  userMessage(input: AnalyzerInput, scanData?: unknown): string {
    const d = scanData as ContractScanData | undefined;
    if (!d) {
      return `Analyze this smart contract: ${input.target}${input.chain ? ` on ${input.chain}` : ""}
Note: Live security data unavailable. State this limitation clearly.`;
    }
    return `Produce the security intelligence report for contract ${input.target} using the real GoPlus data in the system prompt.`;
  },

  postProcess(output: AnalyzerOutput, _input: AnalyzerInput, scanData?: unknown): void {
    const d = scanData as ContractScanData | undefined;
    if (!d) return;

    const raw = output as unknown as Record<string, unknown>;
    if (Array.isArray(raw.recommendations)) {
      output.recommendations = (raw.recommendations as unknown[]).map(String);
      d.recommendations = output.recommendations;
    }
    output.contractScan = d;
  },
};
