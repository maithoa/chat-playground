import React, { useState, useRef, useEffect } from "react";
import { StreamWindow } from "@/components/Module/StreamWindow";
import { streamChat } from "@/services/llmService";
import type { Message } from "@/types/chat";
import { ErrorMessage } from "@/components/ErrorMessage";

export function DuoArena() {
  //ui state
  const [messagesA, setMessagesA] = useState<Message[]>([]);
  const [messagesB, setMessagesB] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGeneratingA, setIsGeneratingA] = useState(false);
  const [isGeneratingB, setIsGeneratingB] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      // Processing for Stream A
      const updatedMessages = [...messages, userMessage];

      //add empty assistant message to the state of Stream A to prepare for streaming
      setMessages([...updatedMessages, { role: "assistant", content: "" }]);
      setIsGenerating(true);

      abortControllerRef.current = new AbortController();

      streamingBufferRef.current = "";

      // 👉 Use same flushBuffer
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
            // only add chunk to buffer
            streamingBufferRef.current += chunk;
          },
          onUsageComplete: (usage) => {
            // flush last part of the chunks
            flushBuffer(setMessages, streamingBufferRef);

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
        // Clear buffer
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
    setInput(""); // Reset input 1 lần duy nhất

    // Gọi kích hoạt cả 2 stream đồng thời
    executeStream("groq", "openai/gpt-oss-120b", "A", currentPrompt);
    executeStream("openrouter", "openrouter/free", "B", currentPrompt);
  };
  // Handle Keydown for Enter to hit Run button
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!(isGeneratingA && isGeneratingB && input.trim())) {
        // Find the Run button and click it
        buttonRunRef.current?.click();
      }
    }
  };

  // Generate UI
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full max-w-7xl p-4 overflow-hidden gap-3">
      {/* 2 Paralell streaming windows */}
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
      <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />
      {/* Shared Input Area */}
      <div className="flex-shrink-0 pt-2">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-2">
          <div className="border border-gray-300 rounded-2xl p-3 focus-within:ring-2 focus-within:ring-blue-500 bg-white shadow-sm flex flex-col">
            <textarea
              ref={textInputAreaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
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
            ref={buttonRunRef}
            className={`px-4 py-2 rounded text-xs font-medium transition-colors ${
              isGeneratingA || isGeneratingB || !input.trim()
                ? "bg-gray-100 text-gray-400 cursor-not-allowed select-none"
                : "bg-blue-500 text-white hover:bg-blue-600 cursor-pointer"
            }`}
          >
            Run
          </button>
        </div>
      </div>
    </div>
  );
}
