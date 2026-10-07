import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ConversationTokenCounter } from "./ConversationTokenCounter";
import type { Message } from "../types/chat";

// Helper to create a message with optional usage data
const createMessage = (content: string, role: string, usage?: any): Message => {
  return {
    role,
    content,
    // The Message type in the project includes optional usage; we spread if provided
    ...(usage ? { usage } : {}),
  } as Message;
};

describe("ConversationTokenCounter Component", () => {
  it("displays total token count based on usage and estimated tokens", () => {
    const messages: Message[] = [
      // Message with explicit usage data
      createMessage("Hello", "user", {
        prompt_tokens: 5,
        completion_tokens: 0,
        total_tokens: 5,
      }),
      // Message without usage, will be estimated
      createMessage("World!", "assistant"),
    ];

    render(<ConversationTokenCounter messages={messages} isStreaming={false} />);

    // The total tokens should be sum of explicit + estimated (World! length ~6 chars => ~2 tokens)
    const total = screen.getByText(/Total Tokens:/i);
    expect(total).toBeInTheDocument();
    // Ensure the displayed number includes the explicit 5 tokens + estimated >0
    const tokenValue = total.nextElementSibling?.textContent?.replace(/[^0-9]/g, "");
    expect(Number(tokenValue)).toBeGreaterThanOrEqual(5);
  });

  it("shows streaming animation when isStreaming is true", () => {
    const messages: Message[] = [];
    render(
      <ConversationTokenCounter
        messages={messages}
        isStreaming={true}
        streamingContent="partial"
      />
    );

    // The animated calculating text should be present
    expect(screen.getByText(/calculating/i)).toBeInTheDocument();
    // The CPU icon should have the pulse class (blue color) – check class list contains animate-pulse
    const cpuIcon = screen.getByTestId("cpu-icon");
    // Since the component does not set testId, we fallback to checking the SVG via role
    // Find the svg element with title containing "Cpu" (lucide icons render with aria-label)
    const svg = screen.getByLabelText(/cpu/i);
    expect(svg).toBeInTheDocument();
    // Verify it includes the animate-pulse class
    expect(svg.className).toContain("animate-pulse");
  });
});
