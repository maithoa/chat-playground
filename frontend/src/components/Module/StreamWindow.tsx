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
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl mb-4 space-y-5 flex flex-col pr-2 scrollbar-thin scrollbar-thumb-slate-800">
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={index}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"} w-full`}
            >
              {/* Bubble Container */}
              <div
                data-testid={isUser ? "user-message-bubble" : "assistant-message-bubble"}
                className={`px-5 py-3.5 rounded-2xl max-w-[85%] text-sm leading-relaxed transition-all ${
                  isUser
                    ? "bg-gradient-to-r from-sky-600 to-blue-600 text-slate-100 rounded-br-xs shadow-lg shadow-sky-950/40 border border-sky-500/20"
                    : "bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 text-slate-200 rounded-bl-xs shadow-xl shadow-black/30"
                }`}
              >
                <div className="prose prose-sm max-w-none text-left prose-invert">
                  {msg.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : isUser ? null : (
                    <span className="flex items-center gap-2 text-slate-400 animate-pulse text-xs font-medium py-0.5">
                      <Coffee className="w-3.5 h-3.5 text-sky-400" />
                      Thinking...
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Toolbar Area */}
      <div className="flex-shrink-0 pt-2 flex flex-col border-t border-slate-800/60">
        <div className="flex mt-1 items-center justify-between gap-2">
          <ConversationTokenCounter
            messages={messages}
            streamingContent={messages[messages.length - 1]?.content || ""}
            isStreaming={isGenerating}
          />

          <button
            onClick={onStop}
            disabled={!isGenerating}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
              isGenerating
                ? "bg-rose-500/90 text-white shadow-md shadow-rose-500/20 hover:bg-rose-500 cursor-pointer active:scale-95"
                : "bg-slate-900 text-slate-600 border border-slate-800/60 cursor-not-allowed select-none"
            }`}
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
};
