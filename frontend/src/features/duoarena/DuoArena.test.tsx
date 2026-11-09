import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DuoArena } from "./DuoArena";
import * as llmService from "@/services/llmService";
import { UsageProvider } from "@/context/UsageContext";

// The DuoArena component also uses the `useUsageContext` hook. For the purpose of
// this unit‑test we mock the entire context module – the provider simply renders
// its children and the hook returns a no‑op `refreshUsage` function.
vi.mock("@/context/UsageContext", () => {
  const React = require("react");
  return {
    UsageProvider: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    useUsageContext: () => ({ refreshUsage: async () => {} }),
  };
});

// The real `ErrorMessage` component is exported via
// `src/components/ErrorMessage/index.ts`. No mocking is needed – the test can use the
// actual component. The import path `@/components/ErrorMessage` resolves to that
// index file via the project's tsconfig path alias.

// ---------------------------------------------------------------------------
// Mock heavy children
// ---------------------------------------------------------------------------
// Mock StreamWindow to render the streamed messages so tests can assert on content.
vi.mock("@/components/Module/StreamWindow", () => ({
  StreamWindow: ({ messages, isGenerating, onStop }: any) => (
    <div data-testid="stream-window">
      {/* Render each message's content for assertions */}
      {messages?.map((msg: any, idx: number) => (
        <div
          key={idx}
          data-testid={msg.role === "assistant" ? "assistant-message" : "user-message"}
        >
          {msg.content}
        </div>
      ))}
      <button data-testid="stop-btn" onClick={onStop} disabled={!isGenerating}>
        Stop
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Mock the backend streaming service
// ---------------------------------------------------------------------------
vi.mock("@/services/llmService", () => ({
  streamChat: vi.fn(),
}));

describe("DuoArena component", () => {
  beforeEach(() => {
    // No manual DOM manipulation – `render` creates its own container.
    vi.clearAllMocks();

    // Default mock implementation used by the earlier tests.
    vi.mocked(llmService.streamChat).mockImplementation(
      async ({ outChunk, onUsageComplete }: any) => {
        await new Promise((r) => setTimeout(r, 10));
        outChunk("Hello ");
        outChunk("world");
        onUsageComplete?.({
          prompt_tokens: 5,
          completion_tokens: 5,
          total_tokens: 10,
          time_to_first_token_ms: 120,
          tokens_per_second: 10,
        });
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1️⃣ Basic rendering
  // -----------------------------------------------------------------------
  it("renders two StreamWindow components and the input area", () => {
    render(
      <UsageProvider>
        <DuoArena />
      </UsageProvider>
    );

    const windows = screen.getAllByTestId("stream-window");
    expect(windows).toHaveLength(2);

    const textarea = screen.getByPlaceholderText(/Type a prompt/i) as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe("");

    const runBtn = screen.getByRole("button", { name: /run/i });
    expect(runBtn).toBeDisabled();
  });

  // -----------------------------------------------------------------------
  // 2️⃣ Input handling & button enable‑logic
  // -----------------------------------------------------------------------
  it("enables the Run button when there is non‑empty input", () => {
    render(
      <UsageProvider>
        <DuoArena />
      </UsageProvider>
    );

    const textarea = screen.getByPlaceholderText(/Type a prompt/i) as HTMLTextAreaElement;
    const runBtn = screen.getByRole("button", { name: /run/i });

    expect(runBtn).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "test prompt" } });
    expect(textarea.value).toBe("test prompt");
    expect(runBtn).toBeEnabled();
  });

  // -----------------------------------------------------------------------
  // 3️⃣ Clicking Run triggers two parallel streams
  // -----------------------------------------------------------------------
  it("calls streamChat twice with the correct payloads and disables the button while generating", async () => {
    render(
      <UsageProvider>
        <DuoArena />
      </UsageProvider>
    );

    const textarea = screen.getByPlaceholderText(/Type a prompt/i) as HTMLTextAreaElement;
    const runBtn = screen.getByRole("button", { name: /run/i });

    // 1. Nhập prompt & Run
    fireEvent.change(textarea, { target: { value: "hello both" } });
    fireEvent.click(runBtn);

    // 2. Nút Run bị disabled trong quá trình generate
    expect(runBtn).toBeDisabled();

    // 3. Đợi cả 2 call streamChat kích hoạt
    await waitFor(() => {
      expect(llmService.streamChat).toHaveBeenCalledTimes(2);
    });

    // Verify Model A & B params
    const firstCall = vi.mocked(llmService.streamChat).mock.calls[0][0];
    expect(firstCall.provider).toBe("groq");
    expect(firstCall.model).toBe("openai/gpt-oss-120b");
    expect(firstCall.messages[0].content).toBe("hello both");

    const secondCall = vi.mocked(llmService.streamChat).mock.calls[1][0];
    expect(secondCall.provider).toBe("openrouter");
    expect(secondCall.model).toBe("openrouter/free");

    // 4. Kiểm tra nút Stop hết disabled (stream đã chạy xong)
    const stopButtons = screen.getAllByTestId("stop-btn");
    await waitFor(() => {
      expect(stopButtons[0]).toBeDisabled();
      expect(stopButtons[1]).toBeDisabled();
    });

    // 5. Nhập tin nhắn mới để kích hoạt lại nút Run
    fireEvent.change(textarea, { target: { value: "next prompt" } });
    expect(runBtn).toBeEnabled();
  });

  // -----------------------------------------------------------------------
  // 4️⃣ Stop button aborts the underlying AbortController
  // -----------------------------------------------------------------------
  it("invokes AbortController.abort when the Stop button of a stream is pressed", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");

    render(
      <UsageProvider>
        <DuoArena />
      </UsageProvider>
    );

    const textarea = screen.getByPlaceholderText(/Type a prompt/i) as HTMLTextAreaElement;
    const runBtn = screen.getByRole("button", { name: /run/i });

    fireEvent.change(textarea, { target: { value: "prompt" } });
    fireEvent.click(runBtn);

    const stopButtons = screen.getAllByTestId("stop-btn");
    expect(stopButtons).toHaveLength(2);

    // Click stop on model A
    fireEvent.click(stopButtons[0]);

    expect(abortSpy).toHaveBeenCalled();

    abortSpy.mockRestore();
  });

  // ---------------------------------------------------------------------
  // 5️⃣ Regression: left stream fails after first chunk, right stays alive
  // ---------------------------------------------------------------------
  it("left stream fails after first chunk while right stream stays alive and then finishes", async () => {
    // ---------------------------------------------------------------
    // Synchronisation helpers – we need to know exactly when the left
    // error message appears before letting the right side emit.
    // ---------------------------------------------------------------

    let releaseRightStream!: () => void;
    const rightCanProceed = new Promise<void>((resolve) => {
      releaseRightStream = resolve;
    });

    // ---------------------------------------------------------------
    // Mock implementations for the two streams
    // ---------------------------------------------------------------
    // Left stream – emit "Hello" then throw an error
    vi.mocked(llmService.streamChat).mockImplementationOnce(async ({ outChunk }: any) => {
      // Emit the first chunk, then wait longer than the component's flush interval
      // (FLUSH_INTERVAL_MS = 120) before throwing the error. This gives the UI
      // time to flush the buffered "Hello" into the assistant message.
      outChunk("Hello");
      await new Promise((r) => setTimeout(r, 130));
      throw new Error("Left‑stream failure");
    });

    // Right stream – wait for left error, then emit normal content
    vi.mocked(llmService.streamChat).mockImplementationOnce(
      async ({ outChunk, onUsageComplete }: any) => {
        await rightCanProceed; // ensure left error is visible first

        outChunk("World");
        outChunk("!");
        onUsageComplete?.({
          prompt_tokens: 5,
          completion_tokens: 5,
          total_tokens: 10,
          time_to_first_token_ms: 120,
          tokens_per_second: 10,
        });
      }
    );

    // ---------------------------------------------------------------
    // Render component and trigger both streams
    // ---------------------------------------------------------------
    render(
      <UsageProvider>
        <DuoArena />
      </UsageProvider>
    );

    const textarea = screen.getByPlaceholderText(/Type a prompt/i) as HTMLTextAreaElement;
    const runBtn = screen.getByRole("button", { name: /run/i });

    fireEvent.change(textarea, { target: { value: "test both" } });
    fireEvent.click(runBtn);

    // ---------------------------------------------------------------
    // Assertions
    // ---------------------------------------------------------------
    // Left side should show the first chunk "Hello"
    await waitFor(() => {
      const leftWindow = screen.getAllByTestId("stream-window")[0];
      expect(within(leftWindow).getByText(/Hello/)).toBeInTheDocument();
    });

    // Left side error message appears
    await waitFor(() => {
      expect(screen.getByText(/Left‑stream failure/)).toBeInTheDocument();
    });
    // Left button is disabled, right button is still enabled (stream still running)
    const stopButtons = screen.getAllByTestId("stop-btn");
    expect(stopButtons[0]).toBeDisabled(); // left (error path)
    expect(stopButtons[1]).toBeEnabled(); // right (normal completion)

    releaseRightStream!(); // allow the right stream to proceed

    // After the left‑side error is displayed, the right side should emit its
    // content. We simply wait for the right‑side messages to appear.
    const rightWindow = screen.getAllByTestId("stream-window")[1];
    await waitFor(() => {
      expect(within(rightWindow).getByText(/World/)).toBeInTheDocument();
      expect(within(rightWindow).getByText(/!/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(stopButtons[0]).toBeDisabled(); // left (error path)
      expect(stopButtons[1]).toBeDisabled(); // right (normal completion)
    });
  });
});
