import React, { useEffect, useState } from "react";
import type { ProviderInfo } from "../types/llm";

interface ModelSelectorProps {
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

    const API_BASE_URL =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:8686/api/v1";

    useEffect(() => {
        const fetchProviders = async () => {
            try {
                setLoading(true);

                const res = await fetch(`${API_BASE_URL}/llm/providers`);
                if (!res.ok) throw new Error("Could not connect to backend for fetching LLM providers info.");

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
                const message = err instanceof Error ? err.message : "Unexpected error while fetching LLM providers info."
                setError(message)

            } finally {
                setLoading(false);
            }

        };
        fetchProviders();

    }, []);

    const currentProvider = providers.find(p => p.id === selectedProviderId);
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
        return <div className="text-sm text-gray-500">Loading LLM Providers...</div>;
    }

    if (error) {
        return (
            <div className="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-200">
                ⚠ {error} (Please check if Backend is running!)
            </div>
        );
    }

    return (
        <div className="flex gap-4 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Provider
                </label>
                <select
                    value={selectedProviderId}
                    onChange={handleProviderChange}
                    disabled={disabled}
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Model
                </label>
                <select
                    value={selectedModelId}
                    onChange={handleModelChange}
                    disabled={disabled || availableModels.length === 0}
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {availableModels.map((m) => (
                        <option key={m.id} value={m.id}>
                            {m.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );

};
