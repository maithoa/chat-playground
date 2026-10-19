import inspect
import time
from loguru import logger
from typing import AsyncGenerator, List, Dict, Any, Optional, Callable
from openai import AsyncOpenAI
from openai.types.completion_usage import CompletionUsage
from app.schemas.llm import StreamEventType, StreamEvent
from httpx import TimeoutException

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
        **kwargs: Any,
    ) -> AsyncGenerator[StreamEvent, None]:

        start_time = time.perf_counter()
        time_to_first_token = 0.0
        duration_ms = 0.0

        last_chunk = None
        first_chunk = True

        response = None

        try:
            response = await self.client.chat.completions.create(
                model=model, messages=messages, stream=True, **kwargs
            )

            async for last_chunk in response:
                content = last_chunk.choices[0].delta.content
                if content:
                    if first_chunk:
                        time_to_first_token = time.perf_counter() - start_time
                        first_chunk = False
                        logger.info(f"\n Time to first chunk: {time_to_first_token}")

                    yield StreamEvent(type=StreamEventType.CONTENT, data=content)

        except TimeoutException as e:
            safe_error_message = "Timeout trying to access OpenRouter API."
            logger.error(f"{safe_error_message} {str(e)}")
            yield StreamEvent(type=StreamEventType.ERROR, data=safe_error_message)
            return

        except Exception as ex:
            safe_error_message = (
                "Error occurred while streaming chat content from OpenRouter."
            )
            logger.error(f"{safe_error_message} {str(ex)}")
            yield StreamEvent(type=StreamEventType.ERROR, data=safe_error_message)
            return

        finally:
            if response is not None:
                logger.info(f"Open Router (OpenAI) response type:{type(response)}")
                await response.aclose()

        if last_chunk and last_chunk.usage:
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
            yield StreamEvent(type=StreamEventType.USAGE, data=usage_data)
