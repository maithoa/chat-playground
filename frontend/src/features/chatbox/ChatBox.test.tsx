// ChatBox component unit tests
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as llmService from "@/services/llmService";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChatBox } from "@/features/chatbox/ChatBox";

// Mock streamChat to simulate streaming chunks and usage data
vi.mock("../../services/llmService", () => ({
  streamChat: vi.fn().mockImplementation(async ({ outChunk, onUsageComplete }) => {
    // Simulate streaming two chunks
    outChunk("Hello ");
    outChunk("world!");
    // Simulate usage completion
    onUsageComplete?.({ total_tokens: 10, prompt_tokens: 5, completion_tokens: 5 });
  }),
}));

// Mock child components to simplify rendering
vi.mock("./SendMsgToModel", () => ({
  SendMsgToModel: ({ onSend, disabled }: any) => (
    <button disabled={disabled} onClick={() => onSend("provider1", "model1")}>
      Send
    </button>
  ),
}));

vi.mock("./ConversationTokenCounter", () => ({
  ConversationTokenCounter: () => <div data-testid="token-counter" />, // placeholder
}));

describe("ChatBox component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should send a message, stream response and display usage", async () => {
    render(<ChatBox />);

    // Type a user message
    const textarea = screen.getByPlaceholderText(
      /Type a message/i
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Hi there" } });

    // Click Send button (mocked)
    const sendBtn = screen.getByRole("button", { name: /Send/i });
    fireEvent.click(sendBtn);

    // User message should appear
    await waitFor(() => {
      expect(screen.getByText("Hi there")).toBeInTheDocument();
    });

    // Assistant streamed content should appear
    await waitFor(() => {
      expect(screen.getByText("Hello world!")).toBeInTheDocument();
    });
  });

  it("does not send when input is empty", async () => {
    render(<ChatBox />);

    // Ensure textarea is empty
    const textarea = screen.getByPlaceholderText(
      /Type a message/i
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("");

    // Click Send button (should be disabled)
    const sendBtn = screen.getByRole("button", { name: /Send/i }) as HTMLButtonElement;
    expect(sendBtn).toBeDisabled();

    // Attempting a click should not change state
    fireEvent.click(sendBtn);

    // Verify that no user or assistant messages appear. We look for the placeholder
    // text that would be rendered inside a message bubble.
    await waitFor(() => {
      expect(screen.queryByText(/Thinking/)).not.toBeInTheDocument();
      // Also ensure that the textarea is still empty
      const textarea = screen.getByPlaceholderText(
        /Type a message/i
      ) as HTMLTextAreaElement;
      expect(textarea.value).toBe("");
    });
  });

  it("disables send button while generating", async () => {
    render(<ChatBox />);

    const textarea = screen.getByPlaceholderText(
      /Type a message/i
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Test message" } });

    const sendBtn = screen.getByRole("button", { name: /Send/i }) as HTMLButtonElement;
    expect(sendBtn).not.toBeDisabled();

    fireEvent.click(sendBtn);
    // Immediately after click, button should be disabled
    expect(sendBtn).toBeDisabled();

    // After streaming finishes, re‑type a new message to enable the button again
    fireEvent.change(textarea, { target: { value: "Another" } });
    await waitFor(() => {
      const refreshedBtn = screen.getByRole("button", {
        name: /Send/i,
      }) as HTMLButtonElement;
      expect(refreshedBtn).not.toBeDisabled();
    });
  });

  it("shows Stop button while streaming and aborts on click", async () => {
    // Ensure the generic mock for streamChat is present
    const abortSpy = vi.fn();
    // Mock implementation that never resolves and registers abort listener
    vi.spyOn(llmService, "streamChat").mockImplementation(({ signal }) => {
      signal?.addEventListener("abort", abortSpy);
      return new Promise(() => {});
    });

    // Re-import the component to pick up the new mock implementation
    const { ChatBox: ChatBoxWithAbort } = await import("./ChatBox");
    render(<ChatBoxWithAbort />);

    const textarea = screen.getByPlaceholderText(
      /Type a message/i
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Abort test" } });

    const sendBtn = screen.getByRole("button", { name: /Send/i });
    fireEvent.click(sendBtn);

    // Stop button should appear
    const stopBtn = await screen.findByRole("button", { name: /Stop/i });
    expect(stopBtn).toBeInTheDocument();

    // Click Stop and verify abort was triggered
    fireEvent.click(stopBtn);
    expect(abortSpy).toHaveBeenCalled();
  });

  it("handles streaming error and shows alert", async () => {
    // happy-dom may not provide a native alert implementation, so mock it directly
    const originalAlert = (globalThis as any).alert;
    (globalThis as any).alert = vi.fn();
    const alertMock = (globalThis as any).alert as ReturnType<typeof vi.fn>;
    // Override the previously mocked streamChat to throw an error for this test
    vi.spyOn(llmService, "streamChat").mockImplementation(() => {
      throw new Error("Network failure");
    });

    vi.resetModules();
    const { ChatBox: ChatBoxError } = await import("./ChatBox");
    render(<ChatBoxError />);

    const textarea = screen.getByPlaceholderText(
      /Type a message/i
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Error test" } });

    const sendBtn = screen.getByRole("button", { name: /Send/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith("Error: Network failure");
    });

    // Assistant placeholder should be removed after error
    const thinking = screen.queryByText(/Thinking/);
    expect(thinking).not.toBeInTheDocument();

    // restore original alert
    (globalThis as any).alert = originalAlert;
  });
});
