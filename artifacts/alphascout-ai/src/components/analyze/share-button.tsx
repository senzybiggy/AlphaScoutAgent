import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check, Copy, Loader2, X } from "lucide-react";
import type { RichAnalyzeResult } from "@/lib/scan-types";

interface Props {
  result: RichAnalyzeResult;
}

async function createShare(result: RichAnalyzeResult): Promise<string> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result }),
  });
  if (!r.ok) throw new Error("Failed to create share link");
  const data = await r.json() as { token: string };
  const origin = window.location.origin;
  const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${origin}${basePath}/share/${data.token}`;
}

export function ShareButton({ result }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "copied">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async () => {
    setState("loading");
    setError(null);
    try {
      const shareUrl = await createShare(result);
      setUrl(shareUrl);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setState("idle");
    }
  };

  const handleCopy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setState("copied");
      setTimeout(() => setState("done"), 2000);
    });
  };

  if (state === "done" || state === "copied") {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 bg-card/70 border border-border/40 rounded-lg px-2 py-1 text-[10px] font-mono text-muted-foreground max-w-[200px] truncate">
          {url}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs font-mono h-7 border-border/40 hover:border-success/40"
          onClick={handleCopy}
        >
          {state === "copied" ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {state === "copied" ? "Copied!" : "Copy"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground"
          onClick={() => { setState("idle"); setUrl(null); }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs font-mono h-7 border-border/40 hover:border-primary/40"
        onClick={handleShare}
        disabled={state === "loading"}
      >
        {state === "loading"
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <Share2 className="h-3 w-3" />
        }
        Share
      </Button>
      {error && <p className="text-[10px] text-destructive font-mono">{error}</p>}
    </div>
  );
}
