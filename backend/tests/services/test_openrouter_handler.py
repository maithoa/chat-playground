import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.llm.openrouter_handler import OpenRouterHandler
from app.schemas.llm import StreamEvent, StreamEventType
from openai.types.completion_usage import CompletionUsage
from tests.utils import IS_POSITIVE


# Helper class to mock a chunk returned from the OpenRouter API, optionally with usage data
class MockChunk:
    def __init__(self, content: str | None, usage: CompletionUsage | None = None):
        # The handler accesses ``chunk.choices[0].delta.content``
        self.choices = [MagicMock(delta=MagicMock(content=content))]
        # ``chunk.usage`` may be ``None`` or a ``CompletionUsage`` instance
        self.usage = usage


def _mock_client(chunks):
    """Create an AsyncMock client that yields the provided ``chunks``.

    The OpenRouterHandler calls ``self.client.chat.completions.create`` and then
    iterates over the returned async generator.  Here we replace ``create`` with
    an ``AsyncMock`` that returns an async generator yielding the supplied
    ``chunks``.
    """

    async def mock_stream():
        for c in chunks:
            yield c

    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value=mock_stream())
    return client


@pytest.mark.asyncio
async def test_openrouter_handler_stream_chat_with_async_usage_callback():
    """Ensure that an async ``on_usage_complete`` callback receives the correct data."""

    usage = CompletionUsage(prompt_tokens=5, completion_tokens=10, total_tokens=15)
    chunks = [
        MockChunk("Hello"),
        MockChunk(","),
        MockChunk("world"),
        MockChunk(None, usage=usage),
    ]

    mock_client = _mock_client(chunks)

    async_usage_data = []

    async def async_callback(data):
        async_usage_data.append(data)

    with patch(
        "app.services.llm.openrouter_handler.AsyncOpenAI", return_value=mock_client
    ):
        handler = OpenRouterHandler(api_key="sk-test-key")
        messages = [{"role": "user", "content": "Hi"}]
        result = []
        async_usage_data = []
        async for ev in handler.stream_chat(
            model="openrouter/gpt-4",
            messages=messages,
        ):
            if ev.type == StreamEventType.CONTENT:
                result.append(ev.data)
            if ev.type == StreamEventType.USAGE:
                async_usage_data.append(ev.data)

    # Verify streamed content (excluding the final ``None`` chunk)
    assert result == ["Hello", ",", "world"]
    # Verify the async callback was invoked exactly once with the expected dict
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
async def test_openrouter_handler_stream_chat_with_sync_usage_callback():
    """Ensure that a regular (sync) ``on_usage_complete`` callback is also supported."""

    usage = CompletionUsage(prompt_tokens=2, completion_tokens=3, total_tokens=5)
    chunks = [
        MockChunk("Test"),
        MockChunk(None, usage=usage),
    ]

    mock_client = _mock_client(chunks)

    sync_usage_data = []

    with patch(
        "app.services.llm.openrouter_handler.AsyncOpenAI", return_value=mock_client
    ):
        handler = OpenRouterHandler(api_key="sk-test-key")
        messages = [{"role": "user", "content": "Hello"}]
        result = []
        async for ev in handler.stream_chat(
            model="openrouter/gpt-4",
            messages=messages,
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
            "tokens_per_second": IS_POSITIVE,
        }
    ]


def test_openrouter_handler_missing_api_key():
    with patch("app.services.llm.openrouter_handler.settings") as mock_settings:
        mock_settings.OPENROUTER_API_KEY = None
        with pytest.raises(ValueError, match="Could not find OpenRouter API key."):
            OpenRouterHandler(api_key=None)
