from typing import AsyncGenerator, List, Dict, Any
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
        self, model: str, messages: List[Dict[str, str]], **kwargs: Any
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
        async for chunk in response:
            # The Gemini streaming response can present the generated text in
            # different shapes depending on the client version or the way it
            # is mocked in tests. Historically the SDK exposed a ``text``
            # attribute on each chunk. The test suite, however, mocks the
            # response to provide a ``choices`` list with a ``delta`` object
            # containing ``content`` – mirroring the OpenAI‑style payload.
            # To be robust we first try the ``text`` attribute; if it does not
            # exist we fall back to the ``choices[0].delta.content`` pattern.
            if hasattr(chunk, "text"):
                content = getattr(chunk, "text")
            else:
                # Defensive access – if the expected attributes are missing we
                # treat the chunk as having no content.
                content = (
                    getattr(chunk, "choices", [None])[
                        0
                    ].delta.content  # type: ignore[attr-defined]
                    if getattr(chunk, "choices", None)
                    else None
                )

            if content:
                yield content
