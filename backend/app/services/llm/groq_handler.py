import inspect
import time
from loguru import logger
from typing import AsyncGenerator, List, Dict, Any, Callable, Optional
from groq import AsyncGroq

from app.core.config import settings
from .base import BaseLLMHandler


class GroqHandler(BaseLLMHandler):
    def __init__(self, api_key: str | None = None):
        resolved_key = api_key or settings.GROQ_API_KEY
        if not resolved_key:
            raise ValueError("Could not find Groq API key.")

        self.client = AsyncGroq(api_key=resolved_key)

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
        try:
            async for last_chunk in response:
                content = last_chunk.choices[0].delta.content
                if content:
                    if first_chunk:
                        first_chunk = False
                        time_to_first_chunk = time.perf_counter() - start_time
                        logger.info(
                            f"Time to first chunk: {time_to_first_chunk} seconds"
                        )

                    yield content
        finally:
            end_time = time.perf_counter()
            duration_seconds = end_time - start_time

            if start_time:
                logger.info(f"\nTime taken: {duration_seconds} seconds")

            if last_chunk and last_chunk.usage and on_usage_complete:
                tokens_per_second = (
                    (last_chunk.usage.total_tokens / last_chunk.usage.total_time)
                    if last_chunk.usage.total_time > 0
                    else 0
                )
                usage_data = {
                    "prompt_tokens": last_chunk.usage.prompt_tokens,
                    "completion_tokens": last_chunk.usage.completion_tokens,
                    "total_tokens": last_chunk.usage.total_tokens,
                    "time_to_first_token_ms": time_to_first_chunk,
                    "tokens_per_second": tokens_per_second,
                }

                logger.info(f"\nCalulated Total time taken: {duration_seconds} seconds")
                logger.info(
                    f"\nTotal time from API: {last_chunk.usage.total_time} seconds"
                )
                if inspect.iscoroutinefunction(on_usage_complete):
                    await on_usage_complete(usage_data)
                else:
                    on_usage_complete(usage_data)
