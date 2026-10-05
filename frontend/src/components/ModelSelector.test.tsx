import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModelSelector } from "./ModelSelector";
import type { ProviderInfo } from "../types/llm";

// Mock dữ liệu API trả về từ Backend
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

describe("ModelSelector Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("call API fetch successfully and render list of Provider/Model", async () => {
    // Mock global fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProviders,
    } as Response);

    const handleSelect = vi.fn();

    render(<ModelSelector onSelect={handleSelect} />);

    // Check first loading status
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();

    // Wait for component to complete loading data from API
    await waitFor(() => {
      expect(screen.getByText("OpenAI")).toBeInTheDocument();
      expect(screen.getByText("GPT-4o")).toBeInTheDocument();
    });

    // Check callback onSelect is autoset with the first value
    expect(handleSelect).toHaveBeenCalledWith("openai", "gpt-4o");
  });

  it("Show error when backend has issue", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
    } as Response);

    render(<ModelSelector onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/⚠/i)).toBeInTheDocument();
    });
  });
});
