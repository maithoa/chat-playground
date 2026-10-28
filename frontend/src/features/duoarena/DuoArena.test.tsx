import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DuoArena } from "./DuoArena";
import * as llmService from "@/services/llmService";
import { UsageProvider } from "@/context/UsageContext";

// ---------------------------------------------------------------------------
// Mock heavy children
// ---------------------------------------------------------------------------
vi.mock("@/components/Module/StreamWindow", () => ({
  StreamWindow: ({ isGenerating, onStop }: any) => (
    <div data-testid="stream-window">
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
    document.body.innerHTML = "";
    vi.clearAllMocks();

    // Default implementation for streamChat mock
    vi.mocked(llmService.streamChat).mockImplementation(
      async ({ outChunk, onUsageComplete }: any) => {
        // Yield a tiny microtask delay
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

    const textarea = screen.getByPlaceholderText(
      /Type a message for both models/i
    ) as HTMLTextAreaElement;
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

    const textarea = screen.getByPlaceholderText(
      /Type a message for both models/i
    ) as HTMLTextAreaElement;
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

    const textarea = screen.getByPlaceholderText(
      /Type a message for both models/i
    ) as HTMLTextAreaElement;
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

    const textarea = screen.getByPlaceholderText(
      /Type a message for both models/i
    ) as HTMLTextAreaElement;
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
});
