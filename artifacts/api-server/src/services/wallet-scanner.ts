/**
 * Wallet Scanner — orchestrates real on-chain data fetching for wallet addresses.
 * Supports EVM (via Moralis + GoPlus) and Bitcoin (via Blockstream).
 */
import * as moralis from "./moralis.js";
import * as goplus from "./goplus.js";
import * as blockstream from "./blockstream.js";
import type { WalletScanData, WalletToken, WalletNFT, WalletTx, DeFiPosition } from "../routes/analyze/types.js";

export type { WalletScanData };

const EVM_NATIVE_SYMBOLS: Record<string, string> = {
  eth: "ETH", polygon: "MATIC", bsc: "BNB",
  arbitrum: "ETH", optimism: "ETH", base: "ETH",
  avalanche: "AVAX", fantom: "FTM",
};

function derivedStats(txs: moralis.MoralisTx[], address: string) {
  const addr = address.toLowerCase();
  const contractCounts = new Map<string, number>();
  const counterpartyCounts = new Map<string, { count: number; in: number; out: number }>();

  for (const tx of txs) {
    // Top contracts: non-EOA `to` addresses (detect by tx category)
    if (tx.toAddress && tx.category !== "receive" && tx.toAddress.toLowerCase() !== addr) {
      const to = tx.toAddress.toLowerCase();
      contractCounts.set(to, (contractCounts.get(to) ?? 0) + 1);
    }
    // Counterparties: wallet-to-wallet
    if (tx.category === "send" || tx.category === "receive") {
      const other = tx.category === "send"
        ? tx.toAddress?.toLowerCase()
        : tx.fromAddress?.toLowerCase();
      if (other && other !== addr) {
        const existing = counterpartyCounts.get(other) ?? { count: 0, in: 0, out: 0 };
        existing.count++;
        if (tx.category === "receive") existing.in++;
        else existing.out++;
        counterpartyCounts.set(other, existing);
      }
    }
  }

  const topContracts = [...contractCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([address, txCount]) => ({ address, label: null, txCount }));

  const topCounterparties = [...counterpartyCounts.entries()]
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([address, stats]) => ({
      address,
      label: null,
      txCount: stats.count,
      direction: (stats.in > 0 && stats.out > 0 ? "both" : stats.in > 0 ? "in" : "out") as "in" | "out" | "both",
    }));

  return { topContracts, topCounterparties };
}

// ── Bitcoin ──────────────────────────────────────────────────────────────────

async function scanBitcoin(address: string): Promise<WalletScanData> {
  const [addrInfo, txs] = await Promise.allSettled([
    blockstream.getBitcoinAddress(address),
    blockstream.getBitcoinTxs(address),
  ]);

  const info = addrInfo.status === "fulfilled" ? addrInfo.value : null;
  const rawTxs = txs.status === "fulfilled" ? txs.value : [];

  const firstTx = rawTxs.find((t) => t.confirmed && t.timestamp)?.timestamp ?? null;
  const lastTx = rawTxs[0]?.timestamp ?? null;
  const walletAgeDays = firstTx
    ? Math.floor((Date.now() - new Date(firstTx).getTime()) / 86_400_000)
    : null;

  const recentTransactions: WalletTx[] = rawTxs.map((t) => {
    const sentToOther = t.outputs.filter((o) => o.address !== address);
    const toAddr = sentToOther[0]?.address ?? null;
    const valueSats = sentToOther.reduce((s, o) => s + o.value, 0);
    return {
      hash: t.txid,
      category: "transfer",
      summary: `${(valueSats / 1e8).toFixed(8)} BTC transfer`,
      fromAddress: address,
      toAddress: toAddr,
      valueFormatted: `${(valueSats / 1e8).toFixed(8)} BTC`,
      valueUsd: null,
      gasFeeNative: `${(t.fee / 1e8).toFixed(8)} BTC`,
      gasFeeUsd: null,
      timestamp: t.timestamp ?? new Date().toISOString(),
      status: t.confirmed ? "success" : "failed",
    };
  });

  return {
    chain: "bitcoin",
    dataSource: "blockstream",
    fetchedAt: new Date().toISOString(),
    nativeBalance: info ? info.confirmedBalanceBTC : "0",
    nativeSymbol: "BTC",
    nativeBalanceUsd: null,
    totalNetWorthUsd: null,
    txCount: info?.txCount ?? 0,
    firstTxDate: firstTx,
    lastTxDate: lastTx,
    walletAgeDays,
    totalGasSpentNative: null,
    chainsUsed: ["bitcoin"],
    walletLabels: [],
    tokens: [],
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
  };
}

// ── EVM (Moralis + GoPlus) ───────────────────────────────────────────────────

async function scanEVM(address: string, chain: string): Promise<WalletScanData> {
  const hasMoralis = Boolean(process.env.MORALIS_API_KEY);

  const [tokensR, nftsR, historyR, netWorthR, defiR, statsR, addrSecR] = await Promise.allSettled([
    hasMoralis ? moralis.getWalletTokens(address, chain) : Promise.resolve([] as moralis.MoralisToken[]),
    hasMoralis ? moralis.getWalletNFTs(address, chain) : Promise.resolve([] as moralis.MoralisNFT[]),
    hasMoralis ? moralis.getWalletHistory(address, chain) : Promise.resolve([] as moralis.MoralisTx[]),
    hasMoralis ? moralis.getWalletNetWorth(address) : Promise.resolve(null),
    hasMoralis ? moralis.getDefiPositions(address, chain) : Promise.resolve([] as moralis.MoralisDefiPosition[]),
    hasMoralis ? moralis.getWalletStats(address, chain) : Promise.resolve(null),
    goplus.checkAddressSecurity(address, chain),
  ]);

  const tokens: WalletToken[] = tokensR.status === "fulfilled"
    ? (tokensR.value ?? []).map((t) => ({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        logo: t.logo,
        balanceFormatted: t.balanceFormatted,
        usdPrice: t.usdPrice,
        usdValue: t.usdValue,
        portfolioPct: t.portfolioPct,
        change24h: t.change24h,
      }))
    : [];

  const nfts: WalletNFT[] = nftsR.status === "fulfilled"
    ? (nftsR.value ?? []).map((n) => ({
        tokenAddress: n.tokenAddress,
        tokenId: n.tokenId,
        name: n.name,
        collection: n.collection,
        image: n.image,
        floorPriceUsd: n.floorPriceUsd,
      }))
    : [];

  const rawHistory = historyR.status === "fulfilled" ? (historyR.value ?? []) : [];
  const recentTransactions: WalletTx[] = rawHistory.map((t) => ({
    hash: t.hash,
    category: t.category,
    summary: t.summary,
    fromAddress: t.fromAddress,
    toAddress: t.toAddress,
    valueFormatted: t.valueFormatted,
    valueUsd: t.valueUsd,
    gasFeeNative: t.gasFeeNative,
    gasFeeUsd: t.gasFeeUsd,
    timestamp: t.timestamp,
    status: t.status,
  }));

  const defiPositions: DeFiPosition[] = defiR.status === "fulfilled"
    ? (defiR.value ?? []).map((p) => ({
        protocol: p.protocol,
        type: p.type,
        valueUsd: p.valueUsd,
        tokens: p.tokens,
        apy: null,
        status: p.status,
      }))
    : [];

  const netWorth = netWorthR.status === "fulfilled" ? netWorthR.value : null;
  const stats = statsR.status === "fulfilled" ? statsR.value : null;
  const addrSec = addrSecR.status === "fulfilled" ? addrSecR.value : null;

  const { topContracts, topCounterparties } = derivedStats(rawHistory, address);

  // Chains used: from net worth chains with non-zero balance
  const chainsUsed = netWorth?.chains.map((c) => c.chain).filter(Boolean) ?? [moralis.toMoralisChain(chain)];

  // Native balance from net worth
  const primaryChain = netWorth?.chains.find((c) => c.chain === moralis.toMoralisChain(chain));
  const nativeSymbol = EVM_NATIVE_SYMBOLS[moralis.toMoralisChain(chain)] ?? "ETH";
  const nativeBalance = primaryChain?.nativeBalance ?? "0";
  const nativeBalanceUsd = primaryChain?.nativeUsd ?? null;

  // Gas spent: sum from recent txs
  const totalGasNative = rawHistory
    .filter((t) => t.gasFeeNative)
    .reduce((s, t) => s + parseFloat(t.gasFeeNative!), 0);
  const totalGasSpentNative = totalGasNative > 0 ? `${totalGasNative.toFixed(5)} ${nativeSymbol}` : null;

  // Wallet first/last tx
  const sortedTxs = [...rawHistory].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const firstTxDate = sortedTxs[0]?.timestamp ?? null;
  const lastTxDate = rawHistory[0]?.timestamp ?? null;
  const walletAgeDays = firstTxDate
    ? Math.floor((Date.now() - new Date(firstTxDate).getTime()) / 86_400_000)
    : null;

  return {
    chain: moralis.toMoralisChain(chain),
    dataSource: hasMoralis ? "moralis" : "limited",
    fetchedAt: new Date().toISOString(),
    nativeBalance,
    nativeSymbol,
    nativeBalanceUsd,
    totalNetWorthUsd: netWorth?.totalUsd ?? null,
    txCount: stats?.txCount ?? rawHistory.length,
    firstTxDate,
    lastTxDate,
    walletAgeDays,
    totalGasSpentNative,
    chainsUsed,
    walletLabels: [],
    tokens,
    nfts,
    defiPositions,
    recentTransactions,
    topContracts,
    topCounterparties,
    addressRiskLabels: addrSec?.labels ?? [],
    isSanctioned: addrSec?.isSanctioned ?? false,
    isMixer: addrSec?.isMixer ?? false,
    isScammer: addrSec?.isScammer ?? false,
    smartMoneyScore: null, // filled by AI
    walletHealthScore: null, // filled by AI
    recommendations: [], // filled by AI
  };
}

// ── Public entry point ───────────────────────────────────────────────────────

export async function scanWallet(address: string, chain: string | null): Promise<WalletScanData> {
  if (chain === "bitcoin") return scanBitcoin(address);
  return scanEVM(address, chain ?? "ethereum");
}
