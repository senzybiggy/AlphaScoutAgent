import { useState, useEffect, useRef } from "react";
import { Cpu, X, Send, Loader2, Bot, User, Zap, ChevronDown, MessageSquare, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { scanContextStore, type ScanContext } from "@/lib/scan-context-store";
import { Button } from "@/components/ui/button";

interface Message { role: "user" | "assistant"; content: string }

const QUICK_PROMPTS_CONTEXT = [
  "Explain this in simple terms",
  "Is this safe to interact with?",
  "What are the biggest risks?",
  "Give me an investment summary",
  "Summarize in one paragraph",
  "What should I watch closely?",
];
const QUICK_PROMPTS_GENERAL = [
  "How do I detect a honeypot?",
  "What makes a wallet 'smart money'?",
  "How do I read rug pull signals?",
  "What DeFi risks should I know?",
];

async function sendChat(
  message: string,
  context: string | null,
  history: Message[],
): Promise<string> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/analyze/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context: context ?? undefined, history }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: "Request failed" }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  const data = (await r.json()) as { reply: string };
  return data.reply;
}

function formatMsg(content: string): React.ReactNode {
  return content.split("\n").map((line, i) => {
    if (line.startsWith("• ") || line.startsWith("- ")) {
      return (
        <div key={i} className="flex gap-1.5 mt-0.5">
          <span className="text-primary/70 flex-shrink-0 mt-px">▹</span>
          <span>{line.slice(2)}</span>
        </div>
      );
    }
    if (line === "") return <br key={i} />;
    return <p key={i} className="leading-relaxed">{line}</p>;
  });
}

export function FloatingCopilot() {
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<ScanContext | null>(() => scanContextStore.get());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => scanContextStore.subscribe(setCtx), []);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 120);
    }
  }, [open, messages.length]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput("");
    setError(null);
    const updated: Message[] = [...messages, { role: "user" as const, content: msg }];
    setMessages(updated);
    setLoading(true);
    try {
      const reply = await sendChat(msg, ctx?.context ?? null, messages);
      setMessages([...updated, { role: "assistant" as const, content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const hasContext = ctx !== null;
  const msgCount = Math.ceil(messages.length / 2);
  const quickPrompts = hasContext ? QUICK_PROMPTS_CONTEXT : QUICK_PROMPTS_GENERAL;
  const shortTarget = hasContext
    ? ctx.target.length > 20
      ? `${ctx.target.slice(0, 8)}…${ctx.target.slice(-6)}`
      : ctx.target
    : "";

  return (
    <>
      {/* ── Floating trigger button ── */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-3",
          "bg-primary text-primary-foreground font-mono text-xs font-bold shadow-lg",
          "border border-primary/80 hover:bg-primary/90 hover:shadow-primary/30 hover:shadow-xl",
          "transition-all duration-200",
          open && "opacity-0 pointer-events-none scale-90",
        )}
        aria-label="Open AI Copilot"
      >
        <Cpu className="h-4 w-4" />
        <span className="hidden sm:inline">AI COPILOT</span>
        {hasContext && (
          <span
            className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-success border-2 border-background"
            title="Scan context loaded"
          />
        )}
        {msgCount > 0 && (
          <span className="ml-0.5 bg-primary-foreground/20 rounded-full text-[10px] px-1.5 py-0.5">
            {msgCount}
          </span>
        )}
      </button>

      {/* ── Panel ── */}
      <div
        className={cn(
          "fixed z-50 flex flex-col bg-card border border-border/60 shadow-2xl shadow-black/50",
          // Mobile: full-width sheet from bottom
          "bottom-0 left-0 right-0 rounded-t-2xl max-h-[85vh]",
          // Desktop: floating card
          "sm:bottom-6 sm:right-6 sm:left-auto sm:w-[420px] sm:rounded-2xl",
          "transition-all duration-300",
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 flex-shrink-0">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Cpu className="h-4 w-4 text-primary animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold font-mono">AI COPILOT</p>
            {hasContext ? (
              <p className="text-[10px] font-mono text-success flex items-center gap-1 truncate">
                <Zap className="h-2.5 w-2.5 flex-shrink-0" />
                {ctx!.type.toUpperCase()} — {shortTarget}
              </p>
            ) : (
              <p className="text-[10px] font-mono text-muted-foreground">
                General blockchain assistant
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setError(null); }}
                className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-destructive transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.length === 0 && (
            <div className="space-y-3 pt-1">
              {hasContext && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/5 border border-success/20 text-xs font-mono text-success">
                  <Zap className="h-3 w-3 flex-shrink-0" />
                  Scan context loaded · ask anything about it
                </div>
              )}
              <p className="text-[11px] font-mono text-muted-foreground/50 text-center">
                {hasContext ? "Quick questions:" : "Try asking:"}
              </p>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    disabled={loading}
                    className="text-xs font-mono px-2.5 py-1.5 rounded-full border border-primary/20 hover:border-primary/60 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2 text-sm",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {m.role === "assistant" && (
                <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0 h-7 w-7 flex items-center justify-center mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "rounded-xl px-3 py-2.5 max-w-[85%] text-xs leading-relaxed",
                  m.role === "user"
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-card/80 border border-border/40",
                )}
              >
                {m.role === "assistant" ? formatMsg(m.content) : m.content}
              </div>
              {m.role === "user" && (
                <div className="p-1.5 bg-muted/30 rounded-lg flex-shrink-0 h-7 w-7 flex items-center justify-center mt-0.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-2 items-center">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex gap-1 items-center px-3 py-2 bg-card border border-border/40 rounded-xl">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="animate-bounce text-primary text-xs"
                    style={{ animationDelay: `${delay}ms` }}
                  >
                    ●
                  </span>
                ))}
              </div>
            </div>
          )}
          {error && (
            <p className="text-xs text-destructive font-mono px-1">{error}</p>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border/30 flex-shrink-0 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
            placeholder={
              hasContext
                ? `Ask about ${shortTarget}…`
                : "Ask anything about blockchain…"
            }
            disabled={loading}
            className="flex-1 bg-background border border-border/50 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 disabled:opacity-50"
          />
          <Button
            size="sm"
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="px-3 flex-shrink-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
