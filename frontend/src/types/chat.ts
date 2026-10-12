export type Role = "user" | "assistant" | "system";

export interface MessageUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  time_to_first_token_ms: number;
  tokens_per_second: number;
}

export interface Message {
  role: Role;
  content: string;
  usage?: MessageUsage | null;
}

export interface StreamChatParams {
  provider: string;
  model: string;
  messages: Message[];
  outChunk: (chunk_: string) => void;
  onUsageComplete: (usage: MessageUsage) => void;
  signal?: AbortSignal;
}
