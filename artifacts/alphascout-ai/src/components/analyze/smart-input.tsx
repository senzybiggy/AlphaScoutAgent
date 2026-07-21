import { useState, useEffect } from "react";
import { Search, Loader2, Wallet, Coins, FileCode2, Globe, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { detectInputType, DetectionResult } from "@/lib/detect-input-type";
import { cn } from "@/lib/utils";

interface SmartInputProps {
  onSubmit: (value: string, detection: DetectionResult) => void;
  isLoading: boolean;
}

const TYPE_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  wallet:   { icon: Wallet,    color: "text-primary",       bg: "bg-primary/10 border-primary/30" },
  token:    { icon: Coins,     color: "text-yellow-400",    bg: "bg-yellow-400/10 border-yellow-400/30" },
  contract: { icon: FileCode2, color: "text-emerald-400",   bg: "bg-emerald-400/10 border-emerald-400/30" },
  project:  { icon: Globe,     color: "text-purple-400",    bg: "bg-purple-400/10 border-purple-400/30" },
  unknown:  { icon: HelpCircle, color: "text-muted-foreground", bg: "bg-muted/30 border-border/30" },
};

const EXAMPLES = [
  "0x742d35Cc6634C0532925a3b844Bc9e7595f6E123",
  "vitalik.eth",
  "uniswap.org",
  "Aave",
];

export function SmartInput({ onSubmit, isLoading }: SmartInputProps) {
  const [value, setValue] = useState("");
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (value.trim().length > 2) {
      setDetection(detectInputType(value));
    } else {
      setDetection(null);
    }
  }, [value]);

  const meta = detection ? TYPE_META[detection.type] : null;
  const Icon = meta?.icon ?? Search;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isLoading) return;
    const det = detectInputType(value.trim());
    onSubmit(value.trim(), det);
  };

  const handleExample = (example: string) => {
    setValue(example);
  };

  return (
    <div className="space-y-4">
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
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Paste a wallet address, token contract, smart contract, or project URL..."
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

      {/* Examples row */}
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
