import { useState, useRef, useEffect, useCallback } from "react";
import { useSearch } from "wouter";
import { 
  useListAnthropicConversations, 
  useCreateAnthropicConversation, 
  useDeleteAnthropicConversation,
  useListAnthropicMessages,
  getListAnthropicConversationsQueryKey,
  getListAnthropicMessagesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ConversationList } from "@/components/chat/conversation-list";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import {
  TerminalSquare, Loader2, Cpu, Send, User, Bot,
  X, Zap, AlertCircle,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Scan Context Types ───────────────────────────────────────────────────────

interface ScanContextPayload {
  context: string;
  target: string;
  type?: string;
  timestamp: number;
}

interface ContextMessage { role: "user" | "assistant"; content: string }

function loadScanContext(): ScanContextPayload | null {
  try {
    const raw = localStorage.getItem("alphascout_copilot_ctx");
    if (!raw) return null;
    const payload = JSON.parse(raw) as ScanContextPayload;
    // Expire after 30 minutes
    if (Date.now() - payload.timestamp > 30 * 60 * 1000) {
      localStorage.removeItem("alphascout_copilot_ctx");
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function sendContextChat(message: string, context: string, history: ContextMessage[]): Promise<string> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/analyze/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context, history }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Request failed");
  }
  const data = await r.json() as { reply: string };
  return data.reply;
}

// ─── Context Chat Panel ───────────────────────────────────────────────────────

function formatMessage(content: string): React.ReactNode {
  return content.split("\n").map((line, i) => {
    if (line.startsWith("• ") || line.startsWith("- ")) {
      return (
        <div key={i} className="flex gap-1.5 mt-0.5">
          <span className="text-primary opacity-70 mt-0.5 flex-shrink-0">▹</span>
          <span>{line.slice(2)}</span>
        </div>
      );
    }
    if (line === "") return <br key={i} />;
    return <p key={i} className="leading-relaxed">{line}</p>;
  });
}

function ContextChatPanel({ payload, onDismiss }: { payload: ScanContextPayload; onDismiss: () => void }) {
  const [messages, setMessages] = useState<ContextMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput(""); setError(null);
    const updated: ContextMessage[] = [...messages, { role: "user" as const, content: msg }];
    setMessages(updated);
    setLoading(true);
    try {
      const reply = await sendContextChat(msg, payload.context, messages);
      setMessages([...updated, { role: "assistant" as const, content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [messages, loading, payload.context]);

  const QUICK = [
    "Summarize the key risks",
    "Is this safe to interact with?",
    "What does the risk score mean?",
    "What should I watch out for?",
    "Explain the security flags",
  ];

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Context badge header */}
      <div className="px-4 py-3 border-b border-border/30 bg-primary/5 flex items-center gap-3 flex-shrink-0">
        <Zap className="h-3.5 w-3.5 text-primary flex-shrink-0 animate-pulse" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-primary font-semibold tracking-wide">SCAN CONTEXT LOADED</p>
          <p className="text-[10px] font-mono text-muted-foreground truncate">
            {payload.type ? `[${payload.type.toUpperCase()}] ` : ""}{payload.target}
          </p>
        </div>
        <button onClick={onDismiss}
          className="p-1 rounded hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          title="Dismiss context and switch to conversations">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Quick prompts */}
      {messages.length === 0 && (
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-2">Quick questions</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button key={q} onClick={() => send(q)} disabled={loading}
                className="text-[11px] font-mono px-2.5 py-1.5 rounded-full border border-primary/20 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center pt-8">
              <Cpu className="h-10 w-10 mx-auto mb-3 text-primary/20" />
              <p className="text-xs font-mono text-muted-foreground/40 uppercase tracking-widest">
                Ask anything about this scan
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-2 text-sm", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (
                <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0 h-7 w-7 flex items-center justify-center mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div className={cn("rounded-xl px-3 py-2.5 max-w-[88%] leading-relaxed text-sm",
                m.role === "user"
                  ? "bg-primary/10 border border-primary/20 text-foreground"
                  : "bg-card border border-border/40 text-foreground")}>
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
          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive font-mono px-1">
              <AlertCircle className="h-3.5 w-3.5" />{error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-border/20 mt-auto">
        <div className="flex gap-2">
          <input ref={inputRef}
            type="text" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void send(input)}
            placeholder={`Ask about ${payload.target.length > 22 ? payload.target.slice(0, 18) + "…" : payload.target}…`}
            disabled={loading}
            className="flex-1 bg-card/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 disabled:opacity-50"
          />
          <Button size="sm" onClick={() => void send(input)} disabled={!input.trim() || loading} className="px-3 flex-shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/30 font-mono text-center mt-2">
          Context expires in 30 min · powered by AlphaScout AI
        </p>
      </div>
    </div>
  );
}

// ─── Main Chat Page ───────────────────────────────────────────────────────────

export function Chat() {
  const queryClient = useQueryClient();
  const search = useSearch();
  const [activeId, setActiveId] = useState<number | null>(null);

  // Scan context from localStorage (set by AICopilotPanel "Open in Chat")
  const [scanContext, setScanContext] = useState<ScanContextPayload | null>(() => {
    // Only activate context mode when arriving from the copilot panel
    const params = new URLSearchParams(search);
    if (params.has("ctx")) return loadScanContext();
    return null;
  });

  // On first render, auto-activate context if it was just set (within last 5s)
  useEffect(() => {
    const payload = loadScanContext();
    if (payload && Date.now() - payload.timestamp < 5000) {
      setScanContext(payload);
    }
  }, []);

  const dismissContext = () => {
    setScanContext(null);
    localStorage.removeItem("alphascout_copilot_ctx");
  };

  // Streaming state
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: conversations = [], isLoading: isLoadingConvs } = useListAnthropicConversations({
    query: { queryKey: getListAnthropicConversationsQueryKey() }
  });

  const { data: messages = [], isLoading: isLoadingMessages } = useListAnthropicMessages(
    activeId!,
    { query: { enabled: !!activeId, queryKey: getListAnthropicMessagesQueryKey(activeId!) } }
  );

  // Mutations
  const createConv = useCreateAnthropicConversation();
  const deleteConv = useDeleteAnthropicConversation();

  // Auto-select first conversation
  useEffect(() => {
    if (conversations.length > 0 && !activeId) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      const scrollArea = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [messages, streamingText, optimisticUserMessage]);

  const handleCreateNew = () => {
    createConv.mutate({ data: { title: "New Comm Link" } }, {
      onSuccess: (newConv) => {
        queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
        setActiveId(newConv.id);
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteConv.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
        if (activeId === id) {
          setActiveId(null);
        }
      }
    });
  };

  const handleSendMessage = async (content: string) => {
    if (!activeId) return;

    setOptimisticUserMessage(content);
    setIsStreaming(true);
    setStreamingText("");

    try {
      const res = await fetch(`/api/anthropic/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
        
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.done) {
              break;
            }
            if (json.content) {
              setStreamingText((prev) => prev + json.content);
            }
          } catch (e) {
            // ignore parse errors for partial chunks
          }
        }
      }
    } catch (error) {
      console.error("Stream failed:", error);
    } finally {
      setIsStreaming(false);
      setOptimisticUserMessage(null);
      setStreamingText("");
      queryClient.invalidateQueries({ queryKey: getListAnthropicMessagesQueryKey(activeId) });
    }
  };

  // Context mode: full-screen stateless chat with scan context
  if (scanContext) {
    return (
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Sidebar: conversation list, dimmed in context mode */}
        <div className="w-72 shrink-0 hidden md:flex flex-col opacity-40 pointer-events-none select-none">
          <div className="p-4 border-r border-border/30 h-full bg-muted/5">
            <p className="text-xs font-mono text-muted-foreground/50 text-center mt-8">
              Switch to conversations →
            </p>
          </div>
        </div>
        {/* Context chat */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <ContextChatPanel payload={scanContext} onDismiss={dismissContext} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 shrink-0 hidden md:block">
        <ConversationList 
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
          onCreateNew={handleCreateNew}
          onDelete={handleDelete}
          isCreating={createConv.isPending}
          isDeleting={deleteConv.isPending ? deleteConv.variables?.id || null : null}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/50 p-8 text-center">
            <TerminalSquare className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-mono uppercase tracking-widest mb-6 text-sm">No Comm Link Active</p>
            <Button onClick={handleCreateNew} disabled={createConv.isPending} className="font-mono">
              {createConv.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              INITIALIZE CONNECTION
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1" ref={scrollRef}>
              <div className="pb-10 pt-4">
                {isLoadingMessages ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {messages.length === 0 && !optimisticUserMessage && (
                      <div className="flex flex-col items-center justify-center text-muted-foreground/50 p-20 text-center">
                        <TerminalSquare className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-mono uppercase tracking-widest text-xs">Awaiting Command Input</p>
                      </div>
                    )}
                    
                    {messages.map((msg) => (
                      <MessageBubble key={msg.id} message={msg} />
                    ))}

                    {/* Optimistic User Message */}
                    {optimisticUserMessage && (
                      <MessageBubble message={{ role: "user", content: optimisticUserMessage }} />
                    )}

                    {/* Streaming Assistant Message */}
                    {(isStreaming || streamingText) && (
                      <MessageBubble 
                        message={{ role: "assistant", content: streamingText }} 
                        isStreaming={isStreaming} 
                      />
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
            
            <ChatInput 
              onSend={handleSendMessage} 
              disabled={isStreaming || isLoadingMessages} 
            />
          </>
        )}
      </div>
    </div>
  );
}
