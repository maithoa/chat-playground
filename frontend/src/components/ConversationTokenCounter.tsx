import React, { useMemo } from "react";
import { Cpu, CheckCircle2 } from "lucide-react";
import type { Message } from "../types/chat";

interface ConversationTokenCounterProps {
  messages: Message[];
  /**Current text being streamed from backend */
  streamingContent?: string;
  isStreaming?: boolean;
}

/**
 * Method to calculate the approximate number of tokens in a string.
 * This is a rough estimate based on the number of words in the messages and the streaming content.
 * It does not account for the actual tokenization used by the LLM model, but provides a quick approximation.
 * @param string - The string for which to calculate token count.
 * @returns The approximate number of tokens in the string.
 */
const estimateTokenCount = (str: string): number => {
  if (!str) return 0;
  return Math.ceil(str.length / 3.2); // Rough estimate
};

export const ConversationTokenCounter: React.FC<ConversationTokenCounterProps> = ({
  messages,
  streamingContent = "",
  isStreaming = false,
}) => {
  const tokenStats = useMemo(() => {
    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalTokens = 0;

    // Accumulate the token from messages history
    messages.forEach((msg) => {
      if (msg.usage) {
        totalPrompt += msg.usage.prompt_tokens;
        totalCompletion += msg.usage.completion_tokens;
        totalTokens += msg.usage.total_tokens;
      } else {
        // fallback to estimate token count if usage is not yet available
        const estimatedTokens = estimateTokenCount(msg.content);
        if (msg.role === "user" || msg.role === "system") {
          totalPrompt += estimatedTokens;
        } else {
          totalCompletion += estimatedTokens;
        }
        totalTokens += estimatedTokens;
      }
    });

    // If streaming, add the accumulated tokens
    if (isStreaming && streamingContent) {
      const estimatedStreamingTokens = estimateTokenCount(streamingContent);
      totalCompletion += estimatedStreamingTokens;
      totalTokens += estimatedStreamingTokens;
    }

    return {
      promptTokens: totalPrompt,
      completionTokens: totalCompletion,
      totalTokens: totalTokens,
    };
  }, [messages, streamingContent, isStreaming]);

  return (
    <div className="flex items-center gap-2 text-xs font-mono text-gray-600 bg-white/80 border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
      <Cpu
        className={`w-4 h-4 ${
          isStreaming ? "text-blue-600 animate-pulse" : "text-gray-400"
        }`}
      />

      <div className="flex items-center gap-1.5">
        <span className="text-gray-500">Total Tokens:</span>
        <span className="font-bold text-gray-800 tabular-nums">
          {tokenStats.totalTokens.toLocaleString()}
        </span>
        <span className="text-gray-400 text-[11px] font-normal">
          ({tokenStats.promptTokens.toLocaleString()} in /{" "}
          {tokenStats.completionTokens.toLocaleString()} out /{" "}
          {tokenStats.totalTokens.toLocaleString()} total)
        </span>
        {!isStreaming && (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-0.5"></CheckCircle2>
        )}
      </div>
    </div>
  );
};
