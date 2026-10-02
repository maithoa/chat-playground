import React, { useState, useRef, useEffect } from "react";
import { streamChat } from "../services/llmService";
import type { Message } from "../types/chat";
import { SendMsgToModel } from "./SendMsgToModel";


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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (providerId: string, modelId: string) => {
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
        provider : providerId,
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
              onKeyDown={(e) => {
                  // ... Enter to Send logic
              }}
              placeholder="Type a message..."
              className="flex-1 border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              disabled={isGenerating}
          />

          <SendMsgToModel
              disabled={isGenerating || !input.trim()}
              onSend={(provider, model) => handleSend(provider, model)}
          />
      </div>

    </div>
  );
}
