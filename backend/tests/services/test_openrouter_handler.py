import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.llm.openrouter_handler import OpenRouterHandler


# Helper class that mocks the Chunk returned from OpenRouter API
class MockChunk:
    def __init__(self, content: str | None):
        self.choices = [MagicMock(delta=MagicMock(content=content))]


def test_openrouter_handler_stream_chat_success():
    # Mock the chunk data returned by OpenRouter API
    mock_chunks = [
        MockChunk("Hello"),
        MockChunk(","),
        MockChunk("how"),
        MockChunk("are"),
        MockChunk("you"),
        MockChunk("?"),
        MockChunk(None),
    ]

    async def mock_stream():
        for chunk in mock_chunks:
            yield chunk

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_stream())

    # Patch AsyncOpenAI in the module
    with patch(
        "app.services.llm.openrouter_handler.AsyncOpenAI", return_value=mock_client
    ):
        handler = OpenRouterHandler(api_key="sk-test-key")

        messages = [{"role": "user", "content": "Hi"}]
        result = []

        async def _run():
            async for chunk in handler.stream_chat(
                model="openrouter/gpt-4", messages=messages
            ):
                result.append(chunk)

        import asyncio

        asyncio.run(_run())

        assert result == ["Hello", ",", "how", "are", "you", "?"]
        mock_client.chat.completions.create.assert_called_once_with(
            model="openrouter/gpt-4", messages=messages, stream=True
        )


def test_openrouter_handler_missing_api_key():
    with patch("app.services.llm.openrouter_handler.settings") as mock_settings:
        mock_settings.OPENROUTER_API_KEY = None
        with pytest.raises(ValueError, match="Could not find OpenRouter API key."):
            OpenRouterHandler(api_key=None)
