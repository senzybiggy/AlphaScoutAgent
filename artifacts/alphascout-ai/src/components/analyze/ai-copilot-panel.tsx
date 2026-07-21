import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cpu, Send, Loader2, User, Bot, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message { role: "user" | "assistant"; content: string }

interface Props {
  context: string; // JSON-stringified scan result
  target: string;
}

const QUICK_PROMPTS = [
  "Summarize this in simple terms",
  "What are the biggest risks?",
  "What should I watch closely?",
  "Is this safe to interact with?",
  "What does the activity pattern suggest?",
];

async function sendChatMessage(message: string, context: string): Promise<string> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/analyze/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: "Request failed" }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  const data = await r.json() as { reply: string };
  return data.reply;
}

export function AICopilotPanel({ context, target }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const reply = await sendChatMessage(msg, context);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card/50 border-primary/20 scanline">
      <CardHeader
        className="pb-3 border-b border-border/20 cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary animate-pulse" />
          AI COPILOT — Ask anything about this scan
          <span className="ml-auto text-muted-foreground">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </CardTitle>
      </CardHeader>

      {open && (
        <CardContent className="pt-4 space-y-4">
          {/* Quick prompt chips */}
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={loading}
                className="text-xs font-mono px-3 py-1.5 rounded-full border border-primary/20 hover:border-primary/60 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Messages */}
          {messages.length > 0 && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex gap-2 text-sm", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "assistant" && (
                    <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0 h-7 w-7 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div className={cn("rounded-xl px-3 py-2 max-w-[85%] leading-relaxed",
                    m.role === "user"
                      ? "bg-primary/10 border border-primary/20 text-foreground"
                      : "bg-card border border-border/40 text-foreground"
                  )}>
                    {m.content}
                  </div>
                  {m.role === "user" && (
                    <div className="p-1.5 bg-muted/30 rounded-lg flex-shrink-0 h-7 w-7 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-2 items-center text-sm text-muted-foreground">
                  <div className="p-1.5 bg-primary/10 rounded-lg"><Bot className="h-3.5 w-3.5 text-primary" /></div>
                  <div className="flex gap-1">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>●</span>
                  </div>
                </div>
              )}
              {error && <p className="text-xs text-destructive font-mono">{error}</p>}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
              placeholder={`Ask about ${target.slice(0, 20)}...`}
              disabled={loading}
              className="flex-1 bg-card/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 disabled:opacity-50"
            />
            <Button size="sm" onClick={() => send(input)} disabled={!input.trim() || loading} className="px-3">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
