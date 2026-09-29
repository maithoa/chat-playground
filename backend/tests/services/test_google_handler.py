"""Tests for the Google (Gemini) LLM handler.

The handler lives in ``backend/app/services/llm/google_handler.py`` and is
named ``GoogleHandler.  The tests verify two
behaviours:

1. Initialisation fails with a clear ``ValueError`` when the Google API key
   is missing.
2. ``stream_chat`` correctly streams content from the underlying ``genai``
   client.  The real client is replaced with a lightweight mock that yields
   ``choices[0].delta.content`` values.

The test suite uses ``pytest`` with the ``anyio`` marker to run the async
functions without requiring the ``pytest‑asyncio`` plugin.
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.config import settings
from app.services.llm.google_handler import GoogleHandler


def test_google_handler_missing_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure a missing ``GOOGLE_API_KEY`` raises ``ValueError``.

    The handler should read the key from ``settings.GOOGLE_API_KEY`` when no
    explicit key is provided.  By monkey‑patching the setting to ``None`` we
    simulate the missing‑key scenario.
    """
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", None, raising=False)
    with pytest.raises(ValueError, match="Could not find Google API key."):
        GoogleHandler()


@pytest.mark.anyio
async def test_google_handler_stream_chat(monkeypatch: pytest.MonkeyPatch) -> None:
    """Validate that ``stream_chat`` yields the expected content chunks.

    A fake ``genai.Client`` is injected that returns an async generator
    mimicking the shape of the real Gemini streaming response.  Each yielded
    object contains ``choices[0].delta.content`` which the handler extracts.
    """

    # Prepare a dummy API key so the constructor succeeds.
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "dummy-key", raising=False)

    # ----- Helper classes to mimic the streaming response -----
    class _Delta:
        def __init__(self, content: str | None):
            self.content = content

    class _Choice:
        def __init__(self, content: str | None):
            self.delta = _Delta(content)

    class _Chunk:
        def __init__(self, content: str | None):
            self.choices = [_Choice(content)]

    async def _fake_stream(*_, **__) -> AsyncMock:
        """Async generator yielding two chunks of text.

        The real ``genai`` client returns an async iterator; here we simply
        ``yield`` two ``_Chunk`` instances.
        """
        yield _Chunk("Hello ")
        yield _Chunk("World!")

    # Mock the ``genai.Client`` to return an object with the required async
    # attribute hierarchy ``client.aio.models.generate_content_stream``.
    mock_client = MagicMock()
    mock_client.aio.models.generate_content_stream = AsyncMock(side_effect=_fake_stream)

    with patch("google.genai.Client", return_value=mock_client):
        handler = GoogleHandler()
        # The payload preparation is not the focus; we can pass a simple list.
        async_gen = handler.stream_chat(
            model="gemini-1.5-flash", messages=[{"role": "user", "content": "hi"}]
        )
        collected = []
        async for chunk in async_gen:
            collected.append(chunk)

    assert "".join(collected) == "Hello World!"
