from typing import Callable, Dict, Any, List, AsyncGenerator, Optional
from app.core.config import settings
from .base import BaseLLMHandler
from .openrouter_handler import OpenRouterHandler
from .groq_handler import GroqHandler
from .google_handler import GoogleHandler
from .catalog import PROVIDERS_CATALOG
from app.schemas.llm import ProviderInfo, UserUsage
from loguru import logger
from app.schemas.llm import StreamEvent, StreamEventType
import asyncio
from app.core.context import client_ip_var, client_device_fp_var
from app.core.security import update_token_usage


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

    @staticmethod
    async def on_usage_complete(usage_data: Dict[str, Any]):
        # This method can be used to handle usage data, e.g., logging or storing it.
        # For now, we just print it. In a real application, you might want to store it in a database.
        # Update usage data into Redis for later checking the quota
        client_ip = client_ip_var.get()
        client_device_fp = client_device_fp_var.get()

        if client_ip and client_device_fp:
            total_tokens = usage_data.get("total_tokens", 0)
            if total_tokens > 0:
                await update_token_usage(
                    client_ip=client_ip,
                    device_fp=client_device_fp,
                    total_tokens=total_tokens,
                )
        else:
            logger.error(
                "Could not find client_ip: {client_ip} and client device fingerprint: {client_device_fp} in Redis."
            )
            raise ValueError("Invalid Client information.")

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
        handler_stream = None
        try:
            handler_stream = handler.stream_chat(
                model=model,
                messages=messages,
                **kwargs,
            )

            async for streamEvent in handler_stream:
                if streamEvent.type == StreamEventType.USAGE:
                    await cls.on_usage_complete(streamEvent.data)

                yield streamEvent
        except asyncio.CancelledError:
            logger.warning("Stream cancelled by client disconnect.")
            raise

        except Exception as ex:
            logger.error(f"Unhandled error during streaming: {ex}")
            yield StreamEvent(
                type=StreamEventType.ERROR,
                data="An error occurred while streaming response.",
            )
        finally:
            if handler_stream is not None:
                await handler_stream.aclose()
                logger.info("LLM service stream closed.")
