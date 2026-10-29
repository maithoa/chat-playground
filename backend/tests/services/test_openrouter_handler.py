import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.llm.openrouter_handler import OpenRouterHandler
from app.schemas.llm import StreamEvent, StreamEventType
from openai.types.completion_usage import CompletionUsage
from tests.utils import IS_POSITIVE
from httpx import TimeoutException


# Helper class to mock a chunk returned from the OpenRouter API, optionally with usage data
class MockChunk:
    def __init__(self, content: str | None, usage: CompletionUsage | None = None):
        # The handler accesses ``chunk.choices[0].delta.content``
        self.choices = [MagicMock(delta=MagicMock(content=content))]
        # ``chunk.usage`` may be ``None`` or a ``CompletionUsage`` instance
        self.usage = usage


def _mock_client(chunks):
    """Create a mock Google client returning an async stream of MockChunk."""

    async def mock_stream():
        for c in chunks:
            yield c

    generator = mock_stream()

    response = MagicMock()
    response.__aiter__.side_effect = lambda: generator
    response.aclose = AsyncMock(side_effect=generator.aclose)

    client = AsyncMock()
    client.chat.completions.create.return_value = response
    return client


@pytest.mark.asyncio
async def test_openrouter_handler_stream_chat_with_async_usage_data():
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
    response = mock_client.chat.completions.create.return_value
    response.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_openrouter_handler_stream_chat_with_sync_usage_data():
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
    response = mock_client.chat.completions.create.return_value
    response.aclose.assert_awaited_once()


def test_openrouter_handler_missing_api_key():
    with patch("app.services.llm.openrouter_handler.settings") as mock_settings:
        mock_settings.OPENROUTER_API_KEY = None
        with pytest.raises(ValueError, match="Could not find OpenRouter API key."):
            OpenRouterHandler(api_key=None)


@pytest.mark.asyncio
async def test_openrouter_handler_stream_chat_provider_error():
    """
    Verify that OpenRouter API raises an error during chat completions,
    the handler catches it and yields a StreamEventType.ERROR event.
    """

    mock_client = AsyncMock()
    # Mock the error when calling API.
    mock_client.chat.completions.create.side_effect = Exception(
        "OpenRouter API connection timeout."
    )

    with patch(
        "app.services.llm.openrouter_handler.AsyncOpenAI", return_value=mock_client
    ):
        handler = OpenRouterHandler(api_key="dummy-key")
        events = []

        async for ev in handler.stream_chat(
            model="openrouter/free",
            messages=[{"role": "user", "content": "hi"}],
        ):
            events.append(ev)
    assert len(events) == 1
    assert events[0].type == StreamEventType.ERROR
    assert "Error occurred while streaming chat content from OpenRouter." in str(
        events[0].data
    )


@pytest.mark.asyncio
async def test_openrouter_handler_stream_chat_timeout_error():
    """
    Verify that when API times out (raising httpx.TimeoutException),
    the handler catches it and yields a safe error event.
    """
    mock_client = AsyncMock()

    # Mock return of TimeOutException
    mock_client.chat.completions.create.side_effect = TimeoutException(
        "Request timed out connecting to API."
    )

    with patch(
        "app.services.llm.openrouter_handler.AsyncOpenAI", return_value=mock_client
    ):
        handler = OpenRouterHandler(api_key="dummy-key")
        events = []

        async for ev in handler.stream_chat(
            model="openrouter/free",
            messages=[{"role": "user", "content": "hi"}],
        ):
            events.append(ev)

    assert len(events) == 1
    assert events[0].type == StreamEventType.ERROR
    assert "timeout" in str(events[0].data).lower()


@pytest.mark.asyncio
async def test_openrouter_handler_closes_stream_on_midstream_error():
    async def failing_stream():
        yield MockChunk("Hello")
        raise RuntimeError("Sensitive internal provider error")

    generator = failing_stream()

    response = MagicMock()
    response.__aiter__.side_effect = lambda: generator
    response.aclose = AsyncMock(side_effect=generator.aclose)

    mock_client = AsyncMock()
    mock_client.chat.completions.create.return_value = response

    with patch(
        "app.services.llm.openrouter_handler.AsyncOpenAI",
        return_value=mock_client,
    ):
        handler = OpenRouterHandler(api_key="dummy-key")
        events = [
            event
            async for event in handler.stream_chat(
                model="groq/gemma-2",
                messages=[{"role": "user", "content": "hi"}],
            )
        ]

    # Content and error is received, no usage
    assert [event.type for event in events] == [
        StreamEventType.CONTENT,
        StreamEventType.ERROR,
    ]
    assert events[0].data == "Hello"
    assert events[1].data == (
        "Error occurred while streaming chat content from OpenRouter."
    )

    # No sensitive info frome exception is raised
    assert "Sensitive internal provider error" not in str(events)

    # Stream is closed.
    response.aclose.assert_awaited_once()


async def test_openrouter_handler_stream_chat_empty_chunk():
    """Ensure that handler runs even when empty chunks are returned from Provider APIs"""

    chunks = []

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
    assert result == []
    # Verify the async callback was invoked exactly once with the expected dict
    assert async_usage_data == []
    response = mock_client.chat.completions.create.return_value
    response.aclose.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("trailing_empty_chunk", [False, True])
async def test_openrouter_preserves_usage_only_chunk(trailing_empty_chunk):
    usage = CompletionUsage(
        prompt_tokens=5,
        completion_tokens=10,
        total_tokens=15,
    )
    chunks = [
        MockChunk("Hello"),
        MagicMock(choices=[], usage=usage),
    ]
    if trailing_empty_chunk:
        chunks.append(MagicMock(choices=[], usage=None))

    mock_client = _mock_client(chunks)

    with patch(
        "app.services.llm.openrouter_handler.AsyncOpenAI",
        return_value=mock_client,
    ):
        handler = OpenRouterHandler(api_key="dummy-key")
        events = [
            event
            async for event in handler.stream_chat(
                model="test-model",
                messages=[{"role": "user", "content": "hi"}],
            )
        ]

    assert [event.type for event in events] == [
        StreamEventType.CONTENT,
        StreamEventType.USAGE,
    ]
    assert events[0].data == "Hello"
    assert events[1].data["prompt_tokens"] == 5
    assert events[1].data["completion_tokens"] == 10
    assert events[1].data["total_tokens"] == 15

    response = mock_client.chat.completions.create.return_value
    response.aclose.assert_awaited_once()
