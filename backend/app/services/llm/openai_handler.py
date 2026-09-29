from openai import AsyncOpenAI
from typing import AsyncGenerator, List, Dict, Any

from .base import BaseLLMHandler
from app.core.config import settings


class OpenAIHandler(BaseLLMHandler):
    def __init__(self, api_key: str | None = None):
        # Prioritize the api_key as parameter
        resolved_key = api_key or settings.OPENAI_API_KEY

        if not resolved_key:
            raise ValueError("Could not find OPENAPI API key.")

        # Init AsyncOpenAI client
        self.client = AsyncOpenAI(api_key=resolved_key)

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
