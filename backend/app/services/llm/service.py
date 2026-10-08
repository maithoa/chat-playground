from typing import Callable, Dict, Any, List, AsyncGenerator, Optional
from app.core.config import settings
from .base import BaseLLMHandler
from .openrouter_handler import OpenRouterHandler
from .groq_handler import GroqHandler
from .google_handler import GoogleHandler
from .catalog import PROVIDERS_CATALOG
from app.schemas.llm import ProviderInfo, ModelInfo
from loguru import logger
from app.schemas.llm import StreamEvent, StreamEventType


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
    def on_usage_complete(cls, usage_data: Dict[str, Any]):
        # This method can be used to handle usage data, e.g., logging or storing it.
        # For now, we just print it. In a real application, you might want to store it in a database.

        logger.info(f"LLM Service--Record--Usage data: {usage_data}")

    @classmethod
    async def stream_chat(
        cls,
        provider: str,
        model: str,
        messages: List[Dict[str, Any]],
        **kwargs,
    ) -> AsyncGenerator[StreamEvent, None]:

        cls._ensure_init_handlers()
        handler = cls._handlers.get(provider)
        if not handler:
            raise ValueError(f"Provider {provider} does not have API key configured.")

        # ``handler.stream_chat`` is expected to be an async generator. We simply
        # iterate over it directly. Tests mock this method with a ``MagicMock``
        # that returns an async generator, so no special await handling is
        # required.
        async for streamEvent in handler.stream_chat(
            model=model,
            messages=messages,
            **kwargs,
        ):
            if streamEvent.type == StreamEventType.USAGE:
                cls.on_usage_complete(streamEvent.data)

            yield streamEvent
