import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ModelPairSelector } from "./ModelPairSelector";

// ---------------------------------------------------------------------------
// Helper to mock the global fetch API
// ---------------------------------------------------------------------------
type ProviderInfo = {
  id: string;
  name: string;
  is_active: boolean;
  models: { id: string; name: string; provider_id: string }[];
};

const mockFetch = (response: ProviderInfo[] | null, ok = true) => {
  vi.spyOn(global, "fetch").mockImplementation(
    () =>
      new Promise((resolve) => {
        setTimeout(() => {
          if (response === null) {
            // Simulate network error
            resolve(Promise.reject(new Error("Network error")) as unknown as Response);
          } else {
            resolve({
              ok,
              json: async () => response,
            } as Response);
          }
        }, 10);
      })
  );
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1️⃣ Loading state – component returns null before data arrives
// ---------------------------------------------------------------------------
describe("ModelPairSelector – loading state", () => {
  it("renders nothing while providers are being fetched", async () => {
    // fetch resolves after a short delay, giving the component a moment in
    // loading state.
    mockFetch([]);

    render(<ModelPairSelector onSelectPair={vi.fn()} />);

    // The button that expands the selector must not be in the document yet.
    expect(
      screen.queryByRole("button", { name: /Change Comparison Models/i })
    ).toBeNull();

    // Wait for the fetch to settle so the component unmounts (null → null)
    await waitFor(() => {
      // After loading finishes the component will still render null because
      // there are no models (totalModels = 0). The test just ensures the
      // loading path ran without throwing.
      expect(screen.queryByRole("button")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 2️⃣ Error handling – fetch fails
// ---------------------------------------------------------------------------
describe("ModelPairSelector – error handling", () => {
  it("returns null when the providers endpoint errors", async () => {
    // Simulate a network error
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

    render(<ModelPairSelector onSelectPair={vi.fn()} />);

    // No UI should appear
    expect(screen.queryByText(/Change Comparison Models/i)).toBeNull();

    // Allow the effect to run and finish
    await waitFor(() => {
      expect(screen.queryByText(/Change Comparison Models/i)).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 3️⃣ Insufficient data – total models <= 2
// ---------------------------------------------------------------------------
describe("ModelPairSelector – insufficient models", () => {
  it("renders nothing when total models are <= 2", async () => {
    const providers: ProviderInfo[] = [
      {
        id: "groq",
        name: "Groq",
        is_active: true,
        models: [
          { id: "m1", name: "Model 1", provider_id: "groq" },
          { id: "m2", name: "Model 2", provider_id: "groq" },
        ],
      },
    ];
    mockFetch(providers);

    render(<ModelPairSelector onSelectPair={vi.fn()} />);

    // Wait for the fetch to resolve
    await waitFor(() => {
      expect(screen.queryByText(/Change Comparison Models/i)).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 4️⃣ Full workflow – expand, select two models, apply
// ---------------------------------------------------------------------------
describe("ModelPairSelector – happy path", () => {
  const providers: ProviderInfo[] = [
    {
      id: "groq",
      name: "Groq",
      is_active: true,
      models: [
        { id: "gpt-oss", name: "GPT‑OSS", provider_id: "groq" },
        { id: "nemo", name: "Nemo", provider_id: "groq" },
        { id: "extra1", name: "Extra 1", provider_id: "groq" },
      ],
    },
    {
      id: "gemini",
      name: "Google Gemini",
      is_active: true,
      models: [
        { id: "gem-1", name: "Gemini-1", provider_id: "gemini" },
        { id: "gem-2", name: "Gemini-2", provider_id: "gemini" },
        { id: "gem-3", name: "Gemini-3", provider_id: "gemini" },
        { id: "gem-4", name: "Gemini-4", provider_id: "gemini" },
      ],
    },
  ];

  beforeEach(() => {
    mockFetch(providers);
  });

  it("calls onSelectPair with defaults on mount", async () => {
    const onSelectPair = vi.fn();
    render(<ModelPairSelector onSelectPair={onSelectPair} />);

    // The effect that fires on mount is synchronous – the callback should be
    // called exactly once with the hard‑coded defaults.
    expect(onSelectPair).toHaveBeenCalledTimes(1);
    expect(onSelectPair).toHaveBeenCalledWith(
      { providerId: "groq", modelId: "openai/gpt-oss-120b" },
      { providerId: "openrouter", modelId: "openrouter/free" }
    );
  });

  it("expands UI when 'Change Comparison Models' is clicked", async () => {
    render(<ModelPairSelector onSelectPair={vi.fn()} />);

    // Wait for providers to load
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Change Comparison Models/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Change Comparison Models/i }));

    // Provider headers should now be visible
    expect(screen.getByText("Groq")).toBeInTheDocument();
    expect(screen.getByText("Google Gemini")).toBeInTheDocument();
  });

  it("allows selecting exactly two distinct models and enables Apply button", async () => {
    const onSelectPair = vi.fn();
    render(<ModelPairSelector onSelectPair={onSelectPair} />);

    // Open selector
    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: /Change Comparison Models/i }));
    });

    // Expand both provider accordions (they are auto‑expanded by the component)
    // Select first model from Groq
    const groqModelCheckbox = screen.getByLabelText("GPT‑OSS") as HTMLInputElement;
    fireEvent.click(groqModelCheckbox);
    expect(groqModelCheckbox.checked).toBe(true);

    // Apply button should still be disabled (only one selection)
    expect(
      screen.getByRole("button", { name: /Apply selections to compare/i })
    ).toBeDisabled();

    // Select a model from Gemini
    const geminiModelCheckbox = screen.getByLabelText("Gemini-2") as HTMLInputElement;
    fireEvent.click(geminiModelCheckbox);
    expect(geminiModelCheckbox.checked).toBe(true);

    // Now Apply should be enabled
    const applyBtn = screen.getByRole("button", { name: /Apply selections to compare/i });
    expect(applyBtn).toBeEnabled();

    // Click Apply
    fireEvent.click(applyBtn);

    // onSelectPair should be called a second time with the user selections
    expect(onSelectPair).toHaveBeenCalledTimes(2);
    expect(onSelectPair).toHaveBeenLastCalledWith(
      { providerId: "groq", modelId: "gpt-oss" },
      { providerId: "gemini", modelId: "gem-2" }
    );

    // UI should collapse back to the single button view
    expect(screen.queryByText("Groq")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Change Comparison Models/i })
    ).toBeInTheDocument();
  });

  it("disables remaining checkboxes after two selections are made", async () => {
    render(<ModelPairSelector onSelectPair={vi.fn()} />);

    // Open selector
    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: /Change Comparison Models/i }));
    });

    // Select two models
    fireEvent.click(screen.getByLabelText("GPT‑OSS"));
    fireEvent.click(screen.getByLabelText("Gemini-1"));

    // All other checkboxes must now be disabled
    const otherCheckboxes = screen
      .getAllByRole("checkbox")
      .filter((cb) => !(cb as HTMLInputElement).checked);
    otherCheckboxes.forEach((cb) => {
      expect(cb).toBeDisabled();
    });
  });

  it("cancels selection without invoking onSelectPair", async () => {
    const onSelectPair = vi.fn();
    render(<ModelPairSelector onSelectPair={onSelectPair} />);

    // Open selector
    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: /Change Comparison Models/i }));
    });

    // Choose one model then click Cancel
    fireEvent.click(screen.getByLabelText("Nemo"));
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    // UI collapses
    expect(screen.queryByText("Groq")).toBeNull();

    // onSelectPair should still have only the default call from mount
    expect(onSelectPair).toHaveBeenCalledTimes(1);
  });
});
