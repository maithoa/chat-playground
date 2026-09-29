from typing import Dict
from app.schemas.llm import ModelInfo, ProviderInfo

PROVIDERS_CATALOG: Dict[str, ProviderInfo] = {
    "openai": ProviderInfo(
        id="openai",
        name="OpenAI",
        models=[
            ModelInfo(
                id="gpt-4o",
                name="GPT-4o",
                context_window=128000,
            ),
            ModelInfo(
                id="gpt-4o-mini",
                name="GPT-4o Mini",
                context_window=128000,
            ),
        ],
    ),
    "groq": ProviderInfo(
        id="groq",
        name="Groq Cloud",
        models=[
            ModelInfo(
                id="llama-3.3-70b-versatile",
                name="Llama 3.3 70B",
                context_window=128000,
            ),
        ],
    ),
    "google": ProviderInfo(
        id="google",
        name="Google Gemini",
        models=[
            ModelInfo(
                id="gemini-2.0-flash",
                name="Gemini 2.0 Flash",
                context_window=1048576,
            ),
            ModelInfo(
                id="gemini-1.5-pro",
                name="Gemini 1.5 Pro",
                context_window=2097152,
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
