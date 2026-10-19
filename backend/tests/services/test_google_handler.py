import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.llm.google_handler import GoogleHandler
from app.schemas.llm import StreamEvent, StreamEventType
from tests.utils import IS_POSITIVE
import httpx


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
    """Create a mock Google client returning an async stream of MockChunk."""

    async def mock_stream():
        for c in chunks:
            yield c

    generator = mock_stream()

    response = MagicMock()
    response.__aiter__.side_effect = lambda: generator
    response.aclose = AsyncMock(side_effect=generator.aclose)

    client = AsyncMock()
    client.aio.models.generate_content_stream = AsyncMock(return_value=response)
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

    response = mock_client.aio.models.generate_content_stream.return_value
    response.aclose.assert_awaited_once()


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
    response = mock_client.aio.models.generate_content_stream.return_value
    response.aclose.assert_awaited_once()


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
    response = mock_client.aio.models.generate_content_stream.return_value
    response.aclose.assert_awaited_once()


def test_google_handler_missing_api_key():
    with patch("app.services.llm.google_handler.settings") as mock_settings:
        mock_settings.GOOGLE_API_KEY = None
        with pytest.raises(ValueError, match="Could not find Google API key."):
            GoogleHandler(api_key=None)


@pytest.mark.asyncio
async def test_google_handler_stream_chat_provider_error():
    """
    Verify that when Google API raises an exception during streaming,
    the handler catches it and yields a StreamEventType.ERROR event.
    """
    mock_client = AsyncMock()

    # Mock the error when calling API
    mock_client.aio.models.generate_content_stream.side_effect = Exception(
        "Google API connection timeout."
    )

    with patch(
        "app.services.llm.google_handler.genai.Client", return_value=mock_client
    ):
        handler = GoogleHandler(api_key="dummy-key")
        events = []

        async for ev in handler.stream_chat(
            model="gemini-1.5-flash",
            messages=[{"role": "user", "content": "hi"}],
        ):
            events.append(ev)

    assert len(events) == 1
    assert events[0].type == StreamEventType.ERROR
    assert "Error occurred while streaming chat content from Google API." in str(
        events[0].data
    )


@pytest.mark.asyncio
async def test_google_handler_stream_chat_timeout_error():
    """
    Verify that when Groq/Google API times out (raising httpx.TimeoutException),
    the handler catches it and yields a safe error event.
    """
    mock_client = AsyncMock()

    # Mock return of TimeOutException
    mock_client.aio.models.generate_content_stream.side_effect = httpx.TimeoutException(
        "Request timed out connecting to Groq API."
    )

    with patch(
        "app.services.llm.google_handler.genai.Client", return_value=mock_client
    ):
        handler = GoogleHandler(api_key="dummy-key")
        events = []

        async for ev in handler.stream_chat(
            model="gemini-1.5-flash",
            messages=[{"role": "user", "content": "hi"}],
        ):
            events.append(ev)

    assert len(events) == 1
    assert events[0].type == StreamEventType.ERROR
    assert "timeout" in str(events[0].data).lower()


@pytest.mark.asyncio
async def test_google_handler_closes_stream_on_midstream_error():
    async def failing_stream():
        yield MockChunk("Hello")
        raise RuntimeError("Sensitive internal provider error")

    generator = failing_stream()

    response = MagicMock()
    response.__aiter__.side_effect = lambda: generator
    response.aclose = AsyncMock(side_effect=generator.aclose)

    mock_client = AsyncMock()
    mock_client.aio.models.generate_content_stream.return_value = response

    with patch(
        "app.services.llm.google_handler.genai.Client",
        return_value=mock_client,
    ):
        handler = GoogleHandler(api_key="dummy-key")
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
        "Error occurred while streaming chat content from Google API."
    )

    # No sensitive info frome exception is raised
    assert "Sensitive internal provider error" not in str(events)

    # Stream is closed.
    response.aclose.assert_awaited_once()
