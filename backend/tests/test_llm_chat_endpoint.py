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
from unittest.mock import MagicMock, patch

from app.main import app
from app.schemas.llm import ProviderInfo, ModelInfo, ChatRequest

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


async def _mock_stream_chat(*_args, **_kwargs) -> AsyncGenerator[str, None]:
    """Async generator yielding a couple of deterministic chunks.

    The real implementation yields strings that represent the LLM response.  For
    the purpose of the test we simply emit two static chunks.
    """

    for chunk in ("chunk1", "chunk2"):
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
            new=MagicMock(return_value=_mock_stream_chat()),
        ):
            yield


def _post_chat(payload: dict):
    """Helper to POST to the chat endpoint using the test client.

    ``TestClient`` returns a ``Response`` object that already provides an
    ``iter_lines`` iterator for streamed responses. No ``stream`` argument is
    required (or supported) on ``client.post``.
    """

    return client.post("/api/v1/llm/chat", json=payload)


def test_chat_stream_success():
    """A valid request should return a streaming response with two chunks.

    The response body is a series of ``data: {"content": "..."}`` lines.  The
    test collects those lines, decodes the JSON payload and asserts the content
    matches the mocked generator output.
    """

    payload = {
        "provider": "testprovider",
        "model": "testmodel",
        "messages": [],
        "temperature": 0.7,
    }
    response = _post_chat(payload)

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
    assert len(data_lines) == 2

    contents = []
    for line in data_lines:
        # ``data: {"content": "chunk"}``
        json_part = line.removeprefix("data: ").strip()

        payload = json.loads(json_part)
        contents.append(payload["content"])

    assert contents == ["chunk1", "chunk2"]


def test_chat_stream_invalid_provider():
    """Request with an unknown provider should raise a 400 error."""

    payload = {
        "provider": "unknown",
        "model": "testmodel",
        "messages": [],
        "temperature": 0.7,
    }
    response = _post_chat(payload)
    assert response.status_code == 400
    assert "Provider 'unknown' is not supported" in response.json()["detail"]


def test_chat_stream_invalid_model():
    """Request with an unknown model for a valid provider should raise 400."""

    payload = {
        "provider": "testprovider",
        "model": "unknownmodel",
        "messages": [],
        "temperature": 0.7,
    }
    response = _post_chat(payload)
    assert response.status_code == 400
    assert "Model 'unknownmodel' is not supported" in response.json()["detail"]
