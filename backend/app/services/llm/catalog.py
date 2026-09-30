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
                id="openai/gpt-oss-120b",
                name="GPT OSS 120B",
                context_window=128000,
            ),
            ModelInfo(
                id="qwen/qwen3.8-27b",
                name="Qwen 3.8-27B",
                context_window=128000,
            ),
        ],
    ),
    "google": ProviderInfo(
        id="google",
        name="Google Gemini",
        models=[
            ModelInfo(
                id="gemini-3.5-flash",
                name="Gemini 3.5 Flash",
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
                id="openrouter/free",
                name="Open Router Free",
                context_window=128000,
            ),
        ],
    ),
}
