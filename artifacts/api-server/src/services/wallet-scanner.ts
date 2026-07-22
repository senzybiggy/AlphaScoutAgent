/**
 * Wallet Scanner — orchestrates real on-chain data.
 *
 * Priority chain:
 *   1. Moralis (richest EVM data, requires MORALIS_API_KEY)
 *   2. Ankr Advanced API free tier (tokens, NFTs, txs — no key required)
 *   3. Public RPC (native balance + tx count — always works)
 *   4. GoPlus (security — always free)
 *   5. Solana public RPC (for Solana addresses)
 *   6. Blockstream (for Bitcoin)
 */

import * as moralis from "./moralis.js";
import * as goplus from "./goplus.js";
import * as blockstream from "./blockstream.js";
import * as ankr from "./ankr.js";
import * as rpc from "./rpc-provider.js";
import { scanSolana } from "./solana-scanner.js";
import type { WalletScanData, WalletToken, WalletNFT, WalletTx, DeFiPosition } from "../routes/analyze/types.js";

export type { WalletScanData };

const EVM_NATIVE_SYMBOLS: Record<string, string> = {
  eth: "ETH", ethereum: "ETH",
  polygon: "POL", matic: "POL",
  bsc: "BNB",
  arbitrum: "ETH", optimism: "ETH", base: "ETH",
  avalanche: "AVAX",
};

// ── Address type detection ────────────────────────────────────────────────────

export function detectAddressType(address: string): "evm" | "solana" | "bitcoin" | "unknown" {
  const clean = address.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(clean)) return "evm";
  if (/^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(clean)) return "bitcoin";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean) && !clean.startsWith("0x")) return "solana";
  return "unknown";
}

// ── Derived stats ─────────────────────────────────────────────────────────────

function derivedStats(txs: moralis.MoralisTx[], address: string) {
  const addr = address.toLowerCase();
  const contractCounts = new Map<string, number>();
  const counterpartyCounts = new Map<string, { count: number; in: number; out: number }>();

  for (const tx of txs) {
    if (tx.toAddress && tx.category !== "receive" && tx.toAddress.toLowerCase() !== addr) {
      const to = tx.toAddress.toLowerCase();
      contractCounts.set(to, (contractCounts.get(to) ?? 0) + 1);
    }
    if (tx.category === "send" || tx.category === "receive") {
      const other = tx.category === "send" ? tx.toAddress?.toLowerCase() : tx.fromAddress?.toLowerCase();
      if (other && other !== addr) {
        const existing = counterpartyCounts.get(other) ?? { count: 0, in: 0, out: 0 };
        existing.count++;
        if (tx.category === "receive") existing.in++; else existing.out++;
        counterpartyCounts.set(other, existing);
      }
    }
  }

  return {
    topContracts: [...contractCounts.entries()]
      .sort(([, a], [, b]) => b - a).slice(0, 10)
      .map(([address, txCount]) => ({ address, label: null, txCount })),
    topCounterparties: [...counterpartyCounts.entries()]
      .sort(([, a], [, b]) => b.count - a.count).slice(0, 10)
      .map(([address, stats]) => ({
        address, label: null, txCount: stats.count,
        direction: (stats.in > 0 && stats.out > 0 ? "both" : stats.in > 0 ? "in" : "out") as "in" | "out" | "both",
      })),
  };
}

// ── Bitcoin ───────────────────────────────────────────────────────────────────

async function scanBitcoin(address: string): Promise<WalletScanData> {
  const [addrInfo, txs] = await Promise.allSettled([
    blockstream.getBitcoinAddress(address),
    blockstream.getBitcoinTxs(address),
  ]);
  const info = addrInfo.status === "fulfilled" ? addrInfo.value : null;
  const rawTxs = txs.status === "fulfilled" ? txs.value : [];
  const firstTx = rawTxs.find((t) => t.confirmed && t.timestamp)?.timestamp ?? null;
  const lastTx = rawTxs[0]?.timestamp ?? null;

  return {
    chain: "bitcoin", dataSource: "blockstream", fetchedAt: new Date().toISOString(),
    nativeBalance: info ? info.confirmedBalanceBTC : "0",
    nativeSymbol: "BTC", nativeBalanceUsd: null, totalNetWorthUsd: null,
    txCount: info?.txCount ?? 0,
    firstTxDate: firstTx, lastTxDate: lastTx,
    walletAgeDays: firstTx ? Math.floor((Date.now() - new Date(firstTx).getTime()) / 86_400_000) : null,
    totalGasSpentNative: null, chainsUsed: ["bitcoin"], walletLabels: [],
    tokens: [], nfts: [], defiPositions: [],
    recentTransactions: rawTxs.map((t) => {
      const sentToOther = t.outputs.filter((o) => o.address !== address);
      const valueSats = sentToOther.reduce((s, o) => s + o.value, 0);
      return {
        hash: t.txid, category: "transfer",
        summary: `${(valueSats / 1e8).toFixed(8)} BTC transfer`,
        fromAddress: address, toAddress: sentToOther[0]?.address ?? null,
        valueFormatted: `${(valueSats / 1e8).toFixed(8)} BTC`, valueUsd: null,
        gasFeeNative: `${(t.fee / 1e8).toFixed(8)} BTC`, gasFeeUsd: null,
        timestamp: t.timestamp ?? new Date().toISOString(),
        status: t.confirmed ? "success" : "failed",
      };
    }),
    topContracts: [], topCounterparties: [],
    addressRiskLabels: [], isSanctioned: false, isMixer: false, isScammer: false,
    smartMoneyScore: null, walletHealthScore: null, recommendations: [],
  };
}

// ── EVM via Moralis (primary if key available) ────────────────────────────────

async function scanEVMWithMoralis(address: string, chain: string): Promise<WalletScanData> {
  const [tokensR, nftsR, historyR, netWorthR, defiR, statsR, addrSecR] = await Promise.allSettled([
    moralis.getWalletTokens(address, chain),
    moralis.getWalletNFTs(address, chain),
    moralis.getWalletHistory(address, chain),
    moralis.getWalletNetWorth(address),
    moralis.getDefiPositions(address, chain),
    moralis.getWalletStats(address, chain),
    goplus.checkAddressSecurity(address, chain),
  ]);

  const tokens: WalletToken[] = (tokensR.status === "fulfilled" ? tokensR.value ?? [] : [])
    .map((t) => ({ address: t.address, symbol: t.symbol, name: t.name, logo: t.logo,
      balanceFormatted: t.balanceFormatted, usdPrice: t.usdPrice, usdValue: t.usdValue,
      portfolioPct: t.portfolioPct, change24h: t.change24h }));

  const nfts: WalletNFT[] = (nftsR.status === "fulfilled" ? nftsR.value ?? [] : [])
    .map((n) => ({ tokenAddress: n.tokenAddress, tokenId: n.tokenId, name: n.name,
      collection: n.collection, image: n.image, floorPriceUsd: n.floorPriceUsd }));

  const rawHistory = historyR.status === "fulfilled" ? historyR.value ?? [] : [];
  const recentTransactions: WalletTx[] = rawHistory.map((t) => ({
    hash: t.hash, category: t.category, summary: t.summary,
    fromAddress: t.fromAddress, toAddress: t.toAddress,
    valueFormatted: t.valueFormatted, valueUsd: t.valueUsd,
    gasFeeNative: t.gasFeeNative, gasFeeUsd: t.gasFeeUsd,
    timestamp: t.timestamp, status: t.status,
  }));

  const defiPositions: DeFiPosition[] = (defiR.status === "fulfilled" ? defiR.value ?? [] : [])
    .map((p) => ({ protocol: p.protocol, type: p.type, valueUsd: p.valueUsd,
      tokens: p.tokens, apy: null, status: p.status }));

  const netWorth = netWorthR.status === "fulfilled" ? netWorthR.value : null;
  const stats    = statsR.status === "fulfilled" ? statsR.value : null;
  const addrSec  = addrSecR.status === "fulfilled" ? addrSecR.value : null;
  const { topContracts, topCounterparties } = derivedStats(rawHistory, address);
  const nativeSymbol = EVM_NATIVE_SYMBOLS[moralis.toMoralisChain(chain)] ?? "ETH";
  const primaryChain = netWorth?.chains.find((c) => c.chain === moralis.toMoralisChain(chain));

  const stablecoinUsd = tokens
    .filter((t) => ["USDT","USDC","DAI","BUSD","TUSD","FRAX","LUSD","USDE"].includes(t.symbol.toUpperCase()))
    .reduce((s, t) => s + (t.usdValue ?? 0), 0);

  const sortedTxs = [...rawHistory].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const firstTxDate = sortedTxs[0]?.timestamp ?? null;
  const lastTxDate  = rawHistory[0]?.timestamp ?? null;

  const totalGasNative = rawHistory.filter((t) => t.gasFeeNative)
    .reduce((s, t) => s + parseFloat(t.gasFeeNative!), 0);

  return {
    chain: moralis.toMoralisChain(chain), dataSource: "moralis",
    fetchedAt: new Date().toISOString(),
    nativeBalance: primaryChain?.nativeBalance ?? "0", nativeSymbol,
    nativeBalanceUsd: primaryChain?.nativeUsd ?? null,
    totalNetWorthUsd: netWorth?.totalUsd ?? null,
    txCount: stats?.txCount ?? rawHistory.length,
    firstTxDate, lastTxDate,
    walletAgeDays: firstTxDate ? Math.floor((Date.now() - new Date(firstTxDate).getTime()) / 86_400_000) : null,
    totalGasSpentNative: totalGasNative > 0 ? `${totalGasNative.toFixed(5)} ${nativeSymbol}` : null,
    chainsUsed: netWorth?.chains.map((c) => c.chain).filter(Boolean) ?? [moralis.toMoralisChain(chain)],
    walletLabels: [], stablecoinUsd,
    tokens, nfts, defiPositions, recentTransactions,
    topContracts, topCounterparties,
    addressRiskLabels: addrSec?.labels ?? [],
    isSanctioned: addrSec?.isSanctioned ?? false,
    isMixer: addrSec?.isMixer ?? false,
    isScammer: addrSec?.isScammer ?? false,
    smartMoneyScore: null, walletHealthScore: null, recommendations: [],
  };
}

// ── EVM via Ankr + Public RPC (free fallback) ────────────────────────────────

async function scanEVMFree(address: string, chain: string): Promise<WalletScanData> {
  const resolvedChain = rpc.resolveChain(chain);
  const nativeSymbol  = EVM_NATIVE_SYMBOLS[resolvedChain] ?? "ETH";

  const ANKR_CHAINS = ["eth", "bsc", "polygon", "arbitrum", "optimism", "base"];

  const [nativeBal, txCount, isContractR, addrSecR, ankrTokensR, ankrNftsR, ankrTxsR, multiChainR] =
    await Promise.allSettled([
      rpc.getNativeBalance(address, resolvedChain),
      rpc.getTxCount(address, resolvedChain),
      rpc.isContract(address, resolvedChain),
      goplus.checkAddressSecurity(address, resolvedChain),
      ankr.getAccountBalance(address, ANKR_CHAINS),
      ankr.getAccountNFTs(address, ["eth", "bsc", "polygon"]),
      ankr.getAccountTransactions(address, resolvedChain, 20),
      rpc.getMultiChainNativeBalances(address),
    ]);

  const native = nativeBal.status === "fulfilled" ? nativeBal.value : null;
  const txCnt  = txCount.status === "fulfilled" ? txCount.value : null;
  const isCtrt = isContractR.status === "fulfilled" ? isContractR.value : null;
  const addrSec = addrSecR.status === "fulfilled" ? addrSecR.value : null;
  const ankrTokens = ankrTokensR.status === "fulfilled" ? ankrTokensR.value : [];
  const ankrNfts   = ankrNftsR.status === "fulfilled" ? ankrNftsR.value : [];
  const ankrTxs    = ankrTxsR.status === "fulfilled" ? ankrTxsR.value : [];
  const multiChain = multiChainR.status === "fulfilled" ? multiChainR.value : [];

  const { totalUsd, stablecoinUsd } = ankr.computePortfolioStats(ankrTokens);

  // Derive wallet age from oldest transaction
  const sortedTxs = [...ankrTxs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const firstTxDate = sortedTxs[0]?.timestamp ?? null;
  const lastTxDate  = ankrTxs[0]?.timestamp ?? null;
  const walletAgeDays = firstTxDate
    ? Math.floor((Date.now() - new Date(firstTxDate).getTime()) / 86_400_000)
    : null;

  // Gas estimation
  const gasSuccessTxs = ankrTxs.filter((t) => t.status === "success");
  const totalGasNative = gasSuccessTxs.reduce((s, t) => {
    if (!t.gasFeeNative) return s;
    const parts = t.gasFeeNative.split(" ");
    return s + parseFloat(parts[0] || "0");
  }, 0);

  // Determine data source
  const dataSource: WalletScanData["dataSource"] = ankrTokens.length > 0 ? "ankr" : "rpc";

  // Chains used: native non-zero balances
  const chainsUsed = multiChain.length > 0
    ? multiChain.map((c) => c.chain)
    : [resolvedChain];

  return {
    chain: resolvedChain,
    dataSource,
    fetchedAt: new Date().toISOString(),
    nativeBalance: native?.formatted ?? "0",
    nativeSymbol,
    nativeBalanceUsd: null,
    totalNetWorthUsd: totalUsd > 0 ? totalUsd : null,
    txCount: txCnt ?? ankrTxs.length,
    firstTxDate, lastTxDate, walletAgeDays,
    totalGasSpentNative: totalGasNative > 0 ? `${totalGasNative.toFixed(6)} ${nativeSymbol}` : null,
    chainsUsed,
    walletLabels: [],
    stablecoinUsd: stablecoinUsd > 0 ? stablecoinUsd : undefined,
    isContract: isCtrt ?? undefined,
    multiChainBalances: multiChain.length > 0 ? multiChain : undefined,
    tokens: ankrTokens,
    nfts: ankrNfts,
    defiPositions: [],
    recentTransactions: ankrTxs,
    topContracts: [],
    topCounterparties: [],
    addressRiskLabels: addrSec?.labels ?? [],
    isSanctioned: addrSec?.isSanctioned ?? false,
    isMixer: addrSec?.isMixer ?? false,
    isScammer: addrSec?.isScammer ?? false,
    smartMoneyScore: null, walletHealthScore: null, recommendations: [],
  };
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function scanWallet(address: string, chain: string | null): Promise<WalletScanData> {
  const addrType = detectAddressType(address);

  if (addrType === "bitcoin" || chain === "bitcoin") return scanBitcoin(address);
  if (addrType === "solana" || chain === "solana") return scanSolana(address);

  // EVM — prefer Moralis if key is set
  const resolvedChain = chain ?? "ethereum";
  if (process.env.MORALIS_API_KEY) {
    try {
      return await scanEVMWithMoralis(address, resolvedChain);
    } catch {
      // fall through to free tier
    }
  }
  return scanEVMFree(address, resolvedChain);
}
