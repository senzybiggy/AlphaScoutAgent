/**
 * Project URL fetcher — fetches live web content for project analysis.
 *
 * Extracts: page title, description, body text, social links, team mentions.
 * Used to give the AI real page content instead of relying on training data.
 */

import { cachedFetch } from "./cache.js";

const TIMEOUT = 10_000;
const MAX_BODY = 6_000; // chars of body text to pass to AI

export interface ProjectPageData {
  url: string;
  fetchedAt: string;
  title: string | null;
  description: string | null;
  bodyText: string;
  socials: { platform: string; url: string }[];
  tokenMentions: string[];
  keywords: string[];
  hasWhitepaper: boolean;
  hasAudit: boolean;
  isPhishingSite: boolean;
  fetchError: string | null;
}

const SOCIAL_PATTERNS: { platform: string; regex: RegExp }[] = [
  { platform: "twitter",  regex: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+/gi },
  { platform: "discord",  regex: /https?:\/\/(?:www\.)?discord\.(?:gg|com\/invite)\/[A-Za-z0-9_-]+/gi },
  { platform: "telegram", regex: /https?:\/\/(?:www\.)?t\.me\/[A-Za-z0-9_]+/gi },
  { platform: "github",   regex: /https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?/gi },
  { platform: "medium",   regex: /https?:\/\/(?:www\.)?medium\.com\/@?[A-Za-z0-9_-]+/gi },
  { platform: "youtube",  regex: /https?:\/\/(?:www\.)?youtube\.com\/@?[A-Za-z0-9_-]+/gi },
];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string, name: string): string | null {
  const ogRe  = new RegExp(`<meta[^>]+property=["']og:${name}["'][^>]+content=["']([^"']+)["']`, "i");
  const nameRe = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
  const match = html.match(ogRe) ?? html.match(nameRe);
  return match ? match[1] : null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractSocials(html: string): { platform: string; url: string }[] {
  const found = new Map<string, string>();
  for (const { platform, regex } of SOCIAL_PATTERNS) {
    const matches = html.match(regex) ?? [];
    if (matches.length > 0 && !found.has(platform)) {
      found.set(platform, matches[0]!);
    }
  }
  return Array.from(found.entries()).map(([platform, url]) => ({ platform, url }));
}

function extractTokenMentions(text: string): string[] {
  // Look for ticker symbols like $ETH, $USDC, or contract patterns
  const tickers = text.match(/\$[A-Z]{2,8}/g) ?? [];
  return [...new Set(tickers)].slice(0, 10);
}

function extractKeywords(text: string): string[] {
  const CRYPTO_KEYWORDS = [
    "defi", "nft", "dao", "layer 2", "l2", "zk", "rollup", "bridge", "staking",
    "yield", "liquidity", "amm", "dex", "cex", "perpetual", "futures", "options",
    "lending", "borrowing", "governance", "token", "airdrop", "launchpad",
    "gamefi", "play-to-earn", "metaverse", "rwa", "real world assets",
    "ai", "agent", "oracle", "cross-chain", "interoperability",
  ];
  const lower = text.toLowerCase();
  return CRYPTO_KEYWORDS.filter((kw) => lower.includes(kw));
}

async function checkPhishing(url: string): Promise<boolean> {
  try {
    const domain = new URL(url).hostname;
    const res = await fetch(`https://api.gopluslabs.io/api/v1/phishing_site?url=${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return false;
    const data = await res.json() as Record<string, unknown>;
    const result = (data.result as Record<string, unknown>) ?? {};
    return result.phishing_site === "1" || result.phishing === "1";
  } catch {
    return false;
  }
}

export async function fetchProjectData(url: string): Promise<ProjectPageData> {
  const cacheKey = `project:${url}`;
  return cachedFetch(cacheKey, async () => {
    const fetched: ProjectPageData = {
      url,
      fetchedAt: new Date().toISOString(),
      title: null,
      description: null,
      bodyText: "",
      socials: [],
      tokenMentions: [],
      keywords: [],
      hasWhitepaper: false,
      hasAudit: false,
      isPhishingSite: false,
      fetchError: null,
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AlphaScout/1.0; +https://alphascout.ai)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      clearTimeout(timer);

      if (!response.ok) {
        fetched.fetchError = `HTTP ${response.status}`;
        return fetched;
      }

      const html = await response.text();

      fetched.title       = extractMeta(html, "title")  ?? extractTitle(html);
      fetched.description = extractMeta(html, "description");
      fetched.socials     = extractSocials(html);

      const rawText = stripHtml(html);
      fetched.bodyText     = rawText.slice(0, MAX_BODY);
      fetched.tokenMentions = extractTokenMentions(rawText);
      fetched.keywords      = extractKeywords(rawText);
      fetched.hasWhitepaper = /whitepaper|lite.?paper|documentation|docs/i.test(html);
      fetched.hasAudit      = /audit|audited|certik|chainsecurity|trail of bits|peckshield|hacken/i.test(html);

    } catch (err) {
      fetched.fetchError = err instanceof Error ? err.message : "Unknown fetch error";
    }

    // Check phishing (non-blocking, best effort)
    try {
      fetched.isPhishingSite = await checkPhishing(url);
    } catch {
      // ignore
    }

    return fetched;
  }, 300_000); // cache for 5 minutes
}

export function isUrl(target: string): boolean {
  try {
    const u = new URL(target);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
