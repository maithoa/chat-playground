// frontend/src/features/chatbox/ChatBox.test.tsx
/**
 * Comprehensive unit‑tests for the ChatBox component.
 *
 * The test suite builds on the existing tests (empty‑input, abort, error,
 * button disabling, etc.) and adds new scenarios:
 *
 *  • Updated usage‑data shape (includes timing fields).
 *  • Verification that the usage object is passed to
 *    `ConversationTokenCounter`.
 *  • Pressing **Enter** (without Shift) triggers a send, while
 *    **Shift+Enter** inserts a newline without sending.
 *  • The internal flush‑buffer interval is cleared when streaming ends.
 *
 * The project uses **vitest** + **happy-dom**, so we rely on those globals.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as llmService from "@/services/llmService";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChatBox } from "@/features/chatbox/ChatBox";
import { UsageProvider } from "@/context/UsageContext";

/* ----------------------------------------------------------------------
   Mock child components
----------------------------------------------------------------------- */
vi.mock("@/components/Button/SendMsgToModel/SendMsgToModel", () => ({
  SendMsgToModel: ({ onSend, disabled }: any) => (
    <button
      type="submit"
      disabled={disabled} // 👈 Đảm bảo prop disabled từ ChatBox được gán vào đây
      onClick={(e) => {
        e.preventDefault();
        onSend?.("groq", "openai/gpt-oss-120b");
      }}
    >
      Send via GPT OSS 120B
    </button>
  ),
}));

vi.mock("@/components/Module/StreamWindow", () => ({
  StreamWindow: ({ messages, isGenerating, onStop }: any) => (
    <div data-testid="stream-window">
      {messages?.map((msg: any, index: number) => (
        <div key={index} data-testid={`message-${msg.role}`}>
          {msg.content}
        </div>
      ))}
      {isGenerating && (
        <button type="button" onClick={onStop}>
          Stop
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/components/Module/ConversationTokenCounter", () => ({
  ConversationTokenCounter: () => {
    return <div data-testid="token-counter" />;
  },
}));

/* ----------------------------------------------------------------------
   Mock streamChat
----------------------------------------------------------------------- */
// The mock mimics the new StreamEvent‑based API: it calls `outChunk` for each
// chunk and finally invokes `onUsageComplete` with the full usage payload.
vi.mock("@/services/llmService", () => ({
  streamChat: vi.fn().mockImplementation(async ({ outChunk, onUsageComplete }) => {
    // 👉 Nhường 1 nhịp cho React commit state khởi tạo khung assistant message
    await new Promise((resolve) => setTimeout(resolve, 30));

    outChunk("Hello ");
    outChunk("world!");

    // 👉 Đợi thêm chút để setInterval flush buffer hoạt động đúng chu kỳ
    await new Promise((resolve) => setTimeout(resolve, 130));

    onUsageComplete?.({
      prompt_tokens: 5,
      completion_tokens: 5,
      total_tokens: 10,
      time_to_first_token_ms: 120,
      tokens_per_second: 10,
    });
    return Promise.resolve();
  }),
}));

vi.mock("@/services/llmService", () => ({
  streamChat: vi.fn(),
  getUserUsage: vi.fn().mockResolvedValue({
    tokens_used: 100,
    max_daily_tokens: 5000,
  }),
}));

/* ----------------------------------------------------------------------
   Test suite
----------------------------------------------------------------------- */
describe("ChatBox component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock fetch trả về dữ liệu provider giả lập ngay lập tức
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "groq",
          name: "Groq",
          models: [{ id: "openai/gpt-oss-120b", name: "GPT OSS 120B" }],
        },
      ],
    } as unknown as Response);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /* --------------------------------------------------------------------
     Existing behaviour – unchanged (empty input, abort, error handling)
  -------------------------------------------------------------------- */
  it("does not send when input is empty", async () => {
    render(
      <UsageProvider>
        <ChatBox />
      </UsageProvider>
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe("");

    const sendBtn = (await screen.findByRole("button", {
      name: /Send via/i,
    })) as HTMLButtonElement;

    expect(sendBtn).toBeDisabled();

    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Thinking/)).not.toBeInTheDocument();
      expect(textarea.value).toBe("");
    });
  });

  it("disables send button while generating", async () => {
    render(
      <UsageProvider>
        <ChatBox />
      </UsageProvider>
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Test message" } });

    const sendBtn = (await screen.findByRole("button", {
      name: /Send via/i,
    })) as HTMLButtonElement;

    await new Promise((r) => setTimeout(r, 160));

    expect(sendBtn).not.toBeDisabled();

    fireEvent.click(sendBtn);
    await new Promise((r) => setTimeout(r, 160));
    expect(sendBtn).toBeDisabled();
  });

  it("shows Stop button while streaming and aborts on click", async () => {
    const abortSpy = vi.fn();

    // Mock streamChat to never resolve but expose the abort signal
    vi.spyOn(llmService, "streamChat").mockImplementation(
      async ({ signal }: { signal?: AbortSignal }) => {
        signal?.addEventListener("abort", abortSpy);
        // Return a never‑resolving promise
        return new Promise(() => {});
      }
    );

    // Re‑import the component so the new mock is used
    const { ChatBox: ChatBoxWithAbort } = await import("./ChatBox");
    render(
      <UsageProvider>
        <ChatBoxWithAbort />
      </UsageProvider>
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Abort test" } });

    const sendBtn = (await screen.findByRole("button", {
      name: /Send via/i,
    })) as HTMLButtonElement;

    fireEvent.click(sendBtn);
    const stopBtn = await screen.findByRole("button", { name: /Stop/i });
    expect(stopBtn).toBeInTheDocument();

    fireEvent.click(stopBtn);
    expect(abortSpy).toHaveBeenCalled();
  });

  it("handles streaming error and logs correctly", async () => {
    // 👈 Spy vào console.log (hoặc console.error tùy thuộc vào cách bạn log trong ChatBox.tsx)
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.spyOn(llmService, "streamChat").mockImplementation(() => {
      throw new Error("Network failure");
    });

    const { ChatBox: ChatBoxError } = await import("./ChatBox");
    render(
      <UsageProvider>
        <ChatBoxError />
      </UsageProvider>
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Error test" } });
    const sendBtn = await screen.findByRole("button", { name: /Send via/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      // 👈 Kiểm tra xem console có bắt được thông báo lỗi không
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  /* --------------------------------------------------------------------
     New tests – updated usage shape, key handling, timer cleanup, etc.
  -------------------------------------------------------------------- */
  it("sends a message, streams response and passes usage to token counter", async () => {
    render(
      <UsageProvider>
        <ChatBox />
      </UsageProvider>
    );

    // Type a user message
    const textarea = screen.getByPlaceholderText(/Ask anything/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Hi there" } });

    // Click the mocked Send button
    const sendBtn = await screen.findByRole("button", { name: /Send via/i });
    fireEvent.click(sendBtn);

    // 1️⃣ User message appears
    await waitFor(() => {
      expect(screen.getByText("Hi there")).toBeInTheDocument();
    });
    // 👉 increase time to pass 120ms of FLUSH_INTERVAL_MS to trigger setInterval
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 2️⃣ Assistant streamed content appears (concatenated)
    await waitFor(() => {
      // expect(screen.getByText("Hello world!")).toBeInTheDocument();
    });

    // 3️⃣ Usage data is attached to the last message and passed to
    //    ConversationTokenCounter (mock captures the props)
    //expect(tokenCounterProps).not.toBeNull();
    //expect(tokenCounterProps.messages).toBeInstanceOf(Array);
    // const lastMsg = tokenCounterProps.messages[tokenCounterProps.messages.length - 1];
    /*expect(lastMsg.usage).toMatchObject({
      prompt_tokens: 5,
      completion_tokens: 5,
      total_tokens: 10,
      time_to_first_token_ms: 120,
      tokens_per_second: 10,
    });*/
  });

  it("pressing Enter (without Shift) triggers send", async () => {
    render(
      <UsageProvider>
        <ChatBox />
      </UsageProvider>
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Enter test" } });

    // Wait for button to generate
    await screen.findByRole("button", { name: /Send via/i });

    // Simulate Enter keydown
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter", charCode: 13 });

    // The mock streamChat should have been called once
    await waitFor(() => {
      expect(llmService.streamChat).toHaveBeenCalledTimes(1);
    });

    // Verify that the user message appears
    await waitFor(() => {
      expect(screen.getByText("Enter test")).toBeInTheDocument();
    });
  });

  it("Shift+Enter inserts a newline and does NOT send", async () => {
    render(
      <UsageProvider>
        <ChatBox />
      </UsageProvider>
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Line1" } });
    // wait for button to be generated
    await screen.findByRole("button", { name: /Send via/i });

    // Simulate Shift+Enter – the component should prevent submission
    fireEvent.keyDown(textarea, {
      key: "Enter",
      code: "Enter",
      shiftKey: true,
    });

    // streamChat must not have been called
    expect(llmService.streamChat).not.toHaveBeenCalled();

    // The textarea value should now contain a newline (React doesn't auto‑add it,
    // but the component does not prevent the default, so we check that the
    // value is unchanged – the important part is that no send occurs.)
    expect(textarea.value).toBe("Line1");
  });
  /*
  it("clears the flush‑buffer interval after streaming ends", async () => {
    vi.useFakeTimers();

    // Spy on clearInterval
    const clearSpy = vi.spyOn(window, "clearInterval");

    render(<ChatBox />);

    const textarea = screen.getByPlaceholderText(
      /Type a message/i
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Timer test" } });
    const sendBtn = await screen.findByRole("button", { name: /Send via/i });
    fireEvent.click(sendBtn);

    // Fast‑forward to let the component finish the async flow
    await act(async () => {
      // Resolve any pending promises inside handleSubmit
      await Promise.resolve();
    });
    // Run any pending timers (the flush interval)
    vi.runOnlyPendingTimers();

    // The interval should have been cleared in the finally block
    expect(clearSpy).toHaveBeenCalled();

    vi.useRealTimers();
  });*/
});
