import inspect
from typing import AsyncGenerator, List, Dict, Any, Callable
from google import genai
from google.genai import types

from app.core.config import settings
from app.models.conversation import MessageRole, MessageBase
from .base import BaseLLMHandler


class GoogleHandler(BaseLLMHandler):
    def __init__(self, api_key: str | None = None):
        resolved_key = api_key or settings.GOOGLE_API_KEY
        if not resolved_key:
            raise ValueError("Could not find Google API key.")

        self.client = genai.Client(api_key=resolved_key)

    def _prepare_payload(self, messages: List[Dict[str, str]]) -> list[types.Content]:
        """Convert generic message dicts or ``MessageBase`` objects to Gemini ``Content``.

        The Gemini API expects a list of ``Content`` objects where each entry
        specifies a ``role`` (``user`` or ``model``) and a list of ``Part``
        objects containing the text.  This helper normalises the input so the
        handler can accept either the raw dict format used by the service
        layer or the Pydantic ``MessageBase`` model.
        """
        contents: list[types.Content] = []

        for msg in messages:
            if isinstance(msg, MessageBase):
                role_val = msg.role
                content_text = msg.content
            else:
                role_val = msg["role"]
                content_text = msg["content"]

            gemini_role = (
                "model"
                if role_val in (MessageRole.ASSISTANT, "assistant", "model")
                else "user"
            )

            contents.append(
                types.Content(
                    role=gemini_role,
                    parts=[types.Part.from_text(text=content_text)],
                )
            )

        return contents

    async def stream_chat(
        self,
        model: str,
        messages: List[Dict[str, str]],
        on_usage_complete: Callable[[Dict[str, Any]], None] | None = None,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        contents = self._prepare_payload(messages)

        # Check the parameters for model config from kwargs
        temperature = kwargs.pop("temperature", None)
        top_p = kwargs.pop("top_p", None)
        top_k = kwargs.pop("top_k", None)
        max_output_tokens = kwargs.pop("max_output_tokens", None)

        config = kwargs.pop("config", None) or types.GenerateContentConfig()

        if temperature is not None:
            config.temperature = temperature
        if top_p is not None:
            config.top_p = top_p
        if top_k is not None:
            config.top_k = top_k
        if max_output_tokens is not None:
            config.max_output_tokens = max_output_tokens

        config.automatic_function_calling = types.AutomaticFunctionCallingConfig(
            disable=True
        )

        response = await self.client.aio.models.generate_content_stream(
            model=model, contents=contents, config=config, **kwargs
        )
        last_chunk = None

        try:
            async for last_chunk in response:
                if last_chunk.text:
                    yield last_chunk.text
        finally:
            if (
                last_chunk
                and getattr(last_chunk, "usage_metadata", None)
                and on_usage_complete
            ):
                usage_data = {
                    "prompt_tokens": last_chunk.usage_metadata.prompt_token_count,
                    "completion_tokens": last_chunk.usage_metadata.candidates_token_count,
                    "total_tokens": last_chunk.usage_metadata.total_token_count,
                }
                if inspect.iscoroutinefunction(on_usage_complete):
                    await on_usage_complete(usage_data)
                else:
                    on_usage_complete(usage_data)
