import pytest
from unittest.mock import AsyncMock, patch
from app.services.llm.service import LLMService
from app.schemas.llm import StreamEvent, StreamEventType


# Helper async generator that yields given events
async def _event_stream(events):
    for ev in events:
        yield ev


class MockHandler:
    def __init__(self, events):
        self._events = events

    async def stream_chat(self, model, messages, **kwargs):
        async for ev in _event_stream(self._events):
            yield ev


@pytest.mark.asyncio
async def test_llm_service_stream_chat_success():
    events = [
        StreamEvent(type=StreamEventType.CONTENT, data="Hello"),
        StreamEvent(type=StreamEventType.CONTENT, data=","),
        StreamEvent(type=StreamEventType.CONTENT, data="world"),
        StreamEvent(
            type=StreamEventType.USAGE,
            data={"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3},
        ),
    ]

    mock_handler = MockHandler(events)

    with patch.object(LLMService, "_handlers", {"dummy": mock_handler}), patch.object(
        LLMService, "on_usage_complete"
    ) as mock_usage_cb:
        result = []
        async for ev in LLMService.stream_chat(
            provider="dummy",
            model="model-x",
            messages=[{"role": "user", "content": "hi"}],
        ):
            if ev.type == StreamEventType.CONTENT:
                result.append(ev.data)
        assert result == ["Hello", ",", "world"]
        mock_usage_cb.assert_called_once_with(
            {"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3}
        )


@pytest.mark.asyncio
async def test_llm_service_missing_provider():
    with patch.object(LLMService, "_handlers", {}):
        with pytest.raises(
            ValueError, match="Provider unknown does not have API key configured."
        ):
            async for _ in LLMService.stream_chat(
                provider="unknown", model="model-x", messages=[]
            ):
                pass
