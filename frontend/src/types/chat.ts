export type Role = "user" | "assistant" | "system";

export interface MessageUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
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
  temperature: number;
  outChunk: (chunk_: string) => void;
  onUsageComplete?: (usage: MessageUsage) => void;
  signal?: AbortSignal;
}
