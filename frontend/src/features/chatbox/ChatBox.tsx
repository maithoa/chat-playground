import { useState, useRef, useEffect } from "react";
import { streamChat } from "@/services/llmService";
import type { Message } from "@/types/chat";
import { SendMsgToModel } from "@/components/Button/SendMsgToModel/SendMsgToModel";
import { StreamWindow } from "@/components/Module/StreamWindow";
import { ErrorMessage } from "@/components/ErrorMessage";

export function ChatBox() {
  // ui state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingBufferRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref to access button inside SendMsgToModel
  const sendWrapperRef = useRef<HTMLDivElement | null>(null);
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
      if (!last || last.role !== "assistant") {
        return [...prev, { role: "assistant", content: bufferToFlush }];
      }

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
    timerRef.current = window.setInterval(flushBuffer, FLUSH_INTERVAL_MS);

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
        setErrorMessage("Stream stopped by user.");
      } else {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.content === "") {
            return prev.slice(0, -1);
          }
          return prev;
        });
        console.log("error:", error.message);
        setErrorMessage(error.message);
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
    <div className="flex flex-col h-full w-full max-w-3xl p-4 overflow-hidden">
      <StreamWindow messages={messages} isGenerating={isGenerating} onStop={handleStop} />
      {/* Error message*/}
      <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />
      <div className="flex-shrink-0 space-y-2 pt-2">
        {/* Input & Action Area */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-2">
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
      </div>
    </div>
  );
}
