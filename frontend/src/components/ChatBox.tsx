import { useState, useRef, useEffect } from "react";
import { streamChat } from "../services/llmService";
import type { Message } from "../types/chat";
import { SendMsgToModel } from "./SendMsgToModel";
import { ConversationTokenCounter } from "./ConversationTokenCounter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Coffee } from "lucide-react";

export function ChatBox() {
  const [temperature, setTemperature] = useState(0.7);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll xuống cuối khi có token mới
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  // Ref to access button inside SendMsgToModel
  const sendWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (providerId: string, modelId: string) => {
    if (!input.trim() || isGenerating) return;

    // form the message object and update the messages state
    const userMessage: Message = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];

    // add an empty assistant message to the state to prepare for streaming
    setMessages([...updatedMessages, { role: "assistant", content: "" }]);
    setInput("");
    setIsGenerating(true);

    abortControllerRef.current = new AbortController();

    try {
      await streamChat({
        provider: providerId,
        model: modelId,
        messages: updatedMessages,
        temperature: temperature,
        signal: abortControllerRef.current.signal,
        outChunk: (chunk) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;

            const updatedLast = { ...last, content: last.content + chunk };
            return [...prev.slice(0, -1), updatedLast];
          });
        },
        onUsageComplete: (usage) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;

            return [...prev.slice(0, -1), { ...last, usage }];
          });
        },
      });
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Stream stopped by user.");
      } else {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.content === "") {
            return prev.slice(0, -1);
          }
          return prev;
        });
        alert(`Error: ${error.message}`);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Trigger submit form
      if (!isGenerating && input.trim()) {
        //Find the submit button inside SendMsgToModel and click it
        sendWrapperRef.current
          ?.querySelector<HTMLButtonElement>('button[type="submit"]')
          ?.click();
      }
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 max-w-3xl mx-auto p-4 overflow-hidden">
      {/* Messages Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded mb-4 space-y-4 flex flex-col">
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            /* 1. Outer Chat Bubble (Handles background, padding, alignment) */
            <div
              key={index}
              className={`p-4 rounded-lg max-w-[85%] ${
                isUser
                  ? "bg-blue-600 text-white self-end"
                  : "bg-gray-100 text-gray-800 self-start"
              }`}
            >
              {/* 2. Inner Typography Wrapper (Handles Markdown styling) */}
              <div
                className={`prose prose-sm max-w-none text-left ${
                  isUser ? "prose-invert" : "prose-neutral"
                }`}
              >
                {msg.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                ) : isUser ? null : (
                  <span className="flex items-center gap-1.5 text-gray-800 animate-pulse text-xs font-medium">
                    <Coffee />
                    Thinking....
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input & Action Area */}
      <form onSubmit={(e) => e.preventDefault()} className="flex-shrink-0 space-y-2">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message...(Enter to Send, Shift+Enter for a new line)"
            className="flex-1 border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            disabled={isGenerating}
          />
          <div ref={sendWrapperRef}>
            <SendMsgToModel
              disabled={isGenerating || !input.trim()}
              onSend={(provider, model) => handleSubmit(provider, model)}
            />
          </div>
        </div>
      </form>
      <div className="space-y-2 mt-2 flex items-center justify-between gap-2">
        {/* Token counter*/}
        <ConversationTokenCounter
          messages={messages}
          streamingContent={messages[messages.length - 1]?.content || ""}
          isStreaming={isGenerating}
        />
        {/* Stop button */}
        {isGenerating && (
          <button
            onClick={handleStop}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
