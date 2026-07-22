import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cpu, Send, Loader2, User, Bot, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message { role: "user" | "assistant"; content: string }

interface Props {
  context: string; // JSON-stringified scan result
  target: string;
}

const QUICK_PROMPTS = [
  "Summarize this in simple terms",
  "What are the biggest risks?",
  "Would I interact with this?",
  "What should I watch closely?",
  "Explain the risk score",
  "What tokens worry you?",
];

async function sendChatMessage(message: string, context: string, history: Message[]): Promise<string> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/analyze/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context, history }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: "Request failed" }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  const data = await r.json() as { reply: string };
  return data.reply;
}

function formatMessage(content: string): React.ReactNode {
  // Simple markdown-like rendering: bold, bullet lists
  const lines = content.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("• ") || line.startsWith("- ")) {
      return (
        <div key={i} className="flex gap-1.5 mt-0.5">
          <span className="text-primary opacity-70 mt-0.5 flex-shrink-0">▹</span>
          <span>{line.slice(2)}</span>
        </div>
      );
    }
    if (line.startsWith("**") && line.endsWith("**")) {
      return <p key={i} className="font-semibold mt-1">{line.slice(2, -2)}</p>;
    }
    if (line === "") return <br key={i} />;
    return <p key={i} className="leading-relaxed">{line}</p>;
  });
}

export function AICopilotPanel({ context, target }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput("");
    setError(null);
    const updatedMessages: Message[] = [...messages, { role: "user" as const, content: msg }];
    setMessages(updatedMessages);
    setLoading(true);
    try {
      // Pass full conversation history for multi-turn context
      const reply = await sendChatMessage(msg, context, messages);
      setMessages([...updatedMessages, { role: "assistant", content: reply }]);
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
          <span className="ml-auto flex items-center gap-2 text-muted-foreground">
            {messages.length > 0 && (
              <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {Math.ceil(messages.length / 2)} msg{Math.ceil(messages.length / 2) !== 1 ? "s" : ""}
              </span>
            )}
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
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1 scroll-smooth">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex gap-2 text-sm", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "assistant" && (
                    <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0 h-7 w-7 flex items-center justify-center mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div className={cn("rounded-xl px-3 py-2.5 max-w-[88%] leading-relaxed",
                    m.role === "user"
                      ? "bg-primary/10 border border-primary/20 text-foreground"
                      : "bg-card border border-border/40 text-foreground"
                  )}>
                    {m.role === "assistant" ? formatMessage(m.content) : m.content}
                  </div>
                  {m.role === "user" && (
                    <div className="p-1.5 bg-muted/30 rounded-lg flex-shrink-0 h-7 w-7 flex items-center justify-center mt-0.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-2 items-center text-sm text-muted-foreground">
                  <div className="p-1.5 bg-primary/10 rounded-lg"><Bot className="h-3.5 w-3.5 text-primary" /></div>
                  <div className="flex gap-1 items-center px-3 py-2 bg-card border border-border/40 rounded-xl">
                    <span className="animate-bounce text-primary" style={{ animationDelay: "0ms" }}>●</span>
                    <span className="animate-bounce text-primary" style={{ animationDelay: "150ms" }}>●</span>
                    <span className="animate-bounce text-primary" style={{ animationDelay: "300ms" }}>●</span>
                  </div>
                </div>
              )}
              {error && <p className="text-xs text-destructive font-mono px-1">{error}</p>}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Input row */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
              placeholder={`Ask about ${target.length > 24 ? target.slice(0, 20) + "…" : target}…`}
              disabled={loading}
              className="flex-1 bg-card/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 disabled:opacity-50"
            />
            <Button size="sm" onClick={() => send(input)} disabled={!input.trim() || loading} className="px-3 flex-shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
            {messages.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setMessages([]); setError(null); }}
                className="px-2 text-muted-foreground hover:text-destructive flex-shrink-0"
                title="Clear conversation"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/40 font-mono text-center">
            Copilot remembers this scan's context throughout the conversation.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
