import React, { useEffect, useState } from "react";
import type { ProviderInfo } from "@/types/llm";
import { env } from "@/config/env";

export interface ModelSelectorProps {
  onSelect: (providerId: string, modelId: string) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  onSelect,
  disabled = false,
}) => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const providersEndpoint = `${env.API_BASE_URL}/llm/providers`;

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoading(true);

        const res = await fetch(providersEndpoint);
        if (!res.ok)
          throw new Error(
            "Could not connect to backend for fetching LLM providers info."
          );

        const data: ProviderInfo[] = await res.json();
        setProviders(data);

        if (data.length > 0) {
          const firstProvider = data[0];
          setSelectedProviderId(firstProvider.id);

          if (firstProvider.models.length > 0) {
            const firstModel = firstProvider.models[0];
            setSelectedModelId(firstModel.id);
            onSelect(firstProvider.id, firstModel.id);
          }
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Unexpected error while fetching LLM providers info.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    fetchProviders();
  }, []);

  const currentProvider = providers.find((p) => p.id === selectedProviderId);
  const availableModels = currentProvider?.models || [];

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProviderId = e.target.value;
    setSelectedProviderId(newProviderId);

    const provider = providers.find((p) => p.id === newProviderId);
    const firstModelId = provider?.models[0]?.id || "";
    setSelectedModelId(firstModelId);

    onSelect(newProviderId, firstModelId);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModelId = e.target.value;
    setSelectedModelId(newModelId);
    onSelect(selectedProviderId, newModelId);
  };

  if (loading) {
    return (
      <div className="text-xs text-slate-500 font-mono py-1">
        Loading LLM Providers...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-xl border border-rose-800/60 font-mono">
        ⚠ {error} (Please check if Backend is running!)
      </div>
    );
  }

  return (
    <div className="flex gap-4 items-center bg-slate-900/80 backdrop-blur-xl p-3.5 rounded-2xl border border-slate-800/90 shadow-xl">
      <div className="flex flex-col gap-1.5 flex-1">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Provider
        </label>
        <select
          value={selectedProviderId}
          onChange={handleProviderChange}
          disabled={disabled}
          className="border border-slate-700/60 rounded-xl px-3 py-2 text-xs bg-slate-950/80 text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all cursor-pointer disabled:opacity-50"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 flex-1">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Model
        </label>
        <select
          value={selectedModelId}
          onChange={handleModelChange}
          disabled={disabled || availableModels.length === 0}
          className="border border-slate-700/60 rounded-xl px-3 py-2 text-xs bg-slate-950/80 text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all cursor-pointer disabled:opacity-50"
        >
          {availableModels.map((m) => (
            <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">
              {m.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
