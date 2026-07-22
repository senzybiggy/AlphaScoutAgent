/** LocalStorage-backed alerts store with polling support. */

export type AlertCondition =
  | "risk_score_above"
  | "risk_score_below"
  | "large_transaction"
  | "whale_activity"
  | "liquidity_drop"
  | "liquidity_spike"
  | "price_drop"
  | "price_spike";

export interface Alert {
  id: string;
  target: string;
  type: "wallet" | "token" | "contract";
  chain: string | null;
  label: string | null;
  condition: AlertCondition;
  threshold: number | null; // e.g. risk score 70, price change 20%
  enabled: boolean;
  createdAt: string;
  lastCheckedAt: string | null;
  lastTriggeredAt: string | null;
  triggerCount: number;
}

export interface AlertEvent {
  alertId: string;
  target: string;
  condition: AlertCondition;
  message: string;
  value: number | null;
  triggeredAt: string;
}

const KEY = "alphascout:alerts";
const EVENTS_KEY = "alphascout:alert-events";

function load(): Alert[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Alert[]; }
  catch { return []; }
}
function save(items: Alert[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

function loadEvents(): AlertEvent[] {
  try { return JSON.parse(localStorage.getItem(EVENTS_KEY) ?? "[]") as AlertEvent[]; }
  catch { return []; }
}
function saveEvents(events: AlertEvent[]): void {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(0, 100)));
}

const CONDITION_LABELS: Record<AlertCondition, string> = {
  risk_score_above: "Risk score rises above",
  risk_score_below: "Risk score falls below",
  large_transaction: "Large transaction detected",
  whale_activity: "Whale activity detected",
  liquidity_drop: "Liquidity drops by",
  liquidity_spike: "Liquidity spikes by",
  price_drop: "Price drops by",
  price_spike: "Price spikes by",
};

export const alertsStore = {
  getAll(): Alert[] { return load(); },
  getEvents(): AlertEvent[] { return loadEvents(); },
  getConditionLabel(c: AlertCondition): string { return CONDITION_LABELS[c]; },

  add(item: Omit<Alert, "id" | "createdAt" | "lastCheckedAt" | "lastTriggeredAt" | "triggerCount">): Alert {
    const alerts = load();
    const newAlert: Alert = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastCheckedAt: null,
      lastTriggeredAt: null,
      triggerCount: 0,
    };
    save([newAlert, ...alerts]);
    return newAlert;
  },

  remove(id: string): void {
    save(load().filter((a) => a.id !== id));
  },

  toggle(id: string): void {
    save(load().map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  },

  /** Called by the poller with fresh scan result data. Returns newly triggered events. */
  check(alert: Alert, scanResult: Record<string, unknown>): AlertEvent[] {
    const now = new Date().toISOString();
    const events: AlertEvent[] = [];
    const allAlerts = load();
    const idx = allAlerts.findIndex((a) => a.id === alert.id);
    if (idx === -1) return events;

    // Update lastCheckedAt
    allAlerts[idx].lastCheckedAt = now;

    const riskScore = scanResult.riskScore as number | null;
    const tokenScan = scanResult.tokenScan as Record<string, unknown> | null;
    const walletScan = scanResult.walletScan as Record<string, unknown> | null;

    let triggered = false;
    let message = "";
    let value: number | null = null;

    switch (alert.condition) {
      case "risk_score_above":
        if (riskScore != null && alert.threshold != null && riskScore > alert.threshold) {
          triggered = true;
          message = `Risk score is ${riskScore} (above threshold ${alert.threshold})`;
          value = riskScore;
        }
        break;
      case "risk_score_below":
        if (riskScore != null && alert.threshold != null && riskScore < alert.threshold) {
          triggered = true;
          message = `Risk score is ${riskScore} (below threshold ${alert.threshold})`;
          value = riskScore;
        }
        break;
      case "liquidity_drop":
        if (tokenScan?.liquidityUsd != null && typeof tokenScan.liquidityUsd === "number") {
          // We'd need a baseline — just flag if liquidity < threshold USD
          if (alert.threshold != null && (tokenScan.liquidityUsd as number) < alert.threshold) {
            triggered = true;
            message = `Liquidity is $${(tokenScan.liquidityUsd as number).toLocaleString()} (below $${alert.threshold.toLocaleString()})`;
            value = tokenScan.liquidityUsd as number;
          }
        }
        break;
      case "price_drop":
        if (tokenScan?.priceChange24h != null && typeof tokenScan.priceChange24h === "number") {
          if (alert.threshold != null && (tokenScan.priceChange24h as number) < -Math.abs(alert.threshold)) {
            triggered = true;
            message = `Price dropped ${(tokenScan.priceChange24h as number).toFixed(1)}% in 24h (threshold: -${Math.abs(alert.threshold)}%)`;
            value = tokenScan.priceChange24h as number;
          }
        }
        break;
      case "price_spike":
        if (tokenScan?.priceChange24h != null && typeof tokenScan.priceChange24h === "number") {
          if (alert.threshold != null && (tokenScan.priceChange24h as number) > Math.abs(alert.threshold)) {
            triggered = true;
            message = `Price spiked +${(tokenScan.priceChange24h as number).toFixed(1)}% in 24h (threshold: +${Math.abs(alert.threshold)}%)`;
            value = tokenScan.priceChange24h as number;
          }
        }
        break;
      case "large_transaction":
        // Check walletScan for recent large txs
        if (walletScan?.recentTransactions) {
          const txs = walletScan.recentTransactions as Array<{ valueUsd?: string | null }>;
          const bigTx = txs.find((t) => {
            const usd = parseFloat(t.valueUsd ?? "0");
            return usd > (alert.threshold ?? 10000);
          });
          if (bigTx) {
            triggered = true;
            message = `Large transaction of $${bigTx.valueUsd} detected`;
            value = parseFloat(bigTx.valueUsd ?? "0");
          }
        }
        break;
      case "whale_activity":
        if (walletScan?.walletLabels) {
          const labels = walletScan.walletLabels as string[];
          if (labels.some((l) => l.toLowerCase().includes("whale"))) {
            triggered = true;
            message = `Whale activity detected on wallet`;
          }
        }
        break;
      default:
        break;
    }

    if (triggered) {
      allAlerts[idx].lastTriggeredAt = now;
      allAlerts[idx].triggerCount = (allAlerts[idx].triggerCount ?? 0) + 1;
      const event: AlertEvent = {
        alertId: alert.id,
        target: alert.target,
        condition: alert.condition,
        message,
        value,
        triggeredAt: now,
      };
      events.push(event);
      const existingEvents = loadEvents();
      saveEvents([event, ...existingEvents]);
    }

    save(allAlerts);
    return events;
  },

  clearEvents(): void {
    saveEvents([]);
  },
};
