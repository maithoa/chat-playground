# AI AGENT EXECUTION CONSTRAINTS: Dual-Model Real-Time Arena

> **CRITICAL INSTRUCTION FOR AGENT:** You are acting as an autonomous execution engine. Read this entire specification before generating or modifying code. You MUST strictly adhere to the defined file boundaries, type contracts, algorithmic constraints, and verification criteria. Do NOT alter shared core modules or introduce unapproved dependencies.

---

## 1. Execution Scope & File Boundaries
### FRONTEND
- **Allowed Scope  (Can CREATE and MODIFY only within these paths):**
  - `src/features/arena/**` (Components, Hooks, Reducers, Services)
  - `src/types/arena.ts` (Type contracts)
  - `tests/unit/arena/**` (Unit & Integration tests)

- **Forbidden Scope (STRICTLY READ-ONLY or DO NOT TOUCH):**
  - `src/core/auth/**`
  - `src/components/**`
  - Root project configurations (`package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`)

### BACKEND
- **Allowed Scope  (Can CREATE and MODIFY only within these paths):**
  - `app/services/llm/**` (Clould Provider Handlers and LLM Service)

- **Forbidden Scope (STRICTLY READ-ONLY or DO NOT TOUCH):**
  - `src/core/**`
  - `src/models/**`
  - Root project configurations (`pyproject.toml`)
---

## 2. Strict Type Contracts (`src/types/arena.ts`)

You MUST export and use the exact TypeScript interfaces below without modification:

```typescript
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
  outChunk: (chunk: string) => void;
  onUsageComplete?: (usage: MessageUsage) => void;
  signal?: AbortSignal;
}

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

## 3. State Management & Reducer Contract

All state modifications MUST go through a single `arenaReducer`

- **Action Types Required:**
  -`SET_MODEL`: { streamId:'A' | 'B' , model : ModelInfo }
  -`START_STREAM`: { streamId:'A' | 'B' }
  -`APPEND_CHUNK`: { streamId:'A' | 'B', chunk : string }
  -`SET_USAGE`: { streamId:'A' | 'B', usage : MessageUsage, durationMs: number }
  -`SET_ERROR`: { streamId:'A' | 'B', error : string }
  -`STOP_STREAM`: { streamId:'A' | 'B' }
  -`RESET_ARENA`: void

## 4. Algorithmic Constraints and Async Handling

1. **Strict Isolation**: `streamA` and `streamB` MUST run independently.
  - An error or timout in `streamA` must not halt or mutate `streamB`
2. **Abort Management**:
  - Maintain separate `AbortController` instances for Stream A and Stream B.
  - Triggering `Stop A` must abort only `Stream A's` controller.
3. **Metrics Calculation:**
  - `timeToFirstToken`: Must calculate in backend for each Cloud Provider Handler (google_handler.py, groq_handler.py, openrouter_handler.py)
  - `tokenPerSecond`: Must calculate in backend for each Cloud Provider Handler (google_handler.py, groq_handler.py, openrouter_handler.py)

## 5. Required Component Hierarchy

- `src/features/arena/components/ArenaContainer.tsx` (Parent wrapper holding `useDualArena`)
  ├── `src/features/arena/components/ArenaHeader.tsx` (Global prompt input & dual trigger)
  └── `src/features/arena/components/StreamColumn.tsx` (Render individual stream A/B)
      ├── `ModelSelector.tsx`
      ├── `MessageList.tsx`
      └── `StreamMetricsBadge.tsx`

## 6. Definition of Done
Before marking execution complete, the Agent MUST run and pass:
1. `npm run test` (All unit tests in `tests/unit/arena/**` must pass)
2. `npm run build` (Must complete with 0 TypeScript or Vite compilation errors)

