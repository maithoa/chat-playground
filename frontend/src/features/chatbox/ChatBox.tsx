import { useState, useRef, useEffect } from "react";
import { streamChat } from "@/services/llmService";
import type { Message } from "@/types/chat";
import { SendMsgToModel } from "@/components/Button/SendMsgToModel/SendMsgToModel";
import { ConversationTokenCounter } from "@/components/Button/ConversationTokenCounter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Coffee } from "lucide-react";

export function ChatBox() {
  // ui state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const streamingBufferRef = useRef<string>("");
  const timerRef = useRef<number | null>(null);

  // Auto-scroll to the end when there is new token
  const scrollToBottom = () => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;

    // if is currently streaming , use auto scroll to avoid ui glitch
    // when generating is done, can use smooth
    container.scrollTo({
      top: container.scrollHeight,
      behavior: isGenerating ? "auto" : "smooth",
    });
  };
  // Ref to access button inside SendMsgToModel
  const sendWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Ref to access textarea for auto-focus
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    // Reset the height to auto to shrink if needed
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Timer to flush buffer to UI
  const FLUSH_INTERVAL_MS = 120;

  // function to flush buffer
  const flushBuffer = () => {
    if (!streamingBufferRef.current) return;

    const bufferToFlush = streamingBufferRef.current;
    streamingBufferRef.current = ""; // Reset buffer after sending it to ui

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;

      const updatedLast = { ...last, content: last.content + bufferToFlush };
      return [...prev.slice(0, -1), updatedLast];
    });
  };

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

    // streaming buffer
    streamingBufferRef.current = "";
    // timer buffer
    timerRef.current = setInterval(flushBuffer, FLUSH_INTERVAL_MS);

    try {
      await streamChat({
        provider: providerId,
        model: modelId,
        messages: updatedMessages,
        signal: abortControllerRef.current.signal,
        outChunk: (chunk) => {
          // only add chunk to buffer
          streamingBufferRef.current += chunk;
        },
        onUsageComplete: (usage) => {
          // flush last part of the chunks
          flushBuffer();

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
      // Clean up timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Clear buffer
      flushBuffer();
      streamingBufferRef.current = "";

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
        <div className="border border-gray-300 rounded-2xl p-3 focus-within:ring-2 focus-within:ring-blue-500 bg-white shadow-sm flex flex-col transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message...(Enter to Send, Shift+Enter for a new line)"
            className="w-full border-0 focus:outline-none focus:ring-0 p-0 text-sm leading-relaxed resize-none max-h-48 overflow-y-auto block bg-transparent text-gray-800 placeholder-gray-400"
            rows={2}
            disabled={isGenerating}
          />
          <div
            ref={sendWrapperRef}
            className="flex justify-end items-center pt-2 mt-1 border-t border-gray-100"
          >
            <SendMsgToModel
              disabled={isGenerating || !input.trim()}
              onSend={(provider, model) => handleSubmit(provider, model)}
            />
          </div>
        </div>
      </form>
      <div className="flex-shrink-0 space-y-2 mt-2 flex items-center justify-between gap-2">
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
