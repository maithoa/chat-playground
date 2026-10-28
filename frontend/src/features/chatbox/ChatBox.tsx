import { useState, useRef, useEffect } from "react";
import { streamChat } from "@/services/llmService";
import type { Message } from "@/types/chat";
import { SendMsgToModel } from "@/components/Button/SendMsgToModel/SendMsgToModel";
import { StreamWindow } from "@/components/Module/StreamWindow";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useUsageContext } from "@/context/UsageContext";

export function ChatBox() {
  // ui state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const userUsageContext = useUsageContext();

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
        onUsageComplete: async (usage) => {
          // flush last part of the chunks
          flushBuffer();

          // set refresh trigger so that token daily usage progress bar is refreshed
          await userUsageContext.refreshUsage();

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
    <div className="flex flex-col h-full w-full px-6 py-4 overflow-hidden relative z-10">
      {/* Stream Window với viền & bóng chìm Slate */}
      <StreamWindow messages={messages} isGenerating={isGenerating} onStop={handleStop} />

      {/* Error message */}
      <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />

      {/* Input & Action Area Container */}
      <div className="flex-shrink-0 pt-3">
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="relative group rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 p-3 shadow-2xl transition-all duration-300 focus-within:border-sky-500/50 focus-within:ring-1 focus-within:ring-sky-500/30 hover:border-slate-700/80">
            {/* Top highlight gradient line */}
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-sky-500/30 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything... (Press Enter to send, Shift + Enter for new line)"
              className="w-full bg-transparent border-0 focus:outline-none focus:ring-0 p-1 text-sm leading-relaxed resize-none max-h-48 block text-slate-100 placeholder:text-slate-500/80 placeholder:font-light selection:bg-sky-500/30"
              rows={2}
              disabled={isGenerating}
            />

            <div
              ref={sendWrapperRef}
              className="flex justify-between items-center pt-2.5 mt-1 border-t border-slate-800/60"
            >
              {/* Shortcut Hints */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 select-none">
                <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 font-mono text-slate-400">
                  Enter
                </span>
                <span>Send</span>
                <span className="mx-1 text-slate-700">•</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 font-mono text-slate-400">
                  Shift + Enter
                </span>
                <span>New line</span>
              </div>

              {/* Action Button */}
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
