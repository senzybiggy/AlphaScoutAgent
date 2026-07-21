import { useState, useRef, useEffect } from "react";
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
import { TerminalSquare, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

export function Chat() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  
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
        {/* Mobile header (sidebar toggle placeholder, could add sheet here) */}
        
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
