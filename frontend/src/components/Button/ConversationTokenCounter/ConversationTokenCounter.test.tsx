// frontend/src/components/Button/ConversationTokenCounter/ConversationTokenCounter.test.tsx
/**
 * Unit tests for {@link ConversationTokenCounter}.
 *
 * The component is pure UI – it receives an array of messages (some of which may
 * contain usage data) and optional streaming data.  The tests verify:
 *
 * 1️⃣ Correct token aggregation from `msg.usage`.
 * 2️⃣ Correct addition of estimated tokens while streaming.
 * 3️⃣ Proper handling of CJK characters (different divisor).
 * 4️⃣ Conditional rendering of the status icons (`Cpu` & `CheckCircle2`).
 * 5️⃣ Accessibility attributes (`role="status"` & `aria-live="polite"`).
 *
 * The test suite runs with **vitest** + **happy-dom** (the project's test
 * dependencies).  Lucide‑react icons are mocked to simple `<div>` elements to
 * avoid SVG rendering in the test environment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Message, MessageUsage } from "@/types/chat";
import {
  ConversationTokenCounter,
  type ConversationTokenCounterProps,
} from "./ConversationTokenCounter";

// ---------------------------------------------------------------------------
// Mock heavy UI dependencies (lucide-react icons)
// ---------------------------------------------------------------------------
vi.mock("lucide-react", () => ({
  Cpu: (props: any) => <div data-testid="cpu-icon" {...props} />,
  CheckCircle2: (props: any) => <div data-testid="check-icon" {...props} />,
}));

// ---------------------------------------------------------------------------
// Helper to create a minimal Message shape used by the component
// ---------------------------------------------------------------------------
const makeMessage = (content: string, usage?: MessageUsage): Message => ({
  role: "assistant",
  content,
  usage,
});

// ---------------------------------------------------------------------------
// Re‑usable render wrapper
// ---------------------------------------------------------------------------
const renderCounter = (props: Partial<ConversationTokenCounterProps> = {}) => {
  const defaultProps: ConversationTokenCounterProps = {
    messages: [],
    streamingContent: "",
    isStreaming: false,
    ...props,
  };
  render(<ConversationTokenCounter {...defaultProps} />);
};

describe("ConversationTokenCounter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1️⃣ Token aggregation from usage data (no streaming)
  // -------------------------------------------------------------------------
  it("displays aggregated token counts from message usage when not streaming", () => {
    const usage1 = {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
      time_to_first_token_ms: 100,
      tokens_per_second: 400,
    };
    const usage2 = {
      prompt_tokens: 2,
      completion_tokens: 3,
      total_tokens: 5,
      time_to_first_token_ms: 100,
      tokens_per_second: 400,
    };
    const msgs = [makeMessage("msg‑1", usage1), makeMessage("msg‑2", usage2)];
    renderCounter({ messages: msgs });

    // Total tokens line
    expect(screen.getByText(/Tokens used:/i)).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument(); // 15 + 5

    // In / out breakdown
    expect(screen.getByText("(12 in / 8 out)")).toBeInTheDocument(); // 10+2 in, 5+3 out

    // Check that the “finalized” check icon appears (not streaming)
    expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("cpu-icon")).toBeInTheDocument(); // Cpu is always rendered
  });

  // -------------------------------------------------------------------------
  // 2️⃣ Streaming mode – estimated tokens are added to the completion/total
  // -------------------------------------------------------------------------
  it("adds estimated tokens for streaming content while preserving backend usage", () => {
    const usage1 = {
      prompt_tokens: 4,
      completion_tokens: 1,
      total_tokens: 5,
      time_to_first_token_ms: 100,
      tokens_per_second: 400,
    };
    const msgs = [makeMessage("msg‑1", usage1)];
    const streaming = "hello world"; // 11 chars → English divisor = 4 → 3 tokens (ceil)

    renderCounter({
      messages: msgs,
      streamingContent: streaming,
      isStreaming: true,
    });

    // Backend usage (5 total) + estimated (3) = 8 total tokens
    expect(screen.getByText("8")).toBeInTheDocument();

    // Prompt tokens unchanged, completion tokens = backend + estimate
    expect(screen.getByText("(4 in / 4 out)")).toBeInTheDocument(); // 1+3 out

    // Streaming icon should pulse
    const cpu = screen.getByTestId("cpu-icon");
    expect(cpu).toHaveClass("animate-pulse");
    // No check‑icon when streaming
    expect(screen.queryByTestId("check-icon")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3️⃣ CJK characters use a different divisor (≈0.6 chars per token)
  // -------------------------------------------------------------------------
  it("estimates fewer tokens for CJK strings", () => {
    const cjk = "漢字テスト"; // 6 characters, includes CJK
    // 6 / 0.6 = 10 tokens (ceil)
    renderCounter({
      messages: [],
      streamingContent: cjk,
      isStreaming: true,
    });

    expect(screen.getByText("9")).toBeInTheDocument(); // only estimated tokens
  });

  // -------------------------------------------------------------------------
  // 4️⃣ Accessibility attributes are present
  // -------------------------------------------------------------------------
  it("renders a status region with appropriate ARIA attributes", () => {
    renderCounter();
    const wrapper = screen.getByTestId("token-counter");
    expect(wrapper).toHaveAttribute("role", "status");
    expect(wrapper).toHaveAttribute("aria-live", "polite");
    // The aria‑label reflects the total token count (0 at start)
    expect(wrapper).toHaveAttribute("aria-label", "Token usage: 0 total tokens");
  });

  // -------------------------------------------------------------------------
  // 5️⃣ Edge case – empty messages & no streaming content
  // -------------------------------------------------------------------------
  it("handles empty data gracefully (zero tokens, no crash)", () => {
    renderCounter();
    // Total tokens should be 0
    expect(screen.getByText("0")).toBeInTheDocument();
    // In / out should both be 0
    expect(screen.getByText("(0 in / 0 out)")).toBeInTheDocument();
    // Check icon should be shown because not streaming
    expect(screen.getByTestId("check-icon")).toBeInTheDocument();
  });
});
