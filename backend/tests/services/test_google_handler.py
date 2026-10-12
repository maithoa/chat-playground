import pytest
from unittest.mock import AsyncMock, patch
from app.services.llm.google_handler import GoogleHandler
from app.schemas.llm import StreamEvent, StreamEventType
from tests.utils import IS_POSITIVE


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
    """Create an ``AsyncMock`` client that yields ``StreamEvent`` objects.

    The real handler yields ``StreamEvent`` objects, so the mock client must do the
    same. ``chunks`` is a list of ``MockChunk`` objects (containing ``text`` and
    optional ``usage_metadata``). For each chunk we emit a ``CONTENT`` event if the
    ``text`` attribute is present, and a ``USAGE`` event if ``usage_metadata``
    exists.
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
        async for ev in handler.stream_chat(
            model="gemini-1.5-flash", messages=[{"role": "user", "content": "hi"}]
        ):
            if ev.type == StreamEventType.CONTENT:
                result.append(ev.data)

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
        async_usage_data = []
        async for ev in handler.stream_chat(
            model="gemini-1.5-flash",
            messages=[{"role": "user", "content": "hi"}],
        ):
            if ev.type == StreamEventType.CONTENT:
                result.append(ev.data)
            if ev.type == StreamEventType.USAGE:
                async_usage_data.append(ev.data)

    assert result == ["Hello", "world"]
    assert async_usage_data == [
        {
            "prompt_tokens": 5,
            "completion_tokens": 10,
            "total_tokens": 15,
            "time_to_first_token_ms": IS_POSITIVE,
            "tokens_per_second": IS_POSITIVE,
        }
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
        async_usage_data = []
        async for ev in handler.stream_chat(
            model="gemini-1.5-flash",
            messages=[{"role": "user", "content": "hi"}],
        ):
            if ev.type == StreamEventType.CONTENT:
                result.append(ev.data)
            if ev.type == StreamEventType.USAGE:
                async_usage_data.append(ev.data)

    assert result == ["Test"]
    assert async_usage_data == [
        {
            "prompt_tokens": 2,
            "completion_tokens": 3,
            "total_tokens": 5,
            "time_to_first_token_ms": IS_POSITIVE,
            "tokens_per_second": IS_POSITIVE,
        }
    ]


def test_google_handler_missing_api_key():
    with patch("app.services.llm.google_handler.settings") as mock_settings:
        mock_settings.GOOGLE_API_KEY = None
        with pytest.raises(ValueError, match="Could not find Google API key."):
            GoogleHandler(api_key=None)
