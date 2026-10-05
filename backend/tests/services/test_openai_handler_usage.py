import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.llm.openai_handler import OpenAIHandler
from openai.types.completion_usage import CompletionUsage


class MockChunk:
    """Mock chunk returned by OpenAI streaming API.

    Mirrors the structure accessed by :class:`OpenAIHandler`: ``choices[0]
    .delta.content`` for the streamed text and an optional ``usage`` attribute.
    """

    def __init__(self, content: str | None, usage: CompletionUsage | None = None):
        self.choices = [MagicMock(delta=MagicMock(content=content))]
        self.usage = usage


def _mock_client(chunks):
    """Create an ``AsyncMock`` client that yields *chunks*.

    The handler calls ``self.client.chat.completions.create`` which returns an
    async generator yielding the supplied chunks.
    """

    async def mock_stream():
        for c in chunks:
            yield c

    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value=mock_stream())
    return client


@pytest.mark.asyncio
async def test_openai_handler_stream_chat_with_async_usage_callback():
    """Ensure async ``on_usage_complete`` receives the correct usage dict."""

    usage = CompletionUsage(prompt_tokens=5, completion_tokens=10, total_tokens=15)
    chunks = [MockChunk("Hello"), MockChunk("world", usage), MockChunk(None)]
    mock_client = _mock_client(chunks)

    async_usage_data = []

    async def async_callback(data):
        async_usage_data.append(data)

    with patch("app.services.llm.openai_handler.AsyncOpenAI", return_value=mock_client):
        handler = OpenAIHandler(api_key="dummy-key")
        result = []
        async for chunk in handler.stream_chat(
            model="gpt-4o",
            messages=[{"role": "user", "content": "hi"}],
            on_usage_complete=async_callback,
        ):
            result.append(chunk)

    assert result == ["Hello", "world"]
    assert async_usage_data == [
        {"prompt_tokens": 5, "completion_tokens": 10, "total_tokens": 15}
    ]


@pytest.mark.asyncio
async def test_openai_handler_stream_chat_with_sync_usage_callback():
    """Validate that a regular (sync) usage callback works correctly."""

    usage = CompletionUsage(prompt_tokens=2, completion_tokens=3, total_tokens=5)
    chunks = [MockChunk("Test", usage), MockChunk(None)]
    mock_client = _mock_client(chunks)

    sync_usage_data = []

    def sync_callback(data):
        sync_usage_data.append(data)

    with patch("app.services.llm.openai_handler.AsyncOpenAI", return_value=mock_client):
        handler = OpenAIHandler(api_key="dummy-key")
        result = []
        async for chunk in handler.stream_chat(
            model="gpt-4o",
            messages=[{"role": "user", "content": "hi"}],
            on_usage_complete=sync_callback,
        ):
            result.append(chunk)

    assert result == ["Test"]
    assert sync_usage_data == [
        {"prompt_tokens": 2, "completion_tokens": 3, "total_tokens": 5}
    ]
