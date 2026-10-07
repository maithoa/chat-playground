import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SendMsgToModel } from "./SendMsgToModel";
import type { ProviderInfo } from "../types/llm";

// Mock providers data for the primary suite (basic fetch & selection)
const mockProviders: ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    is_active: true,
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    ],
  },
];

// Additional mock providers for other edge‑case tests
const mockProviders2: ProviderInfo[] = [
  {
    id: "prov-1",
    name: "Provider One",
    is_active: true,
    models: [
      { id: "model-a", name: "Model A" },
      { id: "model-b", name: "Model B" },
    ],
  },
  {
    id: "prov-2",
    name: "Provider Two",
    is_active: true,
    models: [{ id: "model-x", name: "Model X" }],
  },
];

describe("SendMsgToModel Component", () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches providers, allows selection, and calls onSend with chosen ids", async () => {
    // Mock global fetch to return the first provider set
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockProviders } as Response)
    );

    const handleSend = vi.fn();
    render(<SendMsgToModel onSend={handleSend} />);

    // Loading indicator appears
    expect(screen.getByText(/Loading Models/i)).toBeInTheDocument();

    // Open the dropdown (second button) after providers are loaded
    await waitFor(() => {
      expect(screen.getAllByRole("button")[1]).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole("button")[1]);

    // Wait for provider and model options to appear in the dropdown
    await waitFor(() => {
      expect(screen.getByText("OpenAI")).toBeInTheDocument();
      expect(screen.getByText("GPT-4o")).toBeInTheDocument();
    });

    // Choose a model
    const modelOption = await screen.findByText("GPT-4o");
    fireEvent.click(modelOption);

    // Click the main Send button (label contains "Send via")
    const sendBtn = screen.getByRole("button", { name: /Send via/i });
    fireEvent.click(sendBtn);

    expect(handleSend).toHaveBeenCalledWith("openai", "gpt-4o");
  });

  it("shows loading indicator while fetching providers", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => mockProviders2 } as Response)
    );
    render(<SendMsgToModel onSend={vi.fn()} />);
    expect(screen.getByText(/Loading Models\.{3}/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("button")[1]).toBeInTheDocument());
  });

  it("displays error message when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, statusText: "Bad Gateway" } as Response)
    );
    render(<SendMsgToModel onSend={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/⚠/i)).toBeInTheDocument());
    // The component displays a generic error message when fetch fails
    expect(screen.getByText(/Could not connect to backend\./i)).toBeInTheDocument();
  });

  it("renders dropdown button and opens menu on click", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => mockProviders2 } as Response)
    );
    render(<SendMsgToModel onSend={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByRole("button")[1]).toBeInTheDocument());

    // Open dropdown (second button)
    fireEvent.click(screen.getAllByRole("button")[1]);
    await waitFor(() => {
      expect(screen.getByText("Model A")).toBeInTheDocument();
      expect(screen.getByText("Model B")).toBeInTheDocument();
    });
  });

  it("calls onSend with selected provider and model", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => mockProviders2 } as Response)
    );
    const onSend = vi.fn();
    render(<SendMsgToModel onSend={onSend} />);
    await waitFor(() => expect(screen.getAllByRole("button")[1]).toBeInTheDocument());

    // Open menu and pick a model from the second provider
    fireEvent.click(screen.getAllByRole("button")[1]);
    await waitFor(() => screen.getByText("Model X"));
    fireEvent.click(screen.getByText("Model X"));

    const sendBtn = screen.getByRole("button", { name: /Send via/i });
    fireEvent.click(sendBtn);

    expect(onSend).toHaveBeenCalledOnce();
    expect(onSend).toHaveBeenCalledWith("prov-2", "model-x");
  });

  it("disables both buttons when disabled prop is true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockProviders } as Response)
    );
    render(<SendMsgToModel onSend={vi.fn()} disabled={true} />);
    await waitFor(() =>
      expect(screen.queryByText(/Loading Models\\.{3}/i)).not.toBeInTheDocument()
    );

    const mainBtn = screen.getByRole("button", { name: /Send via/i });
    const arrowBtn = screen.getAllByRole("button")[1];
    expect(mainBtn).toBeDisabled();
    expect(arrowBtn).toBeDisabled();
  });
});

// ChatBox component unit tests – handleSend edge cases
// Duplicate imports removed – ChatBox already imported at top

// ------------------------------------------------------------------
// Mock external services & child components
// ------------------------------------------------------------------
vi.mock("../services/llmService", () => ({
  streamChat: vi.fn(),
}));

vi.mock("./ConversationTokenCounter", () => ({
  ConversationTokenCounter: () => <div data-testid="token-counter" />,
}));

/* Removed duplicated ChatBox.handleSend tests – they are defined in ChatBox.test.tsx */
