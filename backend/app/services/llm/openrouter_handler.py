import inspect
import time
from loguru import logger
from typing import AsyncGenerator, List, Dict, Any, Optional, Callable
from openai import AsyncOpenAI
from openai.types.completion_usage import CompletionUsage


from app.core.config import settings
from .base import BaseLLMHandler


class OpenRouterHandler(BaseLLMHandler):
    def __init__(self, api_key: str | None = None):
        resolved_key = api_key or settings.OPENROUTER_API_KEY
        if not resolved_key:
            raise ValueError("Could not find OpenRouter API key.")

        self.client = AsyncOpenAI(
            api_key=resolved_key,
            base_url="https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": "http://localhost:8686",
                "X-Title": settings.APP_NAME,
            },
        )

    async def stream_chat(
        self,
        model: str,
        messages: List[Dict[str, str]],
        on_usage_complete: Optional[Callable[[Dict[str, Any]], None]] = None,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:

        start_time = time.perf_counter()

        response = await self.client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )

        last_chunk = None
        first_chunk = True
        time_to_first_token = 0

        try:
            async for last_chunk in response:
                content = last_chunk.choices[0].delta.content
                if content:
                    if first_chunk:
                        time_to_first_token = time.perf_counter() - start_time
                        first_chunk = False
                        logger.info(f"\n Time to first chunk: {time_to_first_token}")

                    yield content
        finally:

            if last_chunk and last_chunk.usage and on_usage_complete:
                duration_ms = time.perf_counter() - start_time
                tokens_per_second = 0
                if (
                    last_chunk.usage.completion_tokens
                    and last_chunk.usage.completion_tokens > 0
                ):
                    tokens_per_second = (
                        last_chunk.usage.completion_tokens / duration_ms
                        if duration_ms > 0
                        else 0
                    )
                usage_data = {
                    "prompt_tokens": last_chunk.usage.prompt_tokens,
                    "completion_tokens": last_chunk.usage.completion_tokens,
                    "total_tokens": last_chunk.usage.total_tokens,
                    "time_to_first_token_ms": round(time_to_first_token * 1000, 2),
                    "tokens_per_second": round(tokens_per_second, 2),
                }
                if inspect.iscoroutinefunction(on_usage_complete):
                    await on_usage_complete(usage_data)
                else:
                    on_usage_complete(usage_data)
