"""Tests for the ``POST /api/v1/llm/chat`` streaming endpoint.

The endpoint validates the provider and model against the catalog returned
by :class:`app.services.llm.service.LLMService`.  It then streams the
LLM response using ``StreamingResponse`` where each line is prefixed with
``data: `` and a JSON payload containing the ``content`` field.

These tests mock ``LLMService`` to avoid real network calls and to keep the
tests fast and deterministic.
"""

from __future__ import annotations

import json
from typing import AsyncGenerator, List

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch, AsyncMock
import asyncio

from app.main import app
from app.schemas.llm import ProviderInfo, ModelInfo, ChatRequest
from app.schemas.llm import StreamEventType, StreamEvent

from app.api.v1.endpoints.llm import chat_stream

client = TestClient(app)


def _dummy_provider() -> List[ProviderInfo]:
    """Return a deterministic provider catalog used by the mocked service.

    The catalog contains a single provider ``testprovider`` with a single model
    ``testmodel``.  This mirrors the shape expected by the endpoint validation
    logic.
    """

    model = ModelInfo(id="testmodel", name="Test Model", provider_id="testprovider")
    provider = ProviderInfo(
        id="testprovider",
        name="Test Provider",
        description="A dummy provider for tests",
        is_active=True,
        models=[model],
    )
    return [provider]


async def _mock_stream_chat(*_args, **_kwargs) -> AsyncGenerator[StreamEvent, None]:
    """Async generator yielding a couple of deterministic chunks.

    The real implementation yields strings that represent the LLM response.  For
    the purpose of the test we simply emit two static chunks.
    """
    usage_data = {
        "prompt_tokens": 5,
        "completion_tokens": 15,
        "total_tokens": 20,
        "time_to_first_token_ms": 0.5,
        "tokens_per_second": 200,
    }

    for chunk in (
        StreamEvent(type=StreamEventType.CONTENT, data="chunk1"),
        StreamEvent(type=StreamEventType.CONTENT, data="chunk2"),
        StreamEvent(type=StreamEventType.USAGE, data=usage_data),
    ):
        yield chunk


@pytest.fixture(autouse=True)
def _mock_llm_service():
    """Patch ``LLMService`` methods for the duration of the test module.

    * ``get_llm_providers`` returns a static catalog.
    * ``stream_chat`` returns the async generator defined above.
    """

    with patch(
        "app.services.llm.service.LLMService.get_llm_providers",
        return_value=_dummy_provider(),
    ):
        # Use ``MagicMock`` so that ``LLMService.stream_chat`` returns the async
        # generator directly, without wrapping it in a coroutine. This allows the
        # production code to remain a simple ``async for`` loop.
        with patch(
            "app.services.llm.service.LLMService.stream_chat",
            side_effect=_mock_stream_chat,
        ):
            yield


@pytest.fixture(autouse=True)
def mock_redis():

    mock_pipeline = MagicMock()
    mock_pipeline.execute = AsyncMock(return_value=[1, True])

    redis_client = MagicMock()
    redis_client.pipeline.return_value = mock_pipeline

    with patch("app.core.security.redis_client", new=redis_client):
        yield redis_client


def _post_chat(headers: dict, payload: dict):
    """Helper to POST to the chat endpoint using the test client.

    ``TestClient`` returns a ``Response`` object that already provides an
    ``iter_lines`` iterator for streamed responses. No ``stream`` argument is
    required (or supported) on ``client.post``.
    """
    if headers is not None:
        return client.post("/api/v1/llm/chat", headers=headers, json=payload)
    else:
        return client.post("/api/v1/llm/chat", json=payload)


def test_chat_stream_success():
    """A valid request should return a streaming response with two chunks.

    The response body is a series of ``data: {"content": "..."}`` lines.  The
    test collects those lines, decodes the JSON payload and asserts the content
    matches the mocked generator output.
    """
    headers = {"x-session-id": "12345"}

    payload = {
        "provider": "testprovider",
        "model": "testmodel",
        "messages": [],
        "temperature": 0.7,
    }
    response = _post_chat(headers, payload)

    assert response.status_code == 200
    # FastAPI returns ``application/json`` for normal responses, but streaming
    # uses ``text/event-stream``.
    assert "text/event-stream" in response.headers.get("content-type", "")

    # The TestClient provides an iterator over the raw bytes of the streamed
    # response. Each ``yield`` from the mocked ``stream_chat`` should result in
    # a separate ``data:`` line.
    lines = [line for line in response.iter_lines() if line]
    # Filter only the ``data:`` lines.
    data_lines = [ln for ln in lines if ln.startswith("data:")]
    # Two chunks are emitted by the mock generator, so we expect two lines.
    assert len(data_lines) == 3

    contents = []
    usage = None
    for line in data_lines:
        # ``data: {"type": "content", "content": "chunk1"}``
        json_part = line.removeprefix("data: ").strip()

        event_payload = json.loads(json_part)

        event_type = event_payload.get("type")
        if event_type == StreamEventType.CONTENT.value:
            contents.append(event_payload["content"])
        if event_type == StreamEventType.USAGE.value:
            usage = event_payload["usage"]

    assert contents == ["chunk1", "chunk2"]
    assert usage == {
        "prompt_tokens": 5,
        "completion_tokens": 15,
        "total_tokens": 20,
        "time_to_first_token_ms": 0.5,
        "tokens_per_second": 200,
    }


def test_chat_stream_invalid_provider():
    """Request with an unknown provider should raise a 400 error."""
    headers = {"x-session-id": "12345"}
    payload = {
        "provider": "unknown",
        "model": "testmodel",
        "messages": [],
        "temperature": 0.7,
    }
    response = _post_chat(headers, payload)
    assert response.status_code == 400
    assert "Provider 'unknown' is not supported" in response.json()["detail"]


def test_chat_stream_invalid_model():
    """Request with an unknown model for a valid provider should raise 400."""
    headers = {"x-session-id": "12345"}
    payload = {
        "provider": "testprovider",
        "model": "unknownmodel",
        "messages": [],
        "temperature": 0.7,
    }
    response = _post_chat(headers, payload)
    assert response.status_code == 400
    assert "Model 'unknownmodel' is not supported" in response.json()["detail"]


@pytest.mark.asyncio
async def test_chat_disconnect_from_client_cleans_up_service_stream():
    waiting_for_next_chunk = asyncio.Event()
    stream_closed = asyncio.Event()
    wait_forever = asyncio.Event()

    async def fake_stream_chat(*args, **kwargs):
        try:
            yield StreamEvent(type=StreamEventType.CONTENT, data="Hello")

            waiting_for_next_chunk.set()
            await wait_forever.wait()
        finally:
            stream_closed.set()

    headers = {"x-session-id": "12345"}
    payload = {
        "provider": "testprovider",
        "model": "testmodel",
        "messages": [],
        "temperature": 0.7,
    }

    request_received = False

    async def receive():
        nonlocal request_received
        if not request_received:
            request_received = True
            return {
                "type": "http.request",
                "body": json.dumps(payload).encode(),
                "more_body": False,
            }
        await waiting_for_next_chunk.wait()
        return {"type": "http.disconnect"}

    sent_messages = []

    async def send(message):
        sent_messages.append(message)

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
        "query_string": b"",
        "root_path": "",
        "headers": [
            (b"content-type", b"application/json"),
            (b"x-session-id", b"12345"),
        ],
        "client": ("127.0.0.1", 12345),
        "server": ("test", 80),
    }

    with patch(
        "app.services.llm.service.LLMService.stream_chat", side_effect=fake_stream_chat
    ):
        await asyncio.wait_for(
            app(scope, receive, send),
            timeout=2.0,
        )

    assert waiting_for_next_chunk.is_set()
    assert stream_closed.is_set()

    response_start = next(
        message for message in sent_messages if message["type"] == "http.response.start"
    )

    assert response_start["status"] == 200

    assert any(
        message["type"] == "http.response.body" and b"Hello" in message.get("body", b"")
        for message in sent_messages
    )


@pytest.mark.asyncio
async def test_chat_closes_service_stream_when_closed_early():
    service_closed = False

    async def fake_service_stream(*args, **kwargs):
        nonlocal service_closed
        try:
            yield StreamEvent(type=StreamEventType.CONTENT, data="Hello")
            yield StreamEvent(type=StreamEventType.CONTENT, data="World")
        finally:
            service_closed = True

    payload = {
        "provider": "testprovider",
        "model": "testmodel",
        "messages": [],
        "temperature": 0.7,
    }
    request = ChatRequest(**payload)

    with patch(
        "app.services.llm.service.LLMService.stream_chat",
        side_effect=fake_service_stream,
    ):
        response = await chat_stream(request=request, session_id="12345")
        api_stream = response.body_iterator

        try:
            first_chunk = await anext(api_stream)

            assert "Hello" in first_chunk
            assert service_closed is False
        finally:
            await api_stream.aclose()

        assert service_closed is True


def test_chat_missing_session_id(mock_redis):
    payload = {
        "provider": "testprovider",
        "model": "testmodel",
        "messages": [],
        "temperature": 0.7,
    }

    with patch("app.services.llm.service.LLMService.stream_chat") as mock_stream:
        response = _post_chat(headers=None, payload=payload)

    assert response.status_code == 400
    assert response.json()["detail"] == ("Missing x-session-id in header.")

    mock_redis.pipeline.assert_not_called()
    mock_stream.assert_not_called()


def test_chat_rate_limit_exceeded(mock_redis):
    pipe = mock_redis.pipeline.return_value
    pipe.execute.return_value = [11, True]

    payload = {
        "provider": "testprovider",
        "model": "testmodel",
        "messages": [],
        "temperature": 0.7,
    }

    with patch("app.services.llm.service.LLMService.stream_chat") as mock_stream:
        response = _post_chat(
            headers={"x-session-id": "12345"},
            payload=payload,
        )

    assert response.status_code == 429
    assert response.json()["detail"] == ("Exceeded limit of 10 requests/min.")

    pipe.execute.assert_awaited_once_with()
    mock_stream.assert_not_called()
