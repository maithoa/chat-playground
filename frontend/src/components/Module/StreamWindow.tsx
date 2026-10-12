import React, { useEffect, useRef } from "react";
import type { Message } from "@/types/chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Coffee } from "lucide-react";
import { ConversationTokenCounter } from "@/components/Button/ConversationTokenCounter";

export interface StreamWindowProps {
  messages: Message[];
  isGenerating?: boolean;
  onStop: () => void;
}

export const StreamWindow: React.FC<StreamWindowProps> = ({
  messages,
  isGenerating = false,
  onStop,
}) => {
  // refs
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: isGenerating ? "auto" : "smooth",
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex flex-col h-full flex-1 min-w-0 p-3 overflow-hidden">
      {/* Messages Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded mb-4 space-y-4 flex flex-col pr-1">
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
      <div className="flex-shrink-0 space-y-2 pt-2 flex flex-col">
        <div className="flex  mt-2 items-center justify-between gap-2">
          {/* Token counter*/}
          <ConversationTokenCounter
            messages={messages}
            streamingContent={messages[messages.length - 1]?.content || ""}
            isStreaming={isGenerating}
          />
          {/* Stop button */}
          <button
            onClick={onStop}
            disabled={!isGenerating}
            className={`px-4 py-2 rounded text-xs font-medium transition-colors ${
              isGenerating
                ? "bg-red-500 text-white hover:bg-red-600 cursor-pointer"
                : "bg-gray-100 text-gray-400 cursor-not-allowed select-none"
            }`}
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
};
