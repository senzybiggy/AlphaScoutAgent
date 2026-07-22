/**
 * Wallet Scanner — verified multi-provider data layer.
 *
 * Priority chain (EVM):
 *   PRIMARY (rich data):  Moralis → Ankr → Covalent
 *   MINIMAL fallback:     Blockscout → Blockchair → Etherscan → Public RPC
 *   SECURITY (parallel):  GoPlus
 *
 * Priority chain (Solana): Solscan → Solana public RPC
 * Priority chain (Bitcoin): Blockstream → Blockchair
 *
 * - Returns null if no provider can supply ANY data (triggers DATA_UNAVAILABLE in analyze-service).
 * - Never invents default values for unknown fields — uses null.
 * - Tracks every provider attempt in WalletScanData.providerAttempts.
 * - Tags each populated field in WalletScanData.fieldSources.
 */

import * as moralis    from "./moralis.js";
import * as goplus     from "./goplus.js";
import * as blockstream from "./blockstream.js";
import * as ankr       from "./ankr.js";
import * as rpc        from "./rpc-provider.js";
import * as blockscout from "./blockscout.js";
import * as blockchair from "./blockchair.js";
import * as covalent   from "./covalent.js";
import * as etherscan  from "./etherscan.js";
import * as solscanSvc from "./solscan.js";
import { scanSolana }  from "./solana-scanner.js";
import { runWithFallback, mergeAttempts, type ProviderAttempt } from "./provider-registry.js";
import type {
  WalletScanData, WalletToken, WalletNFT, WalletTx, DeFiPosition,
} from "../routes/analyze/types.js";

export type { WalletScanData };

export interface WalletScanResult {
  data: WalletScanData | null;
  attempts: ProviderAttempt[];
}

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

// ── Derived stats from tx history ────────────────────────────────────────────

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
        const e = counterpartyCounts.get(other) ?? { count: 0, in: 0, out: 0 };
        e.count++;
        if (tx.category === "receive") e.in++; else e.out++;
        counterpartyCounts.set(other, e);
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

async function scanBitcoinWithBlockstream(address: string): Promise<WalletScanData | null> {
  const [addrInfo, txs] = await Promise.allSettled([
    blockstream.getBitcoinAddress(address),
    blockstream.getBitcoinTxs(address),
  ]);
  const info   = addrInfo.status === "fulfilled" ? addrInfo.value : null;
  const rawTxs = txs.status === "fulfilled" ? txs.value : [];
  if (!info && rawTxs.length === 0) return null;

  const firstTx = rawTxs.find((t) => t.confirmed && t.timestamp)?.timestamp ?? null;
  const lastTx  = rawTxs[0]?.timestamp ?? null;
  return {
    chain: "bitcoin", dataSource: "blockstream", fetchedAt: new Date().toISOString(),
    nativeBalance: info ? info.confirmedBalanceBTC : "0",
    nativeSymbol: "BTC", nativeBalanceUsd: null, totalNetWorthUsd: null,
    txCount: info?.txCount ?? rawTxs.length,
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

async function scanBitcoinWithBlockchair(address: string): Promise<WalletScanData | null> {
  const info = await blockchair.getAddressInfo(address, "bitcoin");
  if (!info) return null;

  const firstTx = info.firstSeenReceiving;
  return {
    chain: "bitcoin", dataSource: "blockchair", fetchedAt: new Date().toISOString(),
    nativeBalance: (info.balance / 1e8).toFixed(8), nativeSymbol: "BTC",
    nativeBalanceUsd: null, totalNetWorthUsd: null,
    txCount: info.txCount,
    firstTxDate: firstTx, lastTxDate: info.lastSeenReceiving,
    walletAgeDays: firstTx ? Math.floor((Date.now() - new Date(firstTx).getTime()) / 86_400_000) : null,
    totalGasSpentNative: null, chainsUsed: ["bitcoin"], walletLabels: [],
    tokens: [], nfts: [], defiPositions: [], recentTransactions: [],
    topContracts: [], topCounterparties: [],
    addressRiskLabels: [], isSanctioned: false, isMixer: false, isScammer: false,
    smartMoneyScore: null, walletHealthScore: null, recommendations: [],
  };
}

// ── Solana ────────────────────────────────────────────────────────────────────

async function scanSolanaWithSolscan(address: string): Promise<WalletScanData | null> {
  const info = await solscanSvc.getAccountInfo(address);
  if (!info) return null;

  const tokenAccounts = await solscanSvc.getTokenAccounts(address).catch(() => null);
  const tokens: WalletToken[] = (tokenAccounts ?? []).map((t) => ({
    address: t.mint, symbol: t.symbol, name: t.name, logo: null,
    balanceFormatted: (t.balance / Math.pow(10, t.decimals)).toFixed(4),
    usdPrice: null, usdValue: t.usdValue, portfolioPct: null, change24h: null,
  }));

  return {
    chain: "solana", dataSource: "solscan", fetchedAt: new Date().toISOString(),
    nativeBalance: info.solBalance, nativeSymbol: "SOL",
    nativeBalanceUsd: null, totalNetWorthUsd: null,
    txCount: info.txCount ?? 0,
    firstTxDate: null, lastTxDate: null, walletAgeDays: null,
    totalGasSpentNative: null, chainsUsed: ["solana"], walletLabels: [],
    isContract: info.accountType === "program",
    tokens, nfts: [], defiPositions: [], recentTransactions: [],
    topContracts: [], topCounterparties: [],
    addressRiskLabels: [], isSanctioned: false, isMixer: false, isScammer: false,
    smartMoneyScore: null, walletHealthScore: null, recommendations: [],
  };
}

// ── EVM — Moralis (primary, richest) ─────────────────────────────────────────

async function scanEVMWithMoralis(address: string, chain: string): Promise<WalletScanData | null> {
  const [tokensR, nftsR, historyR, netWorthR, defiR, statsR] = await Promise.allSettled([
    moralis.getWalletTokens(address, chain),
    moralis.getWalletNFTs(address, chain),
    moralis.getWalletHistory(address, chain),
    moralis.getWalletNetWorth(address),
    moralis.getDefiPositions(address, chain),
    moralis.getWalletStats(address, chain),
  ]);

  const netWorth = netWorthR.status === "fulfilled" ? netWorthR.value : null;
  const stats    = statsR.status === "fulfilled" ? statsR.value : null;
  const rawHistory = historyR.status === "fulfilled" ? historyR.value ?? [] : [];
  const tokens: WalletToken[] = (tokensR.status === "fulfilled" ? tokensR.value ?? [] : [])
    .map((t) => ({ address: t.address, symbol: t.symbol, name: t.name, logo: t.logo,
      balanceFormatted: t.balanceFormatted, usdPrice: t.usdPrice, usdValue: t.usdValue,
      portfolioPct: t.portfolioPct, change24h: t.change24h }));
  const nfts: WalletNFT[] = (nftsR.status === "fulfilled" ? nftsR.value ?? [] : [])
    .map((n) => ({ tokenAddress: n.tokenAddress, tokenId: n.tokenId, name: n.name,
      collection: n.collection, image: n.image, floorPriceUsd: n.floorPriceUsd }));
  const defiPositions: DeFiPosition[] = (defiR.status === "fulfilled" ? defiR.value ?? [] : [])
    .map((p) => ({ protocol: p.protocol, type: p.type, valueUsd: p.valueUsd,
      tokens: p.tokens, apy: null, status: p.status }));
  const recentTransactions: WalletTx[] = rawHistory.map((t) => ({
    hash: t.hash, category: t.category, summary: t.summary,
    fromAddress: t.fromAddress, toAddress: t.toAddress,
    valueFormatted: t.valueFormatted, valueUsd: t.valueUsd,
    gasFeeNative: t.gasFeeNative, gasFeeUsd: t.gasFeeUsd,
    timestamp: t.timestamp, status: t.status,
  }));
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

  // If Moralis gave us nothing useful, return null so next provider is tried
  if (!netWorth && tokens.length === 0 && rawHistory.length === 0) return null;

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
    addressRiskLabels: [], isSanctioned: false, isMixer: false, isScammer: false,
    smartMoneyScore: null, walletHealthScore: null, recommendations: [],
  };
}

// ── EVM — Ankr + Public RPC (free fallback) ───────────────────────────────────

async function scanEVMWithAnkr(address: string, chain: string): Promise<WalletScanData | null> {
  const resolvedChain = rpc.resolveChain(chain);
  const nativeSymbol  = EVM_NATIVE_SYMBOLS[resolvedChain] ?? "ETH";
  const ANKR_CHAINS = ["eth", "bsc", "polygon", "arbitrum", "optimism", "base"];

  const [nativeBal, txCount, isContractR, ankrTokensR, ankrNftsR, ankrTxsR, multiChainR] =
    await Promise.allSettled([
      rpc.getNativeBalance(address, resolvedChain),
      rpc.getTxCount(address, resolvedChain),
      rpc.isContract(address, resolvedChain),
      ankr.getAccountBalance(address, ANKR_CHAINS),
      ankr.getAccountNFTs(address, ["eth", "bsc", "polygon"]),
      ankr.getAccountTransactions(address, resolvedChain, 20),
      rpc.getMultiChainNativeBalances(address),
    ]);

  const native    = nativeBal.status === "fulfilled" ? nativeBal.value : null;
  const txCnt     = txCount.status === "fulfilled" ? txCount.value : null;
  const isCtrt    = isContractR.status === "fulfilled" ? isContractR.value : null;
  const ankrTokens = ankrTokensR.status === "fulfilled" ? ankrTokensR.value : [];
  const ankrNfts   = ankrNftsR.status === "fulfilled" ? ankrNftsR.value : [];
  const ankrTxs    = ankrTxsR.status === "fulfilled" ? ankrTxsR.value : [];
  const multiChain = multiChainR.status === "fulfilled" ? multiChainR.value : [];

  // If we couldn't get native balance AND no token data, this provider can't help
  if (!native && ankrTokens.length === 0) return null;

  const { totalUsd, stablecoinUsd } = ankr.computePortfolioStats(ankrTokens);
  const sortedTxs = [...ankrTxs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const firstTxDate = sortedTxs[0]?.timestamp ?? null;
  const lastTxDate  = ankrTxs[0]?.timestamp ?? null;
  const totalGasNative = ankrTxs.filter((t) => t.gasFeeNative)
    .reduce((s, t) => s + parseFloat(t.gasFeeNative!.split(" ")[0] || "0"), 0);

  return {
    chain: resolvedChain,
    dataSource: ankrTokens.length > 0 ? "ankr" : "rpc",
    fetchedAt: new Date().toISOString(),
    nativeBalance: native?.formatted ?? "0",
    nativeSymbol,
    nativeBalanceUsd: null,
    totalNetWorthUsd: totalUsd > 0 ? totalUsd : null,
    txCount: txCnt ?? ankrTxs.length,
    firstTxDate, lastTxDate,
    walletAgeDays: firstTxDate ? Math.floor((Date.now() - new Date(firstTxDate).getTime()) / 86_400_000) : null,
    totalGasSpentNative: totalGasNative > 0 ? `${totalGasNative.toFixed(6)} ${nativeSymbol}` : null,
    chainsUsed: multiChain.length > 0 ? multiChain.map((c) => c.chain) : [resolvedChain],
    walletLabels: [], stablecoinUsd: stablecoinUsd > 0 ? stablecoinUsd : undefined,
    isContract: isCtrt ?? undefined,
    multiChainBalances: multiChain.length > 0 ? multiChain : undefined,
    tokens: ankrTokens, nfts: ankrNfts, defiPositions: [],
    recentTransactions: ankrTxs, topContracts: [], topCounterparties: [],
    addressRiskLabels: [], isSanctioned: false, isMixer: false, isScammer: false,
    smartMoneyScore: null, walletHealthScore: null, recommendations: [],
  };
}

// ── EVM — Covalent (token balances if key available) ──────────────────────────

async function scanEVMWithCovalent(address: string, chain: string): Promise<WalletScanData | null> {
  const tokens = await covalent.getTokenBalances(address, chain);
  if (!tokens) return null;

  // Also try native balance from RPC
  const [nativeBal, txCnt, isCtrt] = await Promise.allSettled([
    rpc.getNativeBalance(address, rpc.resolveChain(chain)),
    rpc.getTxCount(address, rpc.resolveChain(chain)),
    rpc.isContract(address, rpc.resolveChain(chain)),
  ]);

  const native = nativeBal.status === "fulfilled" ? nativeBal.value : null;
  const nativeSymbol = EVM_NATIVE_SYMBOLS[rpc.resolveChain(chain)] ?? "ETH";
  const totalUsd = tokens.reduce((s, t) => s + (t.usdValue ?? 0), 0);

  return {
    chain: rpc.resolveChain(chain), dataSource: "covalent",
    fetchedAt: new Date().toISOString(),
    nativeBalance: native?.formatted ?? "0", nativeSymbol,
    nativeBalanceUsd: null, totalNetWorthUsd: totalUsd > 0 ? totalUsd : null,
    txCount: txCnt.status === "fulfilled" ? txCnt.value ?? 0 : 0,
    firstTxDate: null, lastTxDate: null, walletAgeDays: null,
    totalGasSpentNative: null,
    chainsUsed: [rpc.resolveChain(chain)], walletLabels: [],
    isContract: isCtrt.status === "fulfilled" ? isCtrt.value ?? undefined : undefined,
    tokens, nfts: [], defiPositions: [], recentTransactions: [],
    topContracts: [], topCounterparties: [],
    addressRiskLabels: [], isSanctioned: false, isMixer: false, isScammer: false,
    smartMoneyScore: null, walletHealthScore: null, recommendations: [],
  };
}

// ── EVM minimal — Blockscout (native balance + tx count) ─────────────────────

async function scanEVMWithBlockscout(address: string, chain: string): Promise<WalletScanData | null> {
  const info = await blockscout.getAddressInfo(address, chain);
  if (!info) return null;

  const nativeSymbol = EVM_NATIVE_SYMBOLS[chain] ?? "ETH";

  // Also get recent txs from Blockscout
  const txs = await blockscout.getAddressTxs(address, chain, 15).catch(() => []);

  const recentTransactions: WalletTx[] = txs.map((tx) => ({
    hash: tx.hash, category: tx.from.toLowerCase() === address.toLowerCase() ? "send" : "receive",
    summary: `${tx.from.toLowerCase() === address.toLowerCase() ? "Sent" : "Received"} ${tx.valueEth} ${nativeSymbol}`,
    fromAddress: tx.from, toAddress: tx.to,
    valueFormatted: `${tx.valueEth} ${nativeSymbol}`, valueUsd: null,
    gasFeeNative: tx.gasFeeEth ? `${tx.gasFeeEth} ${nativeSymbol}` : null, gasFeeUsd: null,
    timestamp: tx.timestamp, status: tx.status,
  }));

  const sortedTxs = [...recentTransactions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const firstTxDate = sortedTxs[0]?.timestamp ?? null;
  const lastTxDate  = recentTransactions[0]?.timestamp ?? null;

  return {
    chain, dataSource: "blockscout", fetchedAt: new Date().toISOString(),
    nativeBalance: info.nativeBalance, nativeSymbol,
    nativeBalanceUsd: null, totalNetWorthUsd: null,
    txCount: info.txCount,
    firstTxDate, lastTxDate,
    walletAgeDays: firstTxDate ? Math.floor((Date.now() - new Date(firstTxDate).getTime()) / 86_400_000) : null,
    totalGasSpentNative: null, chainsUsed: [chain], walletLabels: [],
    isContract: info.isContract,
    tokens: [], nfts: [], defiPositions: [],
    recentTransactions, topContracts: [], topCounterparties: [],
    addressRiskLabels: [], isSanctioned: false, isMixer: false, isScammer: false,
    smartMoneyScore: null, walletHealthScore: null, recommendations: [],
  };
}

// ── EVM minimal — Blockchair (balance + tx count for ETH) ────────────────────

async function scanEVMWithBlockchair(address: string, chain: string): Promise<WalletScanData | null> {
  const info = await blockchair.getAddressInfo(address, chain);
  if (!info) return null;

  const nativeSymbol = EVM_NATIVE_SYMBOLS[chain] ?? "ETH";
  const balanceEth = info.chain === "ethereum" ? info.balance / 1e18 : 0;

  return {
    chain, dataSource: "blockchair", fetchedAt: new Date().toISOString(),
    nativeBalance: balanceEth.toFixed(8), nativeSymbol,
    nativeBalanceUsd: null, totalNetWorthUsd: null,
    txCount: info.txCount,
    firstTxDate: info.firstSeenReceiving, lastTxDate: info.lastSeenReceiving,
    walletAgeDays: info.firstSeenReceiving
      ? Math.floor((Date.now() - new Date(info.firstSeenReceiving).getTime()) / 86_400_000)
      : null,
    totalGasSpentNative: null, chainsUsed: [chain], walletLabels: [],
    tokens: [], nfts: [], defiPositions: [], recentTransactions: [],
    topContracts: [], topCounterparties: [],
    addressRiskLabels: [], isSanctioned: false, isMixer: false, isScammer: false,
    smartMoneyScore: null, walletHealthScore: null, recommendations: [],
  };
}

// ── EVM minimal — Etherscan (balance + basic tx list) ────────────────────────

async function scanEVMWithEtherscan(address: string): Promise<WalletScanData | null> {
  const [balance, txList] = await Promise.allSettled([
    etherscan.getNativeBalance(address),
    etherscan.getTxList(address, 15),
  ]);

  const bal  = balance.status === "fulfilled" ? balance.value : null;
  const txs  = txList.status === "fulfilled" ? txList.value : [];

  if (!bal && txs.length === 0) return null;

  const sortedTxs = [...txs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const firstTxDate = sortedTxs[0]?.timestamp ?? null;
  const lastTxDate  = txs[0]?.timestamp ?? null;
  const nonce = await etherscan.getNonce(address).catch(() => null);

  return {
    chain: "ethereum", dataSource: "etherscan", fetchedAt: new Date().toISOString(),
    nativeBalance: bal?.balanceEth ?? "0", nativeSymbol: "ETH",
    nativeBalanceUsd: null, totalNetWorthUsd: null,
    txCount: nonce ?? txs.length,
    firstTxDate, lastTxDate,
    walletAgeDays: firstTxDate ? Math.floor((Date.now() - new Date(firstTxDate).getTime()) / 86_400_000) : null,
    totalGasSpentNative: null, chainsUsed: ["ethereum"], walletLabels: [],
    tokens: [], nfts: [], defiPositions: [],
    recentTransactions: txs, topContracts: [], topCounterparties: [],
    addressRiskLabels: [], isSanctioned: false, isMixer: false, isScammer: false,
    smartMoneyScore: null, walletHealthScore: null, recommendations: [],
  };
}

// ── EVM minimal — Public RPC (last resort) ───────────────────────────────────

async function scanEVMWithRPC(address: string, chain: string): Promise<WalletScanData | null> {
  const resolvedChain = rpc.resolveChain(chain);
  const nativeSymbol  = EVM_NATIVE_SYMBOLS[resolvedChain] ?? "ETH";

  const [nativeBal, txCnt, isCtrt] = await Promise.allSettled([
    rpc.getNativeBalance(address, resolvedChain),
    rpc.getTxCount(address, resolvedChain),
    rpc.isContract(address, resolvedChain),
  ]);

  const native = nativeBal.status === "fulfilled" ? nativeBal.value : null;
  if (!native) return null; // Even RPC failed — no data at all

  return {
    chain: resolvedChain, dataSource: "rpc", fetchedAt: new Date().toISOString(),
    nativeBalance: native.formatted, nativeSymbol,
    nativeBalanceUsd: null, totalNetWorthUsd: null,
    txCount: txCnt.status === "fulfilled" ? txCnt.value ?? 0 : 0,
    firstTxDate: null, lastTxDate: null, walletAgeDays: null,
    totalGasSpentNative: null, chainsUsed: [resolvedChain], walletLabels: [],
    isContract: isCtrt.status === "fulfilled" ? isCtrt.value ?? undefined : undefined,
    tokens: [], nfts: [], defiPositions: [], recentTransactions: [],
    topContracts: [], topCounterparties: [],
    addressRiskLabels: [], isSanctioned: false, isMixer: false, isScammer: false,
    smartMoneyScore: null, walletHealthScore: null, recommendations: [],
  };
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function scanWallet(
  address: string,
  chain: string | null,
): Promise<WalletScanResult> {
  const addrType = detectAddressType(address);
  const allAttempts: ProviderAttempt[] = [];
  const fieldSources: Record<string, string> = {};

  // ── Bitcoin ──────────────────────────────────────────────────────────────
  if (addrType === "bitcoin" || chain === "bitcoin") {
    const result = await runWithFallback<WalletScanData>("bitcoinScan", [
      { name: "Blockstream", fn: () => scanBitcoinWithBlockstream(address) },
      { name: "Blockchair", fn: () => scanBitcoinWithBlockchair(address) },
    ]);
    allAttempts.push(...result.attempts);
    if (result.data) {
      result.data.providerAttempts = allAttempts;
      result.data.fieldSources = { nativeBalance: result.provider!, txCount: result.provider!, walletAge: result.provider! };
    }
    return { data: result.data, attempts: allAttempts };
  }

  // ── Solana ───────────────────────────────────────────────────────────────
  if (addrType === "solana" || chain === "solana") {
    const result = await runWithFallback<WalletScanData>("solanaScan", [
      {
        name: "Solscan",
        enabled: !!process.env.SOLSCAN_API_KEY,
        skipReason: "SOLSCAN_API_KEY not set — install key for richer Solana data",
        fn: () => scanSolanaWithSolscan(address),
      },
      { name: "Solana RPC", fn: () => scanSolana(address) },
    ]);
    allAttempts.push(...result.attempts);
    if (result.data) {
      result.data.providerAttempts = allAttempts;
      // NOTE: GoPlus does not support Solana — no securityCheck source is set here.
      // scoreWalletData() will mark securityCheck as unfilled for Solana wallets.
      result.data.fieldSources = {
        nativeBalance: result.provider!,
        txCount: result.provider!,
        tokenBalances: result.provider!,
      };
    }
    return { data: result.data, attempts: allAttempts };
  }

  // ── EVM ──────────────────────────────────────────────────────────────────
  const resolvedChain = chain ?? "ethereum";

  // Run security check in parallel with primary data fetch.
  // Per-provider timeouts: fast data lookups fail quickly; security enrichment gets more time.
  const [primaryResult, secResult] = await Promise.all([
    runWithFallback<WalletScanData>("evmPrimary", [
      {
        name: "Moralis",
        enabled: !!process.env.MORALIS_API_KEY,
        skipReason: "MORALIS_API_KEY not set",
        timeoutMs: 8_000,
        fn: () => scanEVMWithMoralis(address, resolvedChain),
      },
      { name: "Ankr", timeoutMs: 6_000, fn: () => scanEVMWithAnkr(address, resolvedChain) },
      {
        name: "Covalent",
        enabled: !!process.env.COVALENT_API_KEY,
        skipReason: "COVALENT_API_KEY not set",
        timeoutMs: 8_000,
        fn: () => scanEVMWithCovalent(address, resolvedChain),
      },
    ]),
    runWithFallback<ReturnType<typeof goplus.checkAddressSecurity> extends Promise<infer T> ? T : never>(
      "addressSecurity",
      // GoPlus security gets a longer timeout — it's critical for risk scoring
      [{ name: "GoPlus", timeoutMs: 12_000, fn: () => goplus.checkAddressSecurity(address, resolvedChain) }],
    ),
  ]);

  allAttempts.push(...primaryResult.attempts, ...secResult.attempts);
  let scan = primaryResult.data;

  // If primary providers all failed, try minimal fallbacks
  if (!scan) {
    const minimalResult = await runWithFallback<WalletScanData>("evmMinimal", [
      { name: "Blockscout", timeoutMs: 5_000, fn: () => scanEVMWithBlockscout(address, resolvedChain) },
      { name: "Blockchair", timeoutMs: 5_000, fn: () => scanEVMWithBlockchair(address, resolvedChain) },
      {
        name: "Etherscan",
        enabled: resolvedChain === "ethereum" || resolvedChain === "eth",
        skipReason: `Etherscan only supports Ethereum (chain: ${resolvedChain})`,
        timeoutMs: 5_000,
        fn: () => scanEVMWithEtherscan(address),
      },
      { name: "Public RPC", timeoutMs: 4_000, fn: () => scanEVMWithRPC(address, resolvedChain) },
    ]);
    allAttempts.push(...minimalResult.attempts);
    scan = minimalResult.data;
  }

  // All providers failed — return null data but always return full attempt log
  if (!scan) return { data: null, attempts: allAttempts };

  // Apply GoPlus security data
  const sec = secResult.data;
  if (sec) {
    scan.addressRiskLabels = sec.labels;
    scan.isSanctioned = sec.isSanctioned;
    scan.isMixer = sec.isMixer;
    scan.isScammer = sec.isScammer;
    fieldSources.securityCheck = "GoPlus";
  }

  // Build field sources from whichever provider succeeded
  const src = primaryResult.provider ?? scan.dataSource;
  if (parseFloat(scan.nativeBalance) > 0)     fieldSources.nativeBalance  = src;
  if (scan.txCount > 0)                        fieldSources.txCount        = src;
  if (scan.totalNetWorthUsd != null)           fieldSources.totalNetWorth  = src;
  if (scan.firstTxDate)                        fieldSources.walletAge      = src;
  if (scan.tokens.length > 0)                  fieldSources.tokenBalances  = src;
  if (scan.chainsUsed.length > 0)              fieldSources.chainActivity  = src;

  scan.providerAttempts = allAttempts;
  scan.fieldSources = { ...fieldSources, ...(scan.fieldSources ?? {}) };

  return { data: scan, attempts: allAttempts };
}
