import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, BellOff, Plus, Trash2, X, RefreshCw, CheckCircle, AlertTriangle, Activity, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { alertsStore, type Alert, type AlertCondition, type AlertEvent } from "@/lib/alerts-store";
import { watchlistStore } from "@/lib/watchlist-store";

const CONDITIONS: { value: AlertCondition; label: string; needsThreshold: boolean; unit: string }[] = [
  { value: "risk_score_above", label: "Risk score rises above", needsThreshold: true, unit: "/100" },
  { value: "risk_score_below", label: "Risk score falls below", needsThreshold: true, unit: "/100" },
  { value: "large_transaction", label: "Large transaction detected", needsThreshold: true, unit: "USD threshold" },
  { value: "whale_activity", label: "Whale activity detected", needsThreshold: false, unit: "" },
  { value: "liquidity_drop", label: "Liquidity drops below", needsThreshold: true, unit: "USD" },
  { value: "price_drop", label: "Price drops by", needsThreshold: true, unit: "%" },
  { value: "price_spike", label: "Price spikes by", needsThreshold: true, unit: "%" },
];

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

async function runScan(target: string, type: string, chain: string | null): Promise<Record<string, unknown>> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, type, chain: chain ?? undefined }),
  });
  if (!r.ok) throw new Error("Scan failed");
  return r.json();
}

function AddAlertForm({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [type, setType] = useState<Alert["type"]>("wallet");
  const [chain, setChain] = useState("");
  const [label, setLabel] = useState("");
  const [condition, setCondition] = useState<AlertCondition>("risk_score_above");
  const [threshold, setThreshold] = useState("70");
  const watchlistItems = watchlistStore.getAll();
  const selectedCondition = CONDITIONS.find((c) => c.value === condition);

  const handleAdd = () => {
    if (!target.trim()) return;
    alertsStore.add({
      target: target.trim(),
      type,
      chain: chain.trim() || null,
      label: label.trim() || null,
      condition,
      threshold: selectedCondition?.needsThreshold ? parseFloat(threshold) || null : null,
      enabled: true,
    });
    setTarget(""); setType("wallet"); setChain(""); setLabel(""); setCondition("risk_score_above"); setThreshold("70");
    setOpen(false);
    onAdd();
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-2 font-mono text-sm" variant="outline">
        <Plus className="h-4 w-4" />Create Alert
      </Button>
    );
  }

  return (
    <Card className="bg-card/60 border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-mono font-bold text-primary">CREATE ALERT</p>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Pre-fill from watchlist */}
        {watchlistItems.length > 0 && (
          <div>
            <p className="text-xs font-mono text-muted-foreground mb-1.5">From watchlist:</p>
            <div className="flex flex-wrap gap-1.5">
              {watchlistItems.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setTarget(item.target); setType(item.type as Alert["type"]); setChain(item.chain ?? ""); }}
                  className="text-[10px] font-mono px-2 py-1 rounded border border-border/40 hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label ?? item.target.slice(0, 16) + "…"}
                </button>
              ))}
            </div>
          </div>
        )}

        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Target address or URL…"
          className="w-full bg-card/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
        />

        <div className="flex gap-2 flex-wrap">
          {(["wallet", "token", "contract"] as Alert["type"][]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn("text-xs font-mono px-3 py-1.5 rounded-full border transition-colors capitalize",
                type === t ? "border-primary text-primary bg-primary/10" : "border-border/40 text-muted-foreground hover:border-primary/40"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value as AlertCondition)}
          className="w-full bg-card/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/50"
        >
          {CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        {selectedCondition?.needsThreshold && (
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="Threshold value"
              className="flex-1 bg-card/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
            />
            <span className="text-xs font-mono text-muted-foreground">{selectedCondition.unit}</span>
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            placeholder="Chain (optional)"
            className="flex-1 bg-card/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="flex-1 bg-card/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
          />
        </div>

        <Button onClick={handleAdd} disabled={!target.trim()} className="w-full font-mono text-sm">
          <Bell className="h-4 w-4 mr-2" />Create Alert
        </Button>
      </CardContent>
    </Card>
  );
}

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [checking, setChecking] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    setAlerts(alertsStore.getAll());
    setEvents(alertsStore.getEvents());
  }, []);

  useEffect(() => {
    refresh();
    // Auto-poll enabled alerts every 5 minutes
    pollingRef.current = setInterval(() => {
      const enabled = alertsStore.getAll().filter((a) => a.enabled);
      if (enabled.length === 0) return;
      enabled.forEach(async (alert) => {
        try {
          const result = await runScan(alert.target, alert.type, alert.chain);
          alertsStore.check(alert, result);
          refresh();
        } catch {
          // ignore poll errors
        }
      });
      setLastChecked(new Date().toISOString());
    }, 5 * 60 * 1000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [refresh]);

  const handleCheck = async (alert: Alert) => {
    setChecking(alert.id);
    try {
      const result = await runScan(alert.target, alert.type, alert.chain);
      alertsStore.check(alert, result);
      refresh();
      setLastChecked(new Date().toISOString());
    } catch {
      // ignore
    } finally {
      setChecking(null);
    }
  };

  const handleToggle = (id: string) => {
    alertsStore.toggle(id);
    refresh();
  };

  const handleRemove = (id: string) => {
    alertsStore.remove(id);
    refresh();
  };

  const enabledCount = alerts.filter((a) => a.enabled).length;

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-2">
            <Bell className="h-8 w-8 text-primary" />
            ALERTS
          </h1>
          <p className="text-muted-foreground">
            Monitor wallets, tokens, and contracts for on-chain changes.
            {lastChecked && <span className="ml-2 text-xs font-mono text-muted-foreground/50">Last checked {timeAgo(lastChecked)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {enabledCount > 0 && (
            <Badge variant="outline" className="font-mono text-xs text-success border-success/30 bg-success/5">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse mr-1.5" />
              {enabledCount} active
            </Badge>
          )}
          <AddAlertForm onAdd={refresh} />
        </div>
      </div>

      {/* Active Alerts */}
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center space-y-4 opacity-40 mb-8">
          <BellOff className="h-12 w-12 text-primary" />
          <p className="font-mono text-sm text-muted-foreground">NO ALERTS CONFIGURED</p>
          <p className="text-xs text-muted-foreground font-mono">Create an alert to monitor on-chain activity.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Active Alerts ({alerts.length})</h2>
          {alerts.map((alert) => {
            const condMeta = CONDITIONS.find((c) => c.value === alert.condition);
            const isChecking = checking === alert.id;
            return (
              <Card key={alert.id} className={cn("bg-card/50 border-border/40 transition-colors", alert.enabled ? "border-primary/10" : "opacity-60")}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn("p-2 rounded-lg flex-shrink-0", alert.enabled ? "bg-primary/10" : "bg-muted/10")}>
                        {alert.enabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-mono font-bold truncate max-w-[180px]">
                            {alert.label ?? alert.target.slice(0, 18) + "…"}
                          </p>
                          <Badge variant="outline" className="text-xs font-mono capitalize border-border/30 text-muted-foreground">
                            {alert.type}
                          </Badge>
                          {alert.chain && (
                            <Badge variant="outline" className="text-xs font-mono border-border/30 text-muted-foreground capitalize">
                              {alert.chain}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                          {condMeta?.label ?? alert.condition}
                          {alert.threshold != null && ` ${alert.threshold}${condMeta?.unit ?? ""}`}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground/40">
                          {alert.triggerCount > 0 && `Triggered ${alert.triggerCount}× · `}
                          {alert.lastCheckedAt ? `Checked ${timeAgo(alert.lastCheckedAt)}` : "Not checked yet"}
                          {alert.lastTriggeredAt && ` · Last triggered ${timeAgo(alert.lastTriggeredAt)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={alert.enabled}
                        onCheckedChange={() => handleToggle(alert.id)}
                        className="data-[state=checked]:bg-primary"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-mono text-muted-foreground hover:text-primary"
                        onClick={() => handleCheck(alert)}
                        disabled={isChecking}
                      >
                        {isChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">Check</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(alert.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Alert Event History */}
      {events.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Alert History ({events.length})</h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-mono text-muted-foreground/50 hover:text-destructive"
              onClick={() => { alertsStore.clearEvents(); refresh(); }}
            >
              Clear History
            </Button>
          </div>
          <div className="space-y-2">
            {events.slice(0, 20).map((event, i) => (
              <Card key={i} className="bg-card/30 border-border/20">
                <CardContent className="p-3 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-bold text-foreground">{event.message}</p>
                    <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                      {event.target.slice(0, 20)}… · {timeAgo(event.triggeredAt)}
                    </p>
                  </div>
                  {event.value != null && (
                    <span className="text-xs font-mono text-yellow-400 font-bold flex-shrink-0">{event.value.toFixed(2)}</span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && events.length === 0 && (
        <Card className="bg-card/20 border-border/20 mt-4">
          <CardContent className="p-6">
            <h3 className="text-sm font-mono font-bold mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />HOW ALERTS WORK
            </h3>
            <ul className="space-y-2">
              {[
                "Alerts are checked automatically every 5 minutes while this page is open",
                "You can also manually check any alert with the Refresh button",
                "Alert history is stored in your browser (localStorage)",
                "Combine with your Watchlist to monitor saved addresses",
              ].map((tip, i) => (
                <li key={i} className="flex gap-2 text-xs font-mono text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5 text-success flex-shrink-0 mt-0.5" />
                  {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
