import React, { useMemo } from "react";
import { Cpu, CheckCircle2 } from "lucide-react";
import type { Message } from "@/types/chat";

export interface ConversationTokenCounterProps {
  messages: Message[];
  /** Current text being streamed from backend */
  streamingContent?: string;
  isStreaming?: boolean;
}

/**
 * Estimates token count.
 * Adjusts heuristic for CJK (Chinese, Japanese, Korean) characters
 * which consume significantly more tokens per character.
 */
const estimateTokenCount = (str: string): number => {
  if (!str) return 0;

  // Check if string contains CJK characters
  const hasCJK =
    /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\uac00-\ud7af]/.test(
      str
    );

  // CJK: ~0.6 characters per token. English/Others: ~4 characters per token.
  const divisor = hasCJK ? 0.6 : 4;
  return Math.ceil(str.length / divisor);
};

export const ConversationTokenCounter: React.FC<ConversationTokenCounterProps> = ({
  messages,
  streamingContent = "",
  isStreaming = false,
}) => {
  const tokenStats = useMemo(() => {
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    let estPromptTokens = 0;
    let estCompletionTokens = 0;
    let estTotalTokens = 0;

    // 1. Accumulate tokens from message history
    messages.forEach((msg) => {
      if (msg.usage) {
        promptTokens += msg.usage.prompt_tokens ?? 0;
        completionTokens += msg.usage.completion_tokens ?? 0;
        totalTokens += msg.usage.total_tokens ?? 0;
      }
    });

    // 2. Add streaming content tokens
    if (isStreaming && streamingContent) {
      const streamingTokens = estimateTokenCount(streamingContent);
      estCompletionTokens += streamingTokens;
      estTotalTokens += streamingTokens;
    }
    // Only update promptTokens, completetionTokens, totalTokens using values returned from backend.
    if (isStreaming) {
      return {
        promptTokens: promptTokens + estPromptTokens,
        completionTokens: completionTokens + estCompletionTokens,
        totalTokens: totalTokens + estTotalTokens,
      };
    } else {
      return { promptTokens, completionTokens, totalTokens };
    }
  }, [messages, streamingContent, isStreaming]);

  return (
    <div
      data-testid="token-counter"
      role="status"
      aria-live="polite"
      aria-label={`Token usage: ${tokenStats.totalTokens} total tokens`}
      className="flex items-center gap-2 text-xs font-mono text-gray-600 bg-white/80 border border-gray-200 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm select-none"
    >
      <Cpu
        data-testid="cpu-icon"
        aria-hidden="true"
        className={`w-4 h-4 transition-colors duration-500 ${
          isStreaming ? "text-blue-600 animate-pulse" : "text-gray-400"
        }`}
      />

      <div className="flex items-center gap-1.5">
        <span className="text-gray-500">Total Tokens:</span>
        <span className="font-bold text-gray-800 tabular-nums">
          {tokenStats.totalTokens.toLocaleString()}
        </span>

        <span className="text-gray-400 text-[11px] font-normal tabular-nums">
          ({tokenStats.promptTokens.toLocaleString()} in /{" "}
          {tokenStats.completionTokens.toLocaleString()} out)
        </span>

        {!isStreaming ? (
          <CheckCircle2
            className="w-3.5 h-3.5 text-green-500 ml-0.5 flex-shrink-0"
            aria-label="Token count finalized"
          />
        ) : (
          <span className="flex items-center text-blue-500 text-[11px] font-medium ml-1 select-none">
            calculating
            <span className="inline-flex ml-0.5" aria-hidden="true">
              <span className="animate-bounce" style={{ animationDelay: "0ms" }}>
                .
              </span>
              <span className="animate-bounce" style={{ animationDelay: "150ms" }}>
                .
              </span>
              <span className="animate-bounce" style={{ animationDelay: "300ms" }}>
                .
              </span>
            </span>
          </span>
        )}
      </div>
    </div>
  );
};
