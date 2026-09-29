from typing import AsyncGenerator, List, Dict, Any
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
        self, model: str, messages: List[Dict[str, str]], **kwargs: Any
    ) -> AsyncGenerator[str, None]:

        response = await self.client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )
        async for chunk in response:
            content = chunk.choices[0].delta.content
            if content:
                yield content
