import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.llm.openai_handler import OpenAIHandler


# Helper class that mock the Chunk returned from OPENAI API
class MockChunk:
    def __init__(self, content: str | None):
        self.choices = [MagicMock(delta=MagicMock(content=content))]


@pytest.mark.asyncio
async def test_openai_handler_stream_chat_success():
    # Mock the chunk data returned by openai api
    mock_chunks = [
        MockChunk("Hello"),
        MockChunk(","),
        MockChunk("how"),
        MockChunk("are"),
        MockChunk("you"),
        MockChunk("?"),
        MockChunk(None),
    ]

    # Generator mocks asynchronous stream
    async def mock_stream():
        for chunk in mock_chunks:
            yield chunk

    # Mock AsyncOpenAI client
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_stream())

    # Patch AsyncOpenAI in module openai_handler
    with patch("app.services.llm.openai_handler.AsyncOpenAI", return_value=mock_client):
        handler = OpenAIHandler(api_key="sk-test-key")

        messages = [{"role": "user", "content": "Hi"}]
        result = []

        # Call openai_handler streamchat function
        async for chunk in handler.stream_chat(model="gpt-4o", messages=messages):
            result.append(chunk)

        # Assertions
        assert result == ["Hello", ",", "how", "are", "you", "?"]
        mock_client.chat.completions.create.assert_called_once_with(
            model="gpt-4o", messages=messages, stream=True
        )


def test_openai_handler_missing_api_key():
    with patch("app.services.llm.openai_handler.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = None

        with pytest.raises(ValueError, match="Could not find OPENAPI API key."):
            OpenAIHandler(api_key=None)
