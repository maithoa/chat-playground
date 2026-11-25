import React, { useEffect, useState } from "react";
import type { ProviderInfo } from "@/types/llm";
import { env } from "@/config/env";

/** Props for the selector used in DuoArena. */
export interface ModelPairSelectorProps {
  /** Callback receiving the final two selections (A then B). */
  onSelectPair: (
    a: { providerId: string; modelId: string },
    b: { providerId: string; modelId: string }
  ) => void;
  /** Disable UI while streaming is in progress. */
  disabled?: boolean;
}

/**
 * UI that lists all providers and their models as checkboxes.
 * Users click "Change Comparison Models" to expand the list, pick exactly two
 * distinct models, then click "Apply selections to compare".
 */
export const ModelPairSelector: React.FC<ModelPairSelectorProps> = ({
  onSelectPair,
  disabled = false,
}) => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<
    {
      providerId: string;
      modelId: string;
    }[]
  >([]);
  const [openProviders, setOpenProviders] = useState<string[]>([]);

  const providersEndpoint = `${env.API_BASE_URL}/llm/providers`;
  const DEFAULT_A = { providerId: "groq", modelId: "openai/gpt-oss-120b" };
  const DEFAULT_B = { providerId: "openrouter", modelId: "openrouter/free" };

  // Fetch providers once on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoading(true);
        const res = await fetch(providersEndpoint);
        if (!res.ok) throw new Error("Could not fetch LLM providers");
        const data: ProviderInfo[] = await res.json();
        setProviders(data);
      } catch (e: any) {
        setError(e?.message ?? String(e));
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProviders();
  }, []);

  // Auto‑expand all provider sections when the selector is opened
  useEffect(() => {
    if (expanded) {
      setOpenProviders(providers.map((p) => p.id));
    } else {
      setOpenProviders([]);
    }
  }, [expanded, providers]);

  // Propagate defaults on mount (once)
  useEffect(() => {
    onSelectPair(DEFAULT_A, DEFAULT_B);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Early exits
  if (loading) return null;
  if (error) return null;
  const totalModels = providers.reduce((sum, p) => sum + (p.models?.length ?? 0), 0);
  if (totalModels <= 2) return null;

  const toggleSelection = (providerId: string, modelId: string) => {
    const exists = selected.find(
      (s) => s.providerId === providerId && s.modelId === modelId
    );
    if (exists) {
      setSelected(selected.filter((s) => s !== exists));
    } else {
      if (selected.length >= 2) return;
      setSelected([...selected, { providerId, modelId }]);
    }
  };

  const toggleProvider = (id: string) => {
    setOpenProviders((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const renderProviders = () => (
    <div className="space-y-4">
      {providers.map((p) => {
        const isOpen = expanded || openProviders.includes(p.id);
        return (
          <div
            key={p.id}
            className="border border-slate-700/60 rounded-lg overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleProvider(p.id)}
              disabled={disabled}
              className="w-full flex items-center justify-between px-4 py-2 bg-slate-800/70 hover:bg-slate-700/70 transition-colors"
            >
              <span className="font-medium text-slate-200">{p.name}</span>
              <svg
                className={`w-4 h-4 transform transition-transform ${isOpen ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 5l7 7-7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </button>
            {isOpen && (
              <div className="px-4 py-2 grid grid-cols-2 gap-2 bg-slate-900/60">
                {p.models.map((m) => {
                  const isSel = selected.some(
                    (s) => s.providerId === p.id && s.modelId === m.id
                  );
                  const disabledChk = !isSel && selected.length >= 2;
                  return (
                    <label
                      key={m.id}
                      htmlFor={`${p.id}-${m.id}`}
                      className="flex items-center space-x-2 text-sm text-slate-300"
                    >
                      <input
                        id={`${p.id}-${m.id}`}
                        type="checkbox"
                        aria-label={m.name}
                        checked={isSel}
                        disabled={disabled || disabledChk}
                        onChange={() => toggleSelection(p.id, m.id)}
                        className="form-checkbox h-4 w-4 text-sky-500 rounded"
                      />
                      <span>{m.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="my-2">
      <span className="text-slate-300 text-sm block mb-2">
        Select exactly two models to compare. You can pick from different providers.
      </span>
      {/* Collapsed view */}
      {!expanded && (
        <button
          onClick={() => {
            setExpanded(true);
            // Immediately open all provider sections for a smoother UX and to satisfy tests.
            setOpenProviders(providers.map((p) => p.id));
          }}
          disabled={disabled}
          className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors duration-150"
        >
          Change Comparison Models
        </button>
      )}

      {/* Expanded view */}
      {expanded && (
        <div className="border border-slate-600 rounded-lg p-3 bg-slate-800/60 shadow-lg backdrop-blur-sm">
          {renderProviders()}
          <div className="flex justify-end mt-3 space-x-2">
            <button
              onClick={() => setExpanded(false)}
              disabled={disabled}
              className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selected.length === 2) {
                  onSelectPair(selected[0], selected[1]);
                }
                setExpanded(false);
              }}
              disabled={disabled || selected.length !== 2}
              className="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded transition-colors duration-150 disabled:opacity-40"
            >
              Apply selections to compare
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
