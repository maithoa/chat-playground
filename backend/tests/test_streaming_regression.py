import pytest
import asyncio
import json
from httpx import AsyncClient, ASGITransport, Request
from unittest.mock import patch, AsyncMock, MagicMock
from app.main import app
from app.services.llm.catalog import ProviderInfo, ModelInfo
from app.services.llm.service import LLMService
from app.services.llm.groq_handler import GroqHandler
from app.schemas.llm import StreamEvent, StreamEventType
from groq import APITimeoutError


@pytest.fixture
async def client():
    """Async test client fixture for FastAPI integration tests."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture(autouse=True)
def mock_llm_providers():
    """Autouse fixture to ensure LLM providers validation always passes in CI/CD without real API keys."""
    providers = [
        ProviderInfo(
            id="groq",
            name="Groq",
            models=[ModelInfo(id="openai/gpt-oss-120b", name="GPT-OSS 120B")],
        )
    ]
    with patch(
        "app.services.llm.service.LLMService.get_llm_providers", return_value=providers
    ):
        yield


@pytest.fixture(autouse=True)
def mock_redis():

    mock_pipeline = MagicMock()
    mock_pipeline.execute = AsyncMock(return_value=[1, True])

    mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
    mock_pipeline.__aexit__ = AsyncMock(return_value=None)

    redis_client = MagicMock()
    redis_client.pipeline.return_value = mock_pipeline
    redis_client.get = AsyncMock(return_value=None)

    with patch("app.core.security.redis_client", new=redis_client):
        yield redis_client


# ==========================================
# GROUP 1: LLM Streaming, Disconnects & Timeouts
# ==========================================


@pytest.mark.asyncio
async def test_streaming_disconnect_handling():
    first_chunk_sent = asyncio.Event()
    stream_closed = asyncio.Event()
    wait_forever = asyncio.Event()
    sent_messages = []
    request_received = False

    payload = {
        "provider": "groq",
        "model": "openai/gpt-oss-120b",
        "messages": [{"role": "user", "content": "hi"}],
    }

    async def fake_stream(*args, **kwargs):
        try:
            yield StreamEvent(
                type=StreamEventType.CONTENT,
                data="Hello",
            )
            await wait_forever.wait()
        finally:
            stream_closed.set()

    async def receive():
        nonlocal request_received

        if not request_received:
            request_received = True
            return {
                "type": "http.request",
                "body": json.dumps(payload).encode(),
                "more_body": False,
            }

        # Ngắt kết nối sau khi backend gửi chunk đầu tiên.
        await first_chunk_sent.wait()
        return {"type": "http.disconnect"}

    async def send(message):
        sent_messages.append(message)

        if message["type"] == "http.response.body" and message.get("body"):
            first_chunk_sent.set()

    scope = {
        "type": "http",
        "asgi": {
            "version": "3.0",
            "spec_version": "2.3",
        },
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/v1/llm/chat",
        "raw_path": b"/api/v1/llm/chat",
        "query_string": b"",
        "root_path": "",
        "headers": [
            (b"content-type", b"application/json"),
            (b"x-session-id", b"34567"),
            (b"x-device-fp", b"abcde"),
        ],
        "client": ("127.0.0.1", 12345),
        "server": ("test", 80),
    }

    with patch.object(
        LLMService,
        "stream_chat",
        side_effect=fake_stream,
    ):
        await asyncio.wait_for(
            app(scope, receive, send),
            timeout=2.0,
        )

    assert first_chunk_sent.is_set()
    assert stream_closed.is_set()

    start = next(
        message for message in sent_messages if message["type"] == "http.response.start"
    )
    assert start["status"] == 200


@pytest.mark.asyncio
async def test_streaming_cancellation_closes_provider_stream():
    waiting = asyncio.Event()
    blocker = asyncio.Event()

    async def provider_stream():
        yield MagicMock(
            choices=[MagicMock(delta=MagicMock(content="Hello"))],
            usage=None,
        )
        waiting.set()
        await blocker.wait()

    generator = provider_stream()

    response = MagicMock()
    response.__aiter__.side_effect = lambda: generator
    response.close = AsyncMock(side_effect=generator.aclose)

    mock_client = AsyncMock()
    mock_client.chat.completions.create.return_value = response

    with patch(
        "app.services.llm.groq_handler.AsyncGroq",
        return_value=mock_client,
    ):
        handler = GroqHandler(api_key="dummy-key")

    received = []

    async def consume():
        async for event in LLMService.stream_chat(
            provider="groq",
            model="test-model",
            messages=[{"role": "user", "content": "hi"}],
        ):
            received.append(event)

    with (
        patch.object(LLMService, "_ensure_init_handlers"),
        patch.object(LLMService, "_handlers", {"groq": handler}),
    ):
        task = asyncio.create_task(consume())

        try:
            # Chắc chắn provider đã phát content và đang chờ.
            await asyncio.wait_for(waiting.wait(), timeout=2.0)

            task.cancel()

            # Cancellation phải truyền qua LLMService.
            with pytest.raises(asyncio.CancelledError):
                await asyncio.wait_for(task, timeout=2.0)
        finally:
            if not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)

    assert [event.type for event in received] == [
        StreamEventType.CONTENT,
    ]
    assert received[0].data == "Hello"
    response.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_streaming_handles_groq_sdk_timeout():
    mock_client = AsyncMock()
    mock_client.chat.completions.create.side_effect = APITimeoutError(
        request=Request("POST", "https://api.groq.com/test")
    )

    with patch(
        "app.services.llm.groq_handler.AsyncGroq",
        return_value=mock_client,
    ):
        handler = GroqHandler(api_key="dummy-key")

    async def collect_events():
        return [
            event
            async for event in handler.stream_chat(
                model="test-model",
                messages=[{"role": "user", "content": "hi"}],
            )
        ]

    events = await asyncio.wait_for(
        collect_events(),
        timeout=2.0,
    )

    assert len(events) == 1
    assert events[0].type == StreamEventType.ERROR
    assert events[0].data == "Timeout trying to access Groq API."
    mock_client.chat.completions.create.assert_awaited_once()


# ==========================================
# GROUP 2: Exception Leakage & Security Sanitization
# ==========================================


@pytest.mark.anyio
async def test_exception_leakage_and_credential_safety(client: AsyncClient):
    """
    Verify no internal exception details, tracebacks, or credentials are leaked to clients.
    Simulates an internal deep-layer service failure containing sensitive data.
    """
    headers = {"x-session-id": "12345", "x-device-fp": "abcde"}
    payload = {
        "provider": "groq",
        "model": "openai/gpt-oss-120b",
        "messages": [{"role": "user", "content": "trigger internal failure"}],
    }

    # Simulate provider throwing an exception with sensitive mock details
    async def failing_generator(*args, **kwargs):
        raise ValueError(
            "Database connection failed: user_password=Secret123, file '/app/secrets.py', line 45"
        )
        yield  # unreachable

    with patch(
        "app.services.llm.service.LLMService.stream_chat",
        return_value=failing_generator(),
    ):
        async with client.stream(
            "POST", "/api/v1/llm/chat", headers=headers, json=payload
        ) as response:
            assert response.status_code == 200
            response_body = ""
            async for chunk in response.aiter_text():
                response_body += chunk
                if "error" in response_body.lower():
                    break

    error_body = response_body.lower()

    # ❌ Forbidden security leak patterns inside the streamed response
    forbidden_keywords = [
        "traceback",
        'file "/',
        "line ",
        "api_key",
        "password",
        "secret123",
        "secrets.py",
        "bearer ",
        "sk-",
    ]

    for keyword in forbidden_keywords:
        assert (
            keyword not in error_body
        ), f"Security violation: Streamed response leaked sensitive keyword '{keyword}'!"


# ==========================================
# GROUP 3: Uninitialized Metrics & Empty Payload Edge Cases
# ==========================================


@pytest.mark.anyio
async def test_endpoint_accepts_empty_stream(client: AsyncClient):
    """
    Verify backend handles provider returning empty streams or uninitialized metrics safely
    without throwing NoneType errors.
    """

    async def empty_generator(*args, **kwargs):
        if False:
            yield  # empty generator yielding nothing

    headers = {"x-session-id": "12345", "x-device-fp": "abcde"}

    payload = {
        "provider": "groq",
        "model": "openai/gpt-oss-120b",
        "messages": [{"role": "user", "content": "empty response test"}],
    }

    with patch(
        "app.services.llm.service.LLMService.stream_chat",
        return_value=empty_generator(),
    ):
        response = await client.post("/api/v1/llm/chat", headers=headers, json=payload)
        assert response.status_code == 200
