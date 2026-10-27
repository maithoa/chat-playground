import type { Message, MessageUsage } from "@/types/chat";

export interface ModelInfo {
  id: string;
  name: string;
  provider_id: string;
  context_window?: number;
  description?: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  is_active: boolean;
  models: ModelInfo[];
}

export interface StreamMetrics {
  startTime: number;
  timeToFirstTokenMs?: number;
  totalDurationMs?: number;
  tokensPerSecond?: number;
  usage?: MessageUsage;
}

export type StreamStatus = "idle" | "streaming" | "completed" | "error";

export interface SingleStreamState {
  llmModel: ModelInfo | null;
  messages: Message[];
  status: StreamStatus;
  metrics?: StreamMetrics | null;
  error?: string | null;
}

export interface DualModelArenaState {
  streamA: SingleStreamState;
  streamB: SingleStreamState;
}

export interface UserUsage {
  device_fp: string;
  tokens_used: number;
  requests_used: number;
  max_daily_tokens: number;
  max_hourly_requests: number;
}
