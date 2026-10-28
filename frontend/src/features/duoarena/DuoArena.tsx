import { useState, useRef, useEffect } from "react";
import { StreamWindow } from "@/components/Module/StreamWindow";
import { streamChat } from "@/services/llmService";
import type { Message } from "@/types/chat";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useUsageContext } from "@/context/UsageContext";

export function DuoArena() {
  // ui state
  const [messagesA, setMessagesA] = useState<Message[]>([]);
  const [messagesB, setMessagesB] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGeneratingA, setIsGeneratingA] = useState(false);
  const [isGeneratingB, setIsGeneratingB] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const userUsageContext = useUsageContext();

  // refs
  const abortControllerRefA = useRef<AbortController | null>(null);
  const abortControllerRefB = useRef<AbortController | null>(null);

  const streamingBufferRefA = useRef<string>("");
  const streamingBufferRefB = useRef<string>("");

  const timerRefA = useRef<number | null>(null);
  const timerRefB = useRef<number | null>(null);

  const textInputAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const buttonRunRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const el = textInputAreaRef.current;
    if (!el) return;

    // Reset the height to auto shrink or expand if needed
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  const FLUSH_INTERVAL_MS = 120;

  // function to flush buffer - take params A or B to decide which column to flush
  const flushBuffer = (
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    bufferRef: React.RefObject<string>
  ) => {
    if (!bufferRef.current) return;

    const bufferToFlush = bufferRef.current;
    bufferRef.current = "";

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;

      const updatedLast = { ...last, content: last.content + bufferToFlush };
      return [...prev.slice(0, -1), updatedLast];
    });
  };

  const executeStream = async (
    providerId: string,
    modelId: string,
    streamId: "A" | "B",
    userPrompt: string
  ) => {
    // setup variables based on streamId
    const isA = streamId === "A";
    const messages = isA ? messagesA : messagesB;
    const setMessages = isA ? setMessagesA : setMessagesB;
    const setIsGenerating = isA ? setIsGeneratingA : setIsGeneratingB;
    const abortControllerRef = isA ? abortControllerRefA : abortControllerRefB;
    const streamingBufferRef = isA ? streamingBufferRefA : streamingBufferRefB;
    const timerRef = isA ? timerRefA : timerRefB;

    // form the message object and update the messages state
    const userMessage: Message = { role: "user", content: userPrompt };

    try {
      const updatedMessages = [...messages, userMessage];

      setMessages([...updatedMessages, { role: "assistant", content: "" }]);
      setIsGenerating(true);

      abortControllerRef.current = new AbortController();
      streamingBufferRef.current = "";

      timerRef.current = window.setInterval(() => {
        flushBuffer(setMessages, streamingBufferRef);
      }, FLUSH_INTERVAL_MS);

      try {
        await streamChat({
          provider: providerId,
          model: modelId,
          messages: updatedMessages,
          signal: abortControllerRef.current.signal,
          outChunk: (chunk) => {
            streamingBufferRef.current += chunk;
          },
          onUsageComplete: async (usage) => {
            flushBuffer(setMessages, streamingBufferRef);
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
          console.error(`Error: ${error.message}`);
          setErrorMessage(error.message);
        }
      } finally {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        flushBuffer(setMessages, streamingBufferRef);
        streamingBufferRef.current = "";

        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    } catch (er: any) {
      console.error(`Error: ${er.message}`);
      setErrorMessage(er.message);
    } finally {
      setInput("");
    }
  };

  // Handle Arena run
  const handleRunBoth = () => {
    if (!input.trim() || isGeneratingA || isGeneratingB) return;
    const currentPrompt = input;
    setInput("");

    executeStream("groq", "openai/gpt-oss-120b", "A", currentPrompt);
    executeStream("openrouter", "openrouter/free", "B", currentPrompt);
  };

  // Handle Keydown for Enter to hit Run button
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isGeneratingA && !isGeneratingB && input.trim()) {
        buttonRunRef.current?.click();
      }
    }
  };

  return (
    // Đã bỏ max-w-7xl, thay bằng w-full px-6 để tràn viền hoàn toàn
    <div className="flex flex-col flex-1 min-h-0 w-full px-6 py-4 overflow-hidden gap-3 relative z-10">
      {/* 2 Parallel streaming windows */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
        {/* Model A Column */}
        <div className="flex flex-col flex-1 min-w-0 h-full">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase">
              Model A
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              (Groq / GPT-OSS-120B)
            </span>
          </div>
          <StreamWindow
            messages={messagesA}
            isGenerating={isGeneratingA}
            onStop={() => abortControllerRefA.current?.abort()}
          />
        </div>

        {/* Model B Column */}
        <div className="flex flex-col flex-1 min-w-0 h-full">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="h-2 w-2 rounded-full bg-indigo-400" />
            <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase">
              Model B
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              (OpenRouter / Free)
            </span>
          </div>
          <StreamWindow
            messages={messagesB}
            isGenerating={isGeneratingB}
            onStop={() => abortControllerRefB.current?.abort()}
          />
        </div>
      </div>

      <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />

      {/* Shared Input Area */}
      <div className="flex-shrink-0 pt-2">
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="relative group rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 p-3 shadow-2xl transition-all duration-300 focus-within:border-sky-500/50 focus-within:ring-1 focus-within:ring-sky-500/30 hover:border-slate-700/80">
            {/* Top highlight gradient line */}
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-sky-500/30 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <textarea
              ref={textInputAreaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a prompt to compare both models simultaneously... (Enter to Run)"
              className="w-full bg-transparent border-0 focus:outline-none focus:ring-0 p-1 text-sm leading-relaxed resize-none max-h-32 block text-slate-100 placeholder-slate-500 selection:bg-sky-500/30"
              rows={2}
              disabled={isGeneratingA || isGeneratingB}
            />

            <div className="flex justify-between items-center pt-2.5 mt-1 border-t border-slate-800/60">
              {/* Keyboard Shortcuts Hint */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 select-none">
                <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 font-mono text-slate-400">
                  Enter
                </span>
                <span>Run both</span>
                <span className="mx-1 text-slate-700">•</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 font-mono text-slate-400">
                  Shift + Enter
                </span>
                <span>New line</span>
              </div>

              {/* Run Action Button */}
              <button
                ref={buttonRunRef}
                onClick={handleRunBoth}
                disabled={isGeneratingA || isGeneratingB || !input.trim()}
                className={`relative px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  isGeneratingA || isGeneratingB || !input.trim()
                    ? "bg-slate-800/50 text-slate-600 border border-slate-800/80 cursor-not-allowed select-none shadow-none"
                    : "bg-white text-slate-900 border border-slate-300 shadow-sm hover:bg-slate-100 active:scale-[0.98] cursor-pointer"
                }`}
              >
                Run Arena
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
