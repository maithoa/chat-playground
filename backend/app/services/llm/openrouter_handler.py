from typing import AsyncGenerator, List, Dict, Any
from openai import AsyncOpenAI

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
        self, model: str, messages: List[Dict[str, str]], **kwargs: Any
    ) -> AsyncGenerator[str, None]:

        response = await self.client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )
        async for chunk in response:
            content = chunk.choices[0].delta.content
            if content:
                yield content
