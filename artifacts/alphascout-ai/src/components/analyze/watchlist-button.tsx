import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { watchlistStore, type WatchlistItemType } from "@/lib/watchlist-store";
import { cn } from "@/lib/utils";

interface Props {
  target: string;
  type: WatchlistItemType;
  chain: string | null;
  riskScore: number | null;
}

export function WatchlistButton({ target, type, chain, riskScore }: Props) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(watchlistStore.has(target, type));
  }, [target, type]);

  const toggle = () => {
    if (saved) {
      const items = watchlistStore.getAll();
      const found = items.find(
        (i) => i.target.toLowerCase() === target.toLowerCase() && i.type === type
      );
      if (found) watchlistStore.remove(found.id);
      setSaved(false);
    } else {
      watchlistStore.add({
        target,
        type,
        chain,
        label: null,
        lastRiskScore: riskScore,
        lastScannedAt: new Date().toISOString(),
      });
      setSaved(true);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      className={cn(
        "gap-1.5 text-xs font-mono h-7 transition-colors",
        saved
          ? "border-yellow-400/40 text-yellow-400 hover:border-yellow-400/70 hover:bg-yellow-400/5"
          : "border-border/40 hover:border-primary/40"
      )}
      title={saved ? "Remove from watchlist" : "Add to watchlist"}
    >
      <Star className={cn("h-3 w-3", saved && "fill-yellow-400")} />
      <span className="hidden sm:inline">{saved ? "Watching" : "Watch"}</span>
    </Button>
  );
}
