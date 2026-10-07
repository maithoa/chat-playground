import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from app.core.config import settings
from app.services.llm.google_handler import GoogleHandler


class MockUsageMetadata:
    """Mock structure matching Google GenAI SDK's usage_metadata."""

    def __init__(self, prompt_tokens: int, completion_tokens: int, total_tokens: int):
        self.prompt_token_count = prompt_tokens
        self.candidates_token_count = completion_tokens
        self.total_token_count = total_tokens


class MockChunk:
    """A lightweight mock mimicking the Gemini streaming chunk.

    The :class:`GoogleHandler` expects each chunk to have a ``candidates``
    sequence where the first element provides a ``content`` attribute, and an
    optional ``usage`` attribute containing ``prompt_tokens``,
    ``completion_tokens`` and ``total_tokens``.  The test supplies simple
    values for these fields.
    """

    def __init__(
        self, content: str | None, usage_metadata: MockUsageMetadata | None = None
    ):
        # ``candidates[0].content`` is what the handler yields.
        self.text = content
        self.usage_metadata = usage_metadata


def _mock_client(chunks):
    """Create an ``AsyncMock`` client that yields *chunks*.

    The handler calls ``self.client.aio.models.generate_content_stream`` and
    iterates over the async generator it returns.  This helper builds a client
    where that method returns an async generator yielding the supplied mock
    chunks.
    """

    async def mock_stream():
        for c in chunks:
            yield c

    client = AsyncMock()
    client.aio.models.generate_content_stream = AsyncMock(return_value=mock_stream())
    return client


@pytest.mark.asyncio
async def test_google_handler_stream_chat_success():
    """Verify that ``GoogleHandler.stream_chat`` yields the expected content.

    The test injects a mock ``genai.Client`` that returns a small series of
    chunks.  No usage callback is provided – the handler should simply yield the
    ``content`` values.
    """

    chunks = [MockChunk("Hello"), MockChunk(","), MockChunk("world"), MockChunk(None)]
    mock_client = _mock_client(chunks)

    with patch(
        "app.services.llm.google_handler.genai.Client", return_value=mock_client
    ):
        handler = GoogleHandler(api_key="dummy-key")
        result = []
        async for chunk in handler.stream_chat(
            model="gemini-1.5-flash", messages=[{"role": "user", "content": "hi"}]
        ):
            result.append(chunk)

    assert result == ["Hello", ",", "world"]


@pytest.mark.asyncio
async def test_google_handler_stream_chat_with_async_usage_callback():
    """Ensure an async ``on_usage_complete`` receives the correct usage data."""

    usage = MockUsageMetadata(prompt_tokens=5, completion_tokens=10, total_tokens=15)
    chunks = [
        MockChunk("Hello"),
        MockChunk("world", usage),
        MockChunk(None, usage_metadata=usage),
    ]
    mock_client = _mock_client(chunks)

    async_usage_data = []

    async def async_callback(data):
        async_usage_data.append(data)

    with patch(
        "app.services.llm.google_handler.genai.Client", return_value=mock_client
    ):
        handler = GoogleHandler(api_key="dummy-key")
        result = []
        async for chunk in handler.stream_chat(
            model="gemini-1.5-flash",
            messages=[{"role": "user", "content": "hi"}],
            on_usage_complete=async_callback,
        ):
            result.append(chunk)

    assert result == ["Hello", "world"]
    assert async_usage_data == [
        {"prompt_tokens": 5, "completion_tokens": 10, "total_tokens": 15}
    ]


@pytest.mark.asyncio
async def test_google_handler_stream_chat_with_sync_usage_callback():
    """Verify that a regular (sync) usage callback is also supported."""

    usage = MockUsageMetadata(prompt_tokens=2, completion_tokens=3, total_tokens=5)
    chunks = [MockChunk("Test", usage), MockChunk(None, usage_metadata=usage)]
    mock_client = _mock_client(chunks)

    sync_usage_data = []

    def sync_callback(data):
        sync_usage_data.append(data)

    with patch(
        "app.services.llm.google_handler.genai.Client", return_value=mock_client
    ):
        handler = GoogleHandler(api_key="dummy-key")
        result = []
        async for chunk in handler.stream_chat(
            model="gemini-1.5-flash",
            messages=[{"role": "user", "content": "hi"}],
            on_usage_complete=sync_callback,
        ):
            result.append(chunk)

    assert result == ["Test"]
    assert sync_usage_data == [
        {"prompt_tokens": 2, "completion_tokens": 3, "total_tokens": 5}
    ]


def test_google_handler_missing_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure a missing ``GOOGLE_API_KEY`` raises ``ValueError``.

    The handler should read the key from ``settings.GOOGLE_API_KEY`` when no
    explicit key is provided.  By monkey‑patching the setting to ``None`` we
    simulate the missing‑key scenario.
    """
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", None, raising=False)
    with pytest.raises(ValueError, match="Could not find Google API key."):
        GoogleHandler()
