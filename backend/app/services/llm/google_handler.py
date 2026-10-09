import inspect
import time
from loguru import logger
from typing import AsyncGenerator, List, Dict, Any, Callable
from google import genai
from google.genai import types

from app.core.config import settings
from app.models.conversation import MessageRole, MessageBase
from .base import BaseLLMHandler
from app.schemas.llm import StreamEvent, StreamEventType


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
        **kwargs: Any,
    ) -> AsyncGenerator[StreamEvent, None]:
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

        start_time = time.perf_counter()
        time_to_first_chunk = 0

        response = await self.client.aio.models.generate_content_stream(
            model=model, contents=contents, config=config, **kwargs
        )
        last_chunk = None
        first_chunk = True
        try:
            async for last_chunk in response:
                if last_chunk.text:
                    if first_chunk:
                        time_to_first_chunk = time.perf_counter() - start_time
                        first_chunk = False
                        logger.info(
                            f"Time to first chunk: {time_to_first_chunk} seconds"
                        )
                    yield StreamEvent(
                        type=StreamEventType.CONTENT, data=last_chunk.text
                    )
        finally:
            if (
                last_chunk
                and getattr(last_chunk, "usage_metadata", None)
                and on_usage_complete
            ):
                duration_seconds = time.perf_counter() - start_time
                # For google api, then output tokens is stored in usage_metadata's candidates_token_count
                completion_tokens = (
                    last_chunk.usage_metadata.candidates_token_count or 0
                )
                tokens_per_second = (
                    (completion_tokens / duration_seconds)
                    if duration_seconds > 0
                    else 0
                )
                usage_data = {
                    "prompt_tokens": last_chunk.usage_metadata.prompt_token_count,
                    "completion_tokens": last_chunk.usage_metadata.candidates_token_count,
                    "total_tokens": last_chunk.usage_metadata.total_token_count,
                    "time_to_first_token_ms": round(time_to_first_chunk * 1000, 2),
                    "tokens_per_second": round(tokens_per_second, 2),
                }
                yield StreamEvent(type=StreamEventType.USAGE, data=usage_data)
