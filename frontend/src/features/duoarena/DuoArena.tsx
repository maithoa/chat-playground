import React, { useState, useRef, useEffect } from "react";
import { StreamWindow } from "@/components/Module/StreamWindow";
import { streamChat } from "@/services/llmService";
import type { Message } from "@/types/chat";

export function DuoArena() {
  //ui state
  const [messagesA, setMessagesA] = useState<Message[]>([]);
  const [messagesB, setMessagesB] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGeneratingA, setIsGeneratingA] = useState(false);
  const [isGeneratingB, setIsGeneratingB] = useState(false);

  // refs
  const abortControllerRefA = useRef<AbortController | null>(null);
  const abortControllerRefB = useRef<AbortController | null>(null);

  const streamingBufferRefA = useRef<string>("");
  const streamingBufferRefB = useRef<string>("");

  const timerRefA = useRef<number | null>(null);
  const timerRefB = useRef<number | null>(null);

  const textInputAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // const sendButtonWrapRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const el = textInputAreaRef.current;
    if (!el) return;

    // Reset the height to auto shrink or expand if needed
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  const FLUSH_INTERVAL_MS = 120;

  // function to flush buffer - take params A or B to decide which colume to flush
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
    streamId: string,
    userPrompt: string
  ) => {
    // form the message object and update the messages state
    const userMessage: Message = { role: "user", content: userPrompt };

    try {
      if (streamId === "A") {
        // Processing for Stream A
        const updatedMessagesA = [...messagesA, userMessage];

        //add empty assistant message to the state of Stream A to prepare for streaming
        setMessagesA([...updatedMessagesA, { role: "assistant", content: "" }]);
        setIsGeneratingA(true);

        abortControllerRefA.current = new AbortController();

        streamingBufferRefA.current = "";

        // 👉 Use same flushBuffer
        timerRefA.current = window.setInterval(() => {
          flushBuffer(setMessagesA, streamingBufferRefA);
        }, FLUSH_INTERVAL_MS);

        try {
          await streamChat({
            provider: providerId,
            model: modelId,
            messages: updatedMessagesA,
            signal: abortControllerRefA.current.signal,
            outChunk: (chunk) => {
              // only add chunk to buffer
              streamingBufferRefA.current += chunk;
            },
            onUsageComplete: (usage) => {
              // flush last part of the chunks
              flushBuffer(setMessagesA, streamingBufferRefA);

              setMessagesA((prev) => {
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
            setMessagesA((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant" && last.content === "") {
                return prev.slice(0, -1);
              }
              return prev;
            });
            alert(`Error: ${error.message}`);
          }
        } finally {
          if (timerRefA.current) {
            clearInterval(timerRefA.current);
            timerRefA.current = null;
          }
          // Clear buffer
          flushBuffer(setMessagesA, streamingBufferRefA);
          streamingBufferRefA.current = "";

          setIsGeneratingA(false);
          abortControllerRefA.current = null;
        }
      } else if (streamId === "B") {
        // Processing for Stream B
        const updatedMessagesB = [...messagesB, userMessage];
        setMessagesB([...updatedMessagesB, { role: "assistant", content: "" }]);
        setIsGeneratingB(true);

        abortControllerRefB.current = new AbortController();

        streamingBufferRefB.current = "";

        // 👉 Use same flushBuffer
        timerRefB.current = window.setInterval(() => {
          flushBuffer(setMessagesB, streamingBufferRefB);
        }, FLUSH_INTERVAL_MS);

        try {
          await streamChat({
            provider: providerId,
            model: modelId,
            messages: updatedMessagesB,
            signal: abortControllerRefB.current.signal,
            outChunk: (chunk) => {
              // only add chunk to buffer
              streamingBufferRefB.current += chunk;
            },
            onUsageComplete: (usage) => {
              // flush last part of the chunks
              flushBuffer(setMessagesB, streamingBufferRefB);

              setMessagesB((prev) => {
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
            setMessagesB((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant" && last.content === "") {
                return prev.slice(0, -1);
              }
              return prev;
            });
            alert(`Error: ${error.message}`);
          }
        } finally {
          if (timerRefB.current) {
            clearInterval(timerRefB.current);
            timerRefB.current = null;
          }
          // Clear buffer
          flushBuffer(setMessagesB, streamingBufferRefB);
          streamingBufferRefB.current = "";

          setIsGeneratingB(false);
          abortControllerRefB.current = null;
        }
      } else {
        alert(`Error: Stream is not A or B`);
      }
    } catch (er: any) {
      alert(`Error: ${er.message}`);
    } finally {
      setInput("");
    }
  };

  // Handle Arena run
  const handleRunBoth = () => {
    if (!input.trim() || isGeneratingA || isGeneratingB) return;
    const currentPrompt = input;
    setInput(""); // Reset input 1 lần duy nhất

    // Gọi kích hoạt cả 2 stream đồng thời
    executeStream("groq", "openai/gpt-oss-120b", "A", currentPrompt);
    executeStream("openrouter", "openrouter/free", "B", currentPrompt);
  };
  // Generate UI
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full max-w-7xl p-4 overflow-hidden gap-3">
      {/* 2 Cột StreamWindow đặt song song */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0 h-full">
          <div className="text-xs font-semibold text-gray-500 mb-1 px-1">Model A</div>
          <StreamWindow
            messages={messagesA}
            isGenerating={isGeneratingA}
            onStop={() => abortControllerRefA.current?.abort()}
          />
        </div>
        <div className="flex flex-col flex-1 min-w-0 h-full">
          <div className="text-xs font-semibold text-gray-500 mb-1 px-1">Model B</div>
          <StreamWindow
            messages={messagesB}
            isGenerating={isGeneratingB}
            onStop={() => abortControllerRefB.current?.abort()}
          />
        </div>
      </div>

      {/* Shared Input Area */}
      <div className="flex-shrink-0 pt-2">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-2">
          <div className="border border-gray-300 rounded-2xl p-3 focus-within:ring-2 focus-within:ring-blue-500 bg-white shadow-sm flex flex-col">
            <textarea
              ref={textInputAreaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message for both models..."
              className="w-full border-0 focus:outline-none p-0 text-sm resize-none max-h-32 bg-transparent"
              rows={2}
              disabled={isGeneratingA || isGeneratingB}
            />
          </div>
        </form>
        <div className="flex justify-end pt-2 mt-1 border-t border-gray-100">
          {/* Handle simultaneous calls to 2 models */}
          <button
            onClick={handleRunBoth}

            disabled={isGeneratingA || isGeneratingB || !input.trim()}
          >
            Run
          </button>
        </div>
      </div>
    </div>
  );
}
