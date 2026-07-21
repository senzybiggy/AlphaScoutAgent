/**
 * Blockstream API — free Bitcoin data, no API key required.
 * https://github.com/Blockstream/esplora/blob/master/API.md
 */
import { cachedFetch } from "./cache.js";

const BASE = "https://blockstream.info/api";
const TIMEOUT = 10_000;

export interface BitcoinAddressInfo {
  address: string;
  confirmedBalance: number; // satoshis
  confirmedBalanceBTC: string;
  txCount: number;
  totalReceived: number;
  totalSent: number;
}

export interface BitcoinTx {
  txid: string;
  timestamp: string | null;
  confirmed: boolean;
  valueIn: number;
  valueOut: number;
  fee: number;
  inputs: { address: string; value: number }[];
  outputs: { address: string; value: number }[];
}

export async function getBitcoinAddress(address: string): Promise<BitcoinAddressInfo | null> {
  return cachedFetch(`btc:addr:${address}`, async () => {
    const r = await fetch(`${BASE}/address/${address}`, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return null;
    const d = (await r.json()) as Record<string, unknown>;
    const cs = d.chain_stats as Record<string, number>;
    const funded = cs?.funded_txo_sum ?? 0;
    const spent = cs?.spent_txo_sum ?? 0;
    const balance = funded - spent;
    return {
      address,
      confirmedBalance: balance,
      confirmedBalanceBTC: (balance / 1e8).toFixed(8),
      txCount: cs?.tx_count ?? 0,
      totalReceived: funded,
      totalSent: spent,
    };
  });
}

export async function getBitcoinTxs(address: string): Promise<BitcoinTx[]> {
  return cachedFetch(`btc:txs:${address}`, async () => {
    const r = await fetch(`${BASE}/address/${address}/txs`, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return [];
    const txs = (await r.json()) as Record<string, unknown>[];
    return txs.slice(0, 20).map((t) => {
      const vin = (t.vin as Record<string, unknown>[]) ?? [];
      const vout = (t.vout as Record<string, unknown>[]) ?? [];
      const inputs = vin.map((v) => ({
        address: String((v.prevout as Record<string, unknown>)?.scriptpubkey_address ?? ""),
        value: Number((v.prevout as Record<string, unknown>)?.value ?? 0),
      }));
      const outputs = vout.map((v) => ({
        address: String(v.scriptpubkey_address ?? ""),
        value: Number(v.value ?? 0),
      }));
      const status = t.status as Record<string, unknown>;
      return {
        txid: String(t.txid ?? ""),
        timestamp: status?.block_time ? new Date(Number(status.block_time) * 1000).toISOString() : null,
        confirmed: Boolean(status?.confirmed),
        valueIn: inputs.reduce((s, i) => s + i.value, 0),
        valueOut: outputs.reduce((s, o) => s + o.value, 0),
        fee: Number(t.fee ?? 0),
        inputs,
        outputs,
      };
    });
  });
}
