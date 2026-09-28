import json
import time
from typing import AsyncGenerator, Dict, List
from openai import AsyncOpenAI

from app.core.config import settings
from app.schemas.llm import ModelInfo, ProviderInfo


class LLMService:
    PROVIDERS_CATALOG: Dict[str, ProviderInfo] = {
        "groq": ProviderInfo(
            id="groq",
            name="Groq Cloud",
            models=[
                ModelInfo(
                    id="llama-3.3-70b-versatile",
                    name="Llama 3.3 70B",
                    context_window=128000,
                ),
                ModelInfo(
                    id="llama-3.3-70b-versatile",
                    name="Llama 3.3 70B",
                    context_window=128000,
                ),
            ],
        ),
        "openrouter": ProviderInfo(
            id="openrouter",
            name="Open Router Free Tier",
            models=[
                ModelInfo(
                    id="meta-llama/llama-3.1-8b-instruct:free",
                    name="Llama 3.1 8B (Free)",
                    context_window=128000,
                ),
                ModelInfo(
                    id="google/gemma-2-9b-it:free",
                    name="Gemma 2 9B (Free)",
                    context_window=128000,
                ),
            ],
        ),
    }

    @classmethod
    def get_llm_providers(cls) -> List[ProviderInfo]:
        return list(cls.PROVIDERS_CATALOG.values())

    @classmethod
    def _get_system_key(cls, provider_id: str) -> tuple[str, str]:
        if provider_id == "groq":
            if not settings.GROQ_API_KEY:
                raise ValueError("Groq API key is not configured.")
            return settings.GROQ_API_KEY, "https://api.groq.com/openai/v1"
        elif provider_id == "openrouter":
            if not settings.OPENROUTER_API_KEY:
                raise ValueError("Open Router API key is not configured.")
            return settings.OPENROUTER_API_KEY, "https://openrouter.ai/api/v1"
        return ValueError(f"Not supported llm provider: {provider_id}")
