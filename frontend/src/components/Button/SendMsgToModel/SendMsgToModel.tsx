import React, { useEffect, useState, useRef } from "react";
import type { ProviderInfo } from "@/types/llm";
import { env } from "@/config/env";
import { ChevronDown, Check } from "lucide-react";

export interface SendMsgToModelProps {
  onSend: (providerId: string, modelId: string) => void;
  disabled?: boolean;
}

export const SendMsgToModel: React.FC<SendMsgToModelProps> = ({
  onSend,
  disabled = false,
}) => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const providersEndpoint = `${env.API_BASE_URL}/llm/providers`;

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoading(true);
        const res = await fetch(providersEndpoint);
        if (!res.ok) throw new Error("Could not connect to backend.");

        const data: ProviderInfo[] = await res.json();
        setProviders(data);

        if (data.length > 0 && data[0].models.length > 0) {
          setSelectedProviderId(data[0].id);
          setSelectedModelId(data[0].models[0].id);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Fetch error.");
      } finally {
        setLoading(false);
      }
    };
    fetchProviders();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getSelectedModelName = () => {
    const p = providers.find((p) => p.id === selectedProviderId);
    const m = p?.models.find((m) => m.id === selectedModelId);
    return m ? m.name : "Select Model";
  };

  const handleSelectModel = (providerId: string, modelId: string) => {
    setSelectedProviderId(providerId);
    setSelectedModelId(modelId);
    setIsOpen(false);
  };

  if (loading)
    return <div className="text-xs text-slate-500 font-mono py-1">Loading Models...</div>;
  if (error) return <div className="text-xs text-rose-400 font-mono py-1">⚠ {error}</div>;
  if (providers.length === 0) return null;

  return (
    <div className="relative inline-flex rounded-lg shadow-sm" ref={dropdownRef}>
      {/* Main Send Button */}
      <button
        type="submit"
        disabled={disabled}
        data-testid="send-msg-button"
        aria-label="Send via"
        onClick={() => onSend(selectedProviderId, selectedModelId)}
        className={`
          relative inline-flex items-center rounded-l-lg px-3.5 py-2 text-xs font-semibold transition-all duration-150
          ${
            disabled
              ? "bg-slate-800/50 text-slate-600 border border-slate-800/80 cursor-not-allowed select-none shadow-none"
              : "bg-white text-slate-900 border border-slate-300 shadow-sm hover:bg-slate-100 active:scale-[0.98] cursor-pointer"
          }
          focus:z-10 focus:outline-none
        `}
      >
        Send via {getSelectedModelName()}
      </button>

      {/* Dropdown Toggle Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select model options"
        className={`
          relative -ml-px inline-flex items-center rounded-r-lg px-2 py-2 transition-all duration-150 border-l border-slate-300
          ${
            disabled
              ? "bg-slate-800/50 text-slate-600 border border-slate-800/80 cursor-not-allowed select-none shadow-none"
              : "bg-white text-slate-900 border-y border-r border-slate-300 shadow-sm hover:bg-slate-100 active:scale-[0.98] cursor-pointer"
          }
          focus:z-10 focus:outline-none
        `}
      >
        <ChevronDown
          className={`h-4 w-4 text-slate-700 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-72 origin-bottom-right rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-800/90 shadow-2xl z-50 overflow-hidden">
          <div className="max-h-64 overflow-y-auto py-1.5 scrollbar-thin scrollbar-thumb-slate-800">
            {providers.map((provider) => (
              <div key={provider.id} className="first:mt-0 mt-1">
                <div className="bg-slate-950/60 px-4 py-1.5 text-[11px] font-bold text-slate-400 tracking-wider uppercase border-y border-slate-800/50">
                  {provider.name}
                </div>
                {provider.models.map((model) => {
                  const isSelected = selectedModelId === model.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleSelectModel(provider.id, model.id)}
                      className={`
                        block w-full text-left px-4 py-2.5 text-xs transition-colors cursor-pointer
                        ${
                          isSelected
                            ? "bg-slate-800/80 text-sky-400 font-semibold border-l-2 border-sky-400"
                            : "text-slate-300 hover:bg-slate-800/40 hover:text-slate-100"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate pr-2">{model.name}</span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
