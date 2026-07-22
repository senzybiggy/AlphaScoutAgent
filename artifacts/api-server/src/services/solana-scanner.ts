/**
 * Solana wallet scanner — public RPC only, no API key required.
 * RPC: https://api.mainnet-beta.solana.com
 *
 * Provides: SOL balance, SPL token accounts, recent transactions
 */

import { cachedFetch } from "./cache.js";
import type { WalletScanData, WalletToken, WalletTx } from "../routes/analyze/types.js";

const RPC = process.env["SOLANA_RPC"] ?? "https://api.mainnet-beta.solana.com";
const TIMEOUT = 12_000;
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022    = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

async function solCall<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Solana RPC ${res.status}`);
  const data = await res.json() as { result?: T; error?: { message: string } };
  if (data.error) throw new Error(`Solana: ${data.error.message}`);
  return data.result!;
}

interface SolTokenAccount {
  pubkey: string;
  account: {
    data: {
      parsed: {
        info: {
          mint: string;
          owner: string;
          tokenAmount: { uiAmount: number | null; decimals: number; uiAmountString: string };
        };
      };
    };
    lamports: number;
  };
}

interface SolSignature {
  signature: string;
  blockTime: number | null;
  err: null | Record<string, unknown>;
  memo: string | null;
}

// Known Solana token metadata (top tokens for display)
const KNOWN_TOKENS: Record<string, { symbol: string; name: string }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC",  name: "USD Coin" },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB:  { symbol: "USDT",  name: "Tether USD" },
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs":{ symbol: "ETH",   name: "Wrapped Ethereum" },
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So:  { symbol: "mSOL",  name: "Marinade staked SOL" },
  So11111111111111111111111111111111111111112:    { symbol: "wSOL",  name: "Wrapped SOL" },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN:  { symbol: "JUP",   name: "Jupiter" },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: { symbol: "BONK",  name: "Bonk" },
  WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk:   { symbol: "WEN",   name: "Wen" },
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: { symbol: "WIF",   name: "dogwifhat" },
  orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE:  { symbol: "ORCA",  name: "Orca" },
};

export async function scanSolana(address: string): Promise<WalletScanData> {
  const cacheKey = `solana:wallet:${address}`;
  return cachedFetch(cacheKey, async () => {
    const [balResult, tokenResult, sigsResult] = await Promise.allSettled([
      solCall<{ value: number }>("getBalance", [address]),
      solCall<{ value: SolTokenAccount[] }>("getTokenAccountsByOwner", [
        address,
        { programId: TOKEN_PROGRAM },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ]),
      solCall<SolSignature[]>("getSignaturesForAddress", [
        address,
        { limit: 25, commitment: "confirmed" },
      ]),
    ]);

    // SOL balance
    const lamports = balResult.status === "fulfilled" ? balResult.value?.value ?? 0 : 0;
    const solBalance = (lamports / 1e9).toFixed(6);

    // SPL tokens
    const tokenAccounts: SolTokenAccount[] = tokenResult.status === "fulfilled"
      ? tokenResult.value?.value ?? []
      : [];
    const tokens: WalletToken[] = tokenAccounts
      .filter((ta) => {
        const amount = ta.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
        return amount != null && amount > 0;
      })
      .map((ta): WalletToken => {
        const info = ta.account.data.parsed.info;
        const known = KNOWN_TOKENS[info.mint];
        const amount = info.tokenAmount.uiAmount ?? 0;
        return {
          address: info.mint,
          symbol: known?.symbol ?? info.mint.slice(0, 6) + "...",
          name: known?.name ?? `SPL Token`,
          logo: null,
          balanceFormatted: amount.toFixed(Math.min(4, info.tokenAmount.decimals)),
          usdPrice: null,
          usdValue: null,
          portfolioPct: null,
          change24h: null,
        };
      })
      .slice(0, 20);

    // Transaction history
    const sigs: SolSignature[] = sigsResult.status === "fulfilled" ? sigsResult.value ?? [] : [];
    const recentTransactions: WalletTx[] = sigs.map((sig): WalletTx => ({
      hash: sig.signature,
      category: "transaction",
      summary: sig.memo ?? `Solana transaction`,
      fromAddress: address,
      toAddress: null,
      valueFormatted: "See explorer",
      valueUsd: null,
      gasFeeNative: "0.000005 SOL",
      gasFeeUsd: null,
      timestamp: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : new Date().toISOString(),
      status: sig.err ? "failed" : "success",
    }));

    const firstTxDate = sigs.length > 0 ? recentTransactions[recentTransactions.length - 1].timestamp : null;
    const lastTxDate  = sigs.length > 0 ? recentTransactions[0].timestamp : null;
    const walletAgeDays = firstTxDate
      ? Math.floor((Date.now() - new Date(firstTxDate).getTime()) / 86_400_000)
      : null;

    return {
      chain: "solana",
      dataSource: "solana-rpc",
      fetchedAt: new Date().toISOString(),
      nativeBalance: solBalance,
      nativeSymbol: "SOL",
      nativeBalanceUsd: null,
      totalNetWorthUsd: null,
      txCount: sigs.length,
      firstTxDate,
      lastTxDate,
      walletAgeDays,
      totalGasSpentNative: `${(sigs.filter((s) => !s.err).length * 0.000005).toFixed(6)} SOL`,
      chainsUsed: ["solana"],
      walletLabels: [],
      tokens,
      nfts: [],
      defiPositions: [],
      recentTransactions,
      topContracts: [],
      topCounterparties: [],
      addressRiskLabels: [],
      isSanctioned: false,
      isMixer: false,
      isScammer: false,
      smartMoneyScore: null,
      walletHealthScore: null,
      recommendations: [],
    } satisfies WalletScanData;
  }, 120_000);
}
