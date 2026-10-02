import React, { useEffect, useState, useRef } from "react";
import type { ProviderInfo } from "../types/llm";
import { env } from "../config/env";

interface SendMsgToModelProps {
    // Send message to backend
    onSend: (providerId: string, modelId: string) => void;
    disabled?: boolean;
}

export const SendMsgToModel: React.FC<SendMsgToModelProps> = ({
    onSend,
    disabled = false,
}) => {
    // 1. Data States
    const [providers, setProviders] = useState<ProviderInfo[]>([]);
    const [selectedProviderId, setSelectedProviderId] = useState<string>("");
    const [selectedModelId, setSelectedModelId] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // 2. UI States (Manage Custom Dropdown)
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const providersEndpoint = `${env.API_BASE_URL}/llm/providers`;

    // Hook: Get data of providers & models
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

    // Hook: Handle "Click Outside" to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        // Listen to clicking outside event
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Helper: Find the selected model to show on the button
    const getSelectedModelName = () => {
        const p = providers.find((p) => p.id === selectedProviderId);
        const m = p?.models.find((m) => m.id === selectedModelId);
        return m ? m.name : "Select Model";
    };

    // Action when select a model from the list
    const handleSelectModel = (providerId: string, modelId: string) => {
        setSelectedProviderId(providerId);
        setSelectedModelId(modelId);
        setIsOpen(false); // Đóng menu
    };

    if (loading) return <div className="text-sm text-gray-500">Loading Models...</div>;
    if (error) return <div className="text-sm text-red-500">⚠ {error}</div>;
    if (providers.length === 0) return null;

    return (
        // Wrapper contains the component
        <div className="relative inline-flex rounded-md shadow-sm" ref={dropdownRef}>

            {/* Main button to Send */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => onSend(selectedProviderId, selectedModelId)}
                className={`
                    relative inline-flex items-center rounded-l-md px-4 py-2 text-sm font-semibold text-white
                    ${disabled ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}
                    focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500
                `}
            >
                Send via {getSelectedModelName()}
            </button>

            {/* Arrow: Open/Close Dropdown */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    relative -ml-px inline-flex items-center rounded-r-md px-2 py-2 text-white border-l border-blue-400
                    ${disabled ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}
                    focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500
                `}
            >
                {/* Icon  */}
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>

            {/* Dropdown Menu (show when isOpen === true) */}
            {isOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-64 origin-bottom-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50 overflow-hidden">
                    <div className="max-h-64 overflow-y-auto py-1">
                        {providers.map((provider) => (
                            <div key={provider.id}>
                                {/* Header of Group (Provider name) */}
                                <div className="bg-gray-50 px-4 py-1.5 text-xs font-bold text-gray-500 tracking-wider">
                                    {provider.name}
                                </div>

                                {/* List of models from the provider */}
                                {provider.models.map((model) => (
                                    <button
                                        key={model.id}
                                        onClick={() => handleSelectModel(provider.id, model.id)}
                                        className={`
                                            block w-full text-left px-4 py-2 text-sm hover:bg-blue-50
                                            ${selectedModelId === model.id ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-700"}
                                        `}
                                    >
                                        <div className="flex items-center justify-between">
                                            {model.name}
                                            {selectedModelId === model.id && (
                                                <span className="text-blue-600 text-xs">✓</span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
