import React, { useState, useRef, useEffect } from "react";
import { streamChat } from "../services/llmService";
import type { Message } from "../types/chat";

interface ChatBoxProps {
  provider: string;
  model: string;
}

export function ChatBox({provider, model}: ChatBoxProps) {
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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];

    // Cập nhật tin nhắn User và tạo khung rỗng cho Assistant
    setMessages([...updatedMessages, { role: "assistant", content: "" }]);
    setInput("");
    setIsGenerating(true);

    abortControllerRef.current = new AbortController();

    try {
      await streamChat({
        provider,
        model,
        messages: updatedMessages,
        temperature,
        signal: abortControllerRef.current.signal,
        outChunk: (chunk) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;

            const updatedLast = { ...last, content: last.content + chunk };
            return [...prev.slice(0, -1), updatedLast];
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

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4">
      {/* Configuration Controls */}
      <div className="flex gap-4 mb-4 items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
      {/* Show selected Provider & Model from ModelSelector */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md font-semibold capitalize">
          {provider || "N/A"}
        </span>
        <span className="text-gray-400">/</span>
        <span className="bg-gray-200 text-gray-800 px-2.5 py-1 rounded-md font-mono">
          {model || "N/A"}
        </span>
      </div>

      {/* Temperature Slider  */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-600">Temp: {temperature}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          disabled={isGenerating}
          className="w-24 cursor-pointer"
        />
      </div>
    </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto border p-4 rounded mb-4 space-y-4 flex flex-col">
        {messages.map((msg, index) => (
          <div
            key={index}
            // Sửa class Tailwind: self-end chuẩn vị trí
            className={`p-3 rounded-lg max-w-[80%] ${
              msg.role === "user"
                ? "bg-blue-500 text-white self-end"
                : "bg-gray-100 text-gray-800 self-start"
            }`}
          >
            <strong className="block text-xs opacity-75 mb-1">{msg.role}</strong>
            <span className="whitespace-pre-wrap">{msg.content}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input & Action Area */}
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Start chatting..."
          disabled={isGenerating}
          className="flex-1 border p-2 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        {isGenerating ? (
          <button
            onClick={handleStop}
            className="bg-red-500 text-white px-4 py-2 rounded font-medium hover:bg-red-600 transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded font-medium disabled:opacity-50 hover:bg-blue-600 transition-colors"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
