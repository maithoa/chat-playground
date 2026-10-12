import inspect
import time
from loguru import logger
from typing import AsyncGenerator, List, Dict, Any, Callable, Optional
from groq import AsyncGroq

from app.core.config import settings
from .base import BaseLLMHandler
from app.schemas.llm import StreamEvent, StreamEventType


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
        **kwargs: Any,
    ) -> AsyncGenerator[StreamEvent, None]:

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
                        time_to_first_chunk = time.perf_counter() - start_time
                        first_chunk = False
                        logger.info(
                            f"Time to first chunk: {time_to_first_chunk} seconds"
                        )

                    yield StreamEvent(type=StreamEventType.CONTENT, data=content)

        except Exception as ex:
            logger.error(f"{ex}")
            yield StreamEvent(type=StreamEventType.ERROR, data=ex)

        finally:
            duration_seconds = time.perf_counter() - start_time

            if start_time:
                logger.info(f"\nTime taken: {duration_seconds} seconds")

            if last_chunk and last_chunk.usage:
                logger.info(f"\nUsage Info object from Groq {last_chunk.usage}")
                completion_time_api = 0

                if (
                    last_chunk.usage.completion_time
                    and last_chunk.usage.completion_time > 0
                ):
                    completion_time_api = last_chunk.usage.completion_time
                elif last_chunk.usage.total_time and last_chunk.usage.total_time > 0:
                    completion_time_api = last_chunk.usage.total_time
                # Tokens Per Second is calculated based on completion_tokens and completion_time.
                tokens_per_second = (
                    (last_chunk.usage.completion_tokens / completion_time_api)
                    if completion_time_api and completion_time_api > 0
                    else 0
                )
                usage_data = {
                    "prompt_tokens": last_chunk.usage.prompt_tokens,
                    "completion_tokens": last_chunk.usage.completion_tokens,
                    "total_tokens": last_chunk.usage.total_tokens,
                    "time_to_first_token_ms": round(time_to_first_chunk * 1000, 2),
                    "tokens_per_second": round(tokens_per_second, 2),
                }

                se = StreamEvent(type=StreamEventType.USAGE, data=usage_data)
                logger.info(f"\n Usage data in Handler: {se.data} ")

                yield se
