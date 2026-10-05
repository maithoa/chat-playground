import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.llm.openrouter_handler import OpenRouterHandler
from openai.types.completion_usage import CompletionUsage


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
        MockChunk("world", usage),
        MockChunk(None),
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
        async for chunk in handler.stream_chat(
            model="openrouter/gpt-4",
            messages=messages,
            on_usage_complete=async_callback,
            include_usage=True,
        ):
            result.append(chunk)

    # Verify streamed content (excluding the final ``None`` chunk)
    assert result == ["Hello", ",", "world"]
    # Verify the async callback was invoked exactly once with the expected dict
    assert async_usage_data == [
        {"prompt_tokens": 5, "completion_tokens": 10, "total_tokens": 15}
    ]


@pytest.mark.asyncio
async def test_openrouter_handler_stream_chat_with_sync_usage_callback():
    """Ensure that a regular (sync) ``on_usage_complete`` callback is also supported."""

    usage = CompletionUsage(prompt_tokens=2, completion_tokens=3, total_tokens=5)
    chunks = [MockChunk("Test", usage), MockChunk(None)]

    mock_client = _mock_client(chunks)

    sync_usage_data = []

    def sync_callback(data):
        sync_usage_data.append(data)

    with patch(
        "app.services.llm.openrouter_handler.AsyncOpenAI", return_value=mock_client
    ):
        handler = OpenRouterHandler(api_key="sk-test-key")
        messages = [{"role": "user", "content": "Hello"}]
        result = []
        async for chunk in handler.stream_chat(
            model="openrouter/gpt-4",
            messages=messages,
            on_usage_complete=sync_callback,
            include_usage=True,
        ):
            result.append(chunk)

    assert result == ["Test"]
    assert sync_usage_data == [
        {"prompt_tokens": 2, "completion_tokens": 3, "total_tokens": 5}
    ]
