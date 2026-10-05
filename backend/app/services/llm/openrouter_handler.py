import inspect
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
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:

        response = await self.client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )
        async for chunk in response:
            # Return content in chunk back to client
            content = chunk.choices[0].delta.content
            usage = chunk.usage
            if content:
                yield content

            # Get usage info
            if usage and on_usage_complete:
                usage_data = {
                    "prompt_tokens": usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens,
                }
                if inspect.iscoroutinefunction(on_usage_complete):
                    await on_usage_complete(usage_data)
                else:
                    on_usage_complete(usage_data)

                continue
