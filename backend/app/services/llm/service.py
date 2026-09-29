from typing import Dict, Any, List, AsyncGenerator
from app.core.config import settings
from .base import BaseLLMHandler
from .openrouter_handler import OpenRouterHandler
from .groq_handler import GroqHandler
from .google_handler import GoogleHandler
from .catalog import PROVIDERS_CATALOG
from app.schemas.llm import ProviderInfo, ModelInfo


class LLMService:

    _handlers: Dict[str, BaseLLMHandler] = {}

    @classmethod
    def _ensure_init_handlers(cls):
        if settings.OPENROUTER_API_KEY:
            cls._handlers["openrouter"] = OpenRouterHandler()
        if settings.GROQ_API_KEY:
            cls._handlers["groq"] = GroqHandler()
        if settings.GOOGLE_API_KEY:
            cls._handlers["google"] = GoogleHandler()

    @classmethod
    def get_llm_providers(cls) -> List[ProviderInfo]:

        cls._ensure_init_handlers()

        return [
            provider_info
            for provider_id, provider_info in PROVIDERS_CATALOG.items()
            if provider_id in cls._handlers
        ]

    @classmethod
    async def stream_chat(
        cls, provider: str, model: str, messages: List[Dict[str, Any]], **kwargs
    ) -> AsyncGenerator[str, None]:

        cls._ensure_init_handlers()
        handler = cls._handlers.get(provider)
        if not handler:
            raise ValueError(f"Provider {provider} does not have API key configured.")

        async for chunk in handler.stream_chat(
            model=model, messages=messages, **kwargs
        ):
            yield chunk
