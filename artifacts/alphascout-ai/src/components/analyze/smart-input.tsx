import { useState, useEffect, useRef } from "react";
import {
  Search,
  Loader2,
  Wallet,
  Coins,
  FileCode2,
  Globe,
  HelpCircle,
  Zap,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { detectInputType, DetectionResult } from "@/lib/detect-input-type";
import { cn } from "@/lib/utils";
import { useAppKit } from "@reown/appkit/react";

interface SmartInputProps {
  onSubmit: (value: string, detection: DetectionResult) => void;
  isLoading: boolean;
  /** Address from a connected wallet, if any. Drives the "Use Connected Wallet" mode. */
  connectedAddress?: string;
  /** Human-readable network name shown in the connected-wallet badge. */
  connectedNetwork?: string;
}

const TYPE_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  wallet:   { icon: Wallet,     color: "text-primary",          bg: "bg-primary/10 border-primary/30"           },
  token:    { icon: Coins,      color: "text-yellow-400",       bg: "bg-yellow-400/10 border-yellow-400/30"     },
  contract: { icon: FileCode2,  color: "text-emerald-400",      bg: "bg-emerald-400/10 border-emerald-400/30"   },
  project:  { icon: Globe,      color: "text-purple-400",       bg: "bg-purple-400/10 border-purple-400/30"     },
  unknown:  { icon: HelpCircle, color: "text-muted-foreground", bg: "bg-muted/30 border-border/30"              },
};

const EXAMPLES = [
  "0x742d35Cc6634C0532925a3b844Bc9e7595f6E123",
  "vitalik.eth",
  "uniswap.org",
  "Aave",
];

/** Shorten long addresses for display only */
function shortAddr(addr: string) {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

type InputMode = "connected" | "manual";

export function SmartInput({
  onSubmit,
  isLoading,
  connectedAddress,
  connectedNetwork,
}: SmartInputProps) {
  const { open } = useAppKit();

  // Start in connected mode when a wallet is already linked; else manual.
  const [mode, setMode] = useState<InputMode>(connectedAddress ? "connected" : "manual");

  // The text field value — managed independently of the mode so users can always type.
  const [value, setValue] = useState(connectedAddress ?? "");
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [focused, setFocused] = useState(false);

  const prevAddress = useRef(connectedAddress);

  // When wallet connects or changes address:
  // • Switch into connected mode automatically.
  // • Sync the input value to the new address.
  useEffect(() => {
    if (connectedAddress && connectedAddress !== prevAddress.current) {
      prevAddress.current = connectedAddress;
      setMode("connected");
      setValue(connectedAddress);
    }
    // Wallet disconnected while in connected mode → fall back to manual
    if (!connectedAddress && mode === "connected") {
      setMode("manual");
      setValue("");
    }
  }, [connectedAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the user explicitly picks "Use Connected Wallet", fill the input.
  const handleModeChange = (next: InputMode) => {
    setMode(next);
    if (next === "connected" && connectedAddress) {
      setValue(connectedAddress);
    }
  };

  // Detect input type on every keystroke
  useEffect(() => {
    if (value.trim().length > 2) {
      setDetection(detectInputType(value));
    } else {
      setDetection(null);
    }
  }, [value]);

  const meta = detection ? TYPE_META[detection.type] : null;
  const Icon = meta?.icon ?? Search;

  /** Submit whatever is in the text field */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isLoading) return;
    const det = detectInputType(value.trim());
    onSubmit(value.trim(), det);
  };

  /** "Scan Connected Wallet" quick action — bypasses text field */
  const handleScanConnected = () => {
    if (!connectedAddress || isLoading) return;
    const det = detectInputType(connectedAddress);
    onSubmit(connectedAddress, det);
  };

  const handleExample = (example: string) => {
    setMode("manual");
    setValue(example);
  };

  const isWalletConnected = Boolean(connectedAddress);

  return (
    <div className="space-y-4">

      {/* ── Method toggle (always shown) ───────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-lg border border-border/40 bg-card/30 w-fit">
        <button
          type="button"
          onClick={() => {
            if (!isWalletConnected) {
              // Wallet not connected — open the modal instead
              open();
              return;
            }
            handleModeChange("connected");
          }}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-xs font-mono transition-all duration-200",
            mode === "connected" && isWalletConnected
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-card/60",
          )}
        >
          <Wallet className="h-3.5 w-3.5" />
          Use Connected Wallet
          {!isWalletConnected && (
            <span className="opacity-50">(click to connect)</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleModeChange("manual")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-xs font-mono transition-all duration-200",
            mode === "manual" || !isWalletConnected
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-card/60",
          )}
        >
          <Search className="h-3.5 w-3.5" />
          Manual Address
        </button>
      </div>

      {/* ── Connected wallet status + quick-scan ──────────────────────── */}
      {isWalletConnected && mode === "connected" && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3 rounded-lg border border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse flex-shrink-0" />
            <span className="text-xs font-mono text-muted-foreground">CONNECTED:</span>
            <span className="text-xs font-mono text-foreground truncate">{connectedAddress}</span>
            {connectedNetwork && (
              <span className="text-xs font-mono text-muted-foreground opacity-60 hidden lg:inline flex-shrink-0">
                · {connectedNetwork}
              </span>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isLoading}
            onClick={handleScanConnected}
            className="flex-shrink-0 font-mono text-xs border-primary/30 hover:bg-primary/10 gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5 text-primary" />
            )}
            SCAN CONNECTED WALLET
          </Button>
        </div>
      )}

      {/* ── No wallet connected, connected mode selected ───────────────── */}
      {!isWalletConnected && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/30 bg-card/20 text-muted-foreground text-xs font-mono animate-in fade-in duration-200">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          No wallet connected. Paste any address below, or{" "}
          <button
            type="button"
            onClick={() => open()}
            className="text-primary hover:underline underline-offset-2"
          >
            connect a wallet
          </button>{" "}
          for one-click scanning.
        </div>
      )}

      {/* ── Text input (always visible) ───────────────────────────────── */}
      <form onSubmit={handleSubmit} data-testid="smart-input-form">
        <div
          className={cn(
            "relative flex items-center gap-0 rounded-xl border transition-all duration-200 bg-card/50",
            focused
              ? "border-primary/60 shadow-[0_0_0_2px_hsl(var(--primary)/0.12)]"
              : "border-border/50",
          )}
        >
          {/* Icon / type indicator */}
          <div className="pl-4 pr-2 flex-shrink-0">
            <Icon
              className={cn(
                "h-5 w-5 transition-colors duration-200",
                meta ? meta.color : "text-muted-foreground",
              )}
            />
          </div>

          {/* Input */}
          <input
            data-testid="smart-analyze-input"
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              // If the user starts typing their own thing, switch to manual
              if (mode === "connected" && e.target.value !== connectedAddress) {
                setMode("manual");
              }
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Paste a wallet address, token contract, smart contract, or project URL…"
            className="flex-1 bg-transparent py-4 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none text-foreground min-w-0"
            autoComplete="off"
            spellCheck={false}
          />

          {/* Detection badge */}
          {detection && detection.type !== "unknown" && (
            <div
              className={cn(
                "hidden sm:flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-md border mr-3 flex-shrink-0 transition-all duration-300",
                meta?.bg,
                meta?.color,
              )}
              data-testid="detection-badge"
            >
              {detection.label}
              {detection.chain && (
                <span className="opacity-60">· {detection.chain}</span>
              )}
            </div>
          )}

          {/* Analyze button */}
          <Button
            type="submit"
            disabled={isLoading || !value.trim()}
            data-testid="button-analyze"
            className="m-1.5 h-10 px-6 font-mono tracking-widest text-xs rounded-lg flex-shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                SCANNING
              </>
            ) : (
              "ANALYZE"
            )}
          </Button>
        </div>
      </form>

      {/* ── Examples ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/60">
        <span className="font-mono">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            data-testid={`example-${ex}`}
            onClick={() => handleExample(ex)}
            className="font-mono px-2 py-0.5 rounded border border-border/30 hover:border-primary/40 hover:text-primary transition-colors duration-150 truncate max-w-[180px]"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
