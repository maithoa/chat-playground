import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the heavy child components so the test focuses on the tab‑switching logic
// ---------------------------------------------------------------------------
vi.mock("./features/chatbox/ChatBox", () => ({
  ChatBox: () => <div data-testid="chatbox-mock">ChatBox Mock</div>,
}));

vi.mock("./features/duoarena/DuoArena", () => ({
  DuoArena: () => <div data-testid="duoarena-mock">DuoArena Mock</div>,
}));

// ---------------------------------------------------------------------------
// Import the component under test *after* the mocks are set up
// ---------------------------------------------------------------------------
import App from "./App";

describe("App component – tab navigation", () => {
  beforeEach(() => {
    // Ensure a clean DOM for each test
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the header with title and both tab buttons", () => {
    render(<App />);

    // Header title
    expect(screen.getByText("LLM Chat Playground")).toBeInTheDocument();

    // Tab buttons
    expect(screen.getByRole("button", { name: /Single Chat/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Duo Arena/i })).toBeInTheDocument();
  });

  it("shows ChatBox by default (activeTab = 'chat')", () => {
    render(<App />);

    // The mocked ChatBox component should be present
    expect(screen.getByTestId("chatbox-mock")).toBeInTheDocument();
    // DuoArena must not be rendered
    expect(screen.queryByTestId("duoarena-mock")).not.toBeInTheDocument();
  });

  it("switches to DuoArena when the Duo Arena tab is clicked", () => {
    render(<App />);

    const arenaBtn = screen.getByRole("button", { name: /Duo Arena/i });
    fireEvent.click(arenaBtn);

    // After click, DuoArena mock should appear
    expect(screen.getByTestId("duoarena-mock")).toBeInTheDocument();
    // ChatBox mock should be removed
    expect(screen.queryByTestId("chatbox-mock")).not.toBeInTheDocument();
  });

  it("toggles back to ChatBox when the Single Chat tab is clicked after switching", () => {
    render(<App />);

    // Switch to arena first
    fireEvent.click(screen.getByRole("button", { name: /Duo Arena/i }));
    expect(screen.getByTestId("duoarena-mock")).toBeInTheDocument();

    // Switch back to chat
    fireEvent.click(screen.getByRole("button", { name: /Single Chat/i }));
    expect(screen.getByTestId("chatbox-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("duoarena-mock")).not.toBeInTheDocument();
  });

  it("switches active tabs status correctly", () => {
    render(<App />);

    const chatBtn = screen.getByRole("button", { name: /Single Chat/i });
    const arenaBtn = screen.getByRole("button", { name: /Duo Arena/i });

    // Ban đầu Single Chat active (aria-pressed = true)
    expect(chatBtn).toHaveAttribute("aria-pressed", "true");
    expect(arenaBtn).toHaveAttribute("aria-pressed", "false");

    // Click chuyển sang Duo Arena
    fireEvent.click(arenaBtn);

    // Sau khi click, Duo Arena active, Single Chat inactive
    expect(arenaBtn).toHaveAttribute("aria-pressed", "true");
    expect(chatBtn).toHaveAttribute("aria-pressed", "false");
  });
});
