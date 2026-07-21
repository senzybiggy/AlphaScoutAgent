export type DetectedType = "wallet" | "token" | "contract" | "project" | "unknown";

export interface DetectionResult {
  type: DetectedType;
  label: string;
  chain: string | null;
  confidence: "high" | "medium" | "low";
}

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const URL_RE = /^(https?:\/\/|www\.)/i;
const DOMAIN_RE = /^[a-zA-Z0-9-]+\.(io|com|org|xyz|ai|app|finance|exchange|network|protocol|fi)$/i;

// Known token contract prefixes / patterns (well-known contracts tend to be exactly 42 chars starting with 0x)
// We distinguish wallets from contracts by character distribution heuristics —
// contracts often have many repeated bytes (compiler padding), wallets are more random.
function looksLikeContract(address: string): boolean {
  const hex = address.slice(2).toLowerCase();
  // Count leading zeros — contract addresses created via CREATE often have more zeros
  const zeros = (hex.match(/0/g) || []).length;
  const zeroRatio = zeros / hex.length;
  // Also: if address contains long runs of repeated chars it's likely a contract
  const hasLongRun = /(.)\1{5,}/.test(hex);
  return hasLongRun || zeroRatio > 0.35;
}

export function detectInputType(raw: string): DetectionResult {
  const value = raw.trim();

  if (!value) {
    return { type: "unknown", label: "Unknown", chain: null, confidence: "low" };
  }

  // URL or domain → project
  if (URL_RE.test(value) || DOMAIN_RE.test(value)) {
    return { type: "project", label: "Project URL", chain: null, confidence: "high" };
  }

  // Ethereum address (0x + 40 hex)
  if (ETH_ADDRESS_RE.test(value)) {
    if (looksLikeContract(value)) {
      // Could be token contract or generic contract — default to token since
      // most ERC-20s get analyzed. User can still re-classify.
      return { type: "token", label: "EVM Token / Contract", chain: "ethereum", confidence: "medium" };
    }
    return { type: "wallet", label: "EVM Wallet", chain: "ethereum", confidence: "high" };
  }

  // Solana base58 address
  if (SOLANA_ADDRESS_RE.test(value) && !/[0OIl]/.test(value)) {
    // Longer addresses on Solana are more likely program (contract) addresses
    if (value.length === 44) {
      return { type: "contract", label: "Solana Program", chain: "solana", confidence: "medium" };
    }
    return { type: "wallet", label: "Solana Wallet", chain: "solana", confidence: "high" };
  }

  // Bitcoin — P2PKH (1...), P2SH (3...), bech32 (bc1...)
  if (/^(1[1-9A-HJ-NP-Za-km-z]{25,34}|3[1-9A-HJ-NP-Za-km-z]{25,34}|bc1[a-z0-9]{6,87})$/.test(value)) {
    return { type: "wallet", label: "Bitcoin Wallet", chain: "bitcoin", confidence: "high" };
  }

  // Short human-readable → treat as project name
  if (value.length <= 64 && /^[a-zA-Z]/.test(value) && !/^0x/.test(value)) {
    return { type: "project", label: "Project Name", chain: null, confidence: "medium" };
  }

  return { type: "wallet", label: "Address", chain: null, confidence: "low" };
}
