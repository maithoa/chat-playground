import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.llm.groq_handler import GroqHandler
from app.schemas.llm import StreamEvent, StreamEventType
from tests.utils import IS_POSITIVE


class MockChunk:
    """Mock chunk returned by Groq streaming API.

    Mirrors the structure used in ``GroqHandler`` where ``chunk.choices[0]
    .delta.content`` holds the text and an optional ``usage`` attribute may be
    present.
    """

    def __init__(self, content: str | None, usage: object | None = None):
        self.choices = [MagicMock(delta=MagicMock(content=content))]
        self.usage = usage


def _mock_client(chunks):
    """Create an ``AsyncMock`` client that yields ``StreamEvent`` objects.

    ``chunks`` is a list of ``MockChunk`` objects (containing ``content`` and an
    optional ``usage`` attribute). For each chunk we emit a ``CONTENT`` event if
    ``content`` is present, and a ``USAGE`` event if ``usage`` exists.
    """

    async def mock_stream():
        for c in chunks:
            yield c

    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value=mock_stream())
    return client


@pytest.mark.asyncio
async def test_groq_handler_stream_chat_with_async_usage_callback():
    """Validate async ``on_usage_complete`` receives correct usage data."""

    usage = type(
        "usage",
        (),
        {
            "prompt_tokens": 5,
            "completion_tokens": 10,
            "total_tokens": 15,
            "completion_time": 0.1,
            "total_time": 0.1,
        },
    )()
    chunks = [MockChunk("Hello"), MockChunk("world"), MockChunk(None, usage)]
    mock_client = _mock_client(chunks)

    async_usage_data = []

    with patch("app.services.llm.groq_handler.AsyncGroq", return_value=mock_client):
        handler = GroqHandler(api_key="dummy-key")
        result = []
        async for ev in handler.stream_chat(
            model="groq/gemma-2",
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
            "tokens_per_second": 100,
        }
    ]


@pytest.mark.asyncio
async def test_groq_handler_stream_chat_with_sync_usage_callback():
    """Validate sync ``on_usage_complete`` works as expected."""

    usage = type(
        "Usage",
        (),
        {
            "prompt_tokens": 2,
            "completion_tokens": 3,
            "completion_time": 0.08,
            "total_tokens": 5,
            "total_time": 0.1,
        },
    )()
    chunks = [MockChunk("Test"), MockChunk(None, usage)]
    mock_client = _mock_client(chunks)

    sync_usage_data = []

    with patch("app.services.llm.groq_handler.AsyncGroq", return_value=mock_client):
        handler = GroqHandler(api_key="dummy-key")
        result = []
        async for ev in handler.stream_chat(
            model="groq/gemma-2",
            messages=[{"role": "user", "content": "hi"}],
        ):
            if ev.type == StreamEventType.CONTENT:
                result.append(ev.data)
            if ev.type == StreamEventType.USAGE:
                sync_usage_data.append(ev.data)

    assert result == ["Test"]
    assert sync_usage_data == [
        {
            "prompt_tokens": 2,
            "completion_tokens": 3,
            "total_tokens": 5,
            "time_to_first_token_ms": IS_POSITIVE,
            "tokens_per_second": 37.5,
        }
    ]


def test_groq_handler_missing_api_key():
    with patch("app.services.llm.groq_handler.settings") as mock_settings:
        mock_settings.GROQ_API_KEY = None

        with pytest.raises(ValueError, match="Could not find Groq API key."):
            GroqHandler(api_key=None)
