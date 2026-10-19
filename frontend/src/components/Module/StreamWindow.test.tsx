// frontend/src/components/Module/StreamWindow.test.tsx
/**
 * Unit tests for {@link StreamWindow}.
 *
 * The component is pure UI – it receives a list of {@link Message} objects,
 * an optional `isGenerating` flag and an `onStop` callback.  Tests verify:
 *
 * 1️⃣ Rendering of user vs. assistant bubbles (CSS classes).
 * 2️⃣ Rendering of the “Thinking…” placeholder for assistant messages
 *    without content.
 * 3️⃣ Proper enable/disable state of the Stop button and that clicks call
 *    the supplied callback.
 * 4️⃣ That {@link ConversationTokenCounter} receives the expected props.
 * 5️⃣ That the scrolling helper calls `HTMLElement.scrollTo` with the
 *    correct behaviour flag depending on `isGenerating`.
 *
 * The test environment is **vitest** + **happy-dom** (already declared in the
 * project’s test dependencies).  Heavy child components and the Lucide icon
 * are mocked to keep the suite fast and focused on the component’s logic.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Message } from "@/types/chat";
import { StreamWindow } from "./StreamWindow";

// ---------------------------------------------------------------------------
// Mock heavy dependencies
// ---------------------------------------------------------------------------
let capturedProps: any = null;

beforeEach(() => {
  capturedProps = null;
});

vi.mock("@/components/Button/ConversationTokenCounter", () => ({
  ConversationTokenCounter: (props: any) => {
    capturedProps = props; // 👉 Sẽ bắt được props chính xác từ StreamWindow truyền xuống
    return <div data-testid="token-counter" />;
  },
}));

vi.mock("lucide-react", async () => {
  const actual = await vi.importActual<typeof import("lucide-react")>("lucide-react");
  return {
    ...actual,
    Coffee: () => <span data-testid="coffee-icon" />,
    Cpu: () => <span data-testid="cpu-icon" />,
  };
});

// ---------------------------------------------------------------------------
// Helper to create a minimal Message array
// ---------------------------------------------------------------------------
const makeMessage = (
  role: "user" | "assistant",
  content: string | "",
  usage?: any
): Message => ({
  role,
  content,
  usage,
});

// ---------------------------------------------------------------------------
// Reset spies / mocks before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  // Spy on the native scrollTo so we can assert calls without performing real scrolling
  vi.spyOn(HTMLElement.prototype, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("StreamWindow component", () => {
  it("renders user and assistant bubbles with correct styling", () => {
    const msgs: Message[] = [
      makeMessage("user", "Hello!"),
      makeMessage("assistant", "Hi there!"),
    ];

    render(<StreamWindow messages={msgs} isGenerating={false} onStop={() => {}} />);

    // User bubble
    const userBubble = screen.getByText("Hello!");
    // Điểm mấu chốt: Dùng .closest để tìm thẻ div bao ngoài có chứa class tạo background
    const userContainer =
      userBubble.closest(".bg-blue-600") || userBubble.parentElement?.parentElement;
    expect(userContainer).toHaveClass("bg-blue-600", "text-white");

    // Assistant bubble
    const assistantBubble = screen.getByText("Hi there!");
    const assistantContainer =
      assistantBubble.closest(".bg-gray-100") ||
      assistantBubble.parentElement?.parentElement;
    expect(assistantContainer).toHaveClass("bg-gray-100", "text-gray-800");
  });
  it("shows the thinking placeholder for assistant messages without content", () => {
    const msgs: Message[] = [makeMessage("assistant", "")];

    render(<StreamWindow messages={msgs} isGenerating={false} onStop={() => {}} />);

    // The placeholder text should be present
    expect(screen.getByText("Thinking....")).toBeInTheDocument();
    // The mocked Coffee icon should also be rendered
    expect(screen.getByTestId("coffee-icon")).toBeInTheDocument();
  });

  it("disables Stop button when not generating and enables it when generating", () => {
    const msgs: Message[] = [];

    const { rerender } = render(
      <StreamWindow messages={msgs} isGenerating={false} onStop={() => {}} />
    );

    const stopBtn = screen.getByRole("button", { name: /stop/i });
    expect(stopBtn).toBeDisabled();

    // Switch to generating state
    rerender(<StreamWindow messages={msgs} isGenerating={true} onStop={() => {}} />);
    expect(stopBtn).toBeEnabled();
  });

  it("calls onStop when the Stop button is clicked", () => {
    const onStop = vi.fn();
    const msgs: Message[] = [];

    render(<StreamWindow messages={msgs} isGenerating={true} onStop={onStop} />);

    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  // 2. Trong test case, kiểm tra trực tiếp trên object JavaScript
  it("passes correct props to ConversationTokenCounter", () => {
    const msgs: Message[] = [
      makeMessage("assistant", "First"),
      makeMessage("assistant", "Last"),
    ];

    render(<StreamWindow messages={msgs} isGenerating={true} onStop={() => {}} />);

    // Kiểm tra trực tiếp trên object props thay vì DOM attribute
    expect(capturedProps.isStreaming).toBe(true);
    expect(capturedProps.streamingContent).toBe("Last");
    expect(capturedProps.messages).toEqual(msgs);
  });

  it("calls scrollTo with smooth behavior when not generating", () => {
    const msgs: Message[] = [makeMessage("assistant", "msg")];

    render(<StreamWindow messages={msgs} isGenerating={false} onStop={() => {}} />);

    // scrollTo is called inside useEffect after mount
    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith({
      top: expect.any(Number),
      behavior: "smooth",
    });
  });

  it("calls scrollTo with auto behavior when generating", () => {
    const msgs: Message[] = [makeMessage("assistant", "msg")];

    render(<StreamWindow messages={msgs} isGenerating={true} onStop={() => {}} />);

    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith({
      top: expect.any(Number),
      behavior: "auto",
    });
  });
});
