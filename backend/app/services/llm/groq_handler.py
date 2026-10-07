import inspect
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
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:

        response = await self.client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )

        last_chunk = None

        try:
            async for last_chunk in response:
                content = last_chunk.choices[0].delta.content
                if content:
                    yield content
        finally:

            if last_chunk and last_chunk.usage and on_usage_complete:
                usage_data = {
                    "prompt_tokens": last_chunk.usage.prompt_tokens,
                    "completion_tokens": last_chunk.usage.completion_tokens,
                    "total_tokens": last_chunk.usage.total_tokens,
                }
                if inspect.iscoroutinefunction(on_usage_complete):
                    await on_usage_complete(usage_data)
                else:
                    on_usage_complete(usage_data)
