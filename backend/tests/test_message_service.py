import pytest
from unittest.mock import MagicMock, AsyncMock
from sqlmodel.ext.asyncio.session import AsyncSession

# Assuming the following models are available in the test scope
# You may need to adjust imports based on your actual project structure
from app.models.conversation import Conversation, Message, MessageCreate, MessageRole
from app.services.message_service import MessageService

# --- Fixtures ---

@pytest.fixture
def mock_session():
    """Return a fresh AsyncMock mimicking ``AsyncSession``.

    Each test gets its own instance to avoid cross‑test state leakage.
    """
    return AsyncMock(spec=AsyncSession)

@pytest.fixture
def mock_conversation():
    """Create a simple ``Conversation`` instance used in tests.

    The object mirrors what the real model would contain for the fields
    accessed by ``MessageService``.
    """
    from datetime import datetime, timezone
    return Conversation(id=1, total_tokens=100, updated_at=datetime.now(timezone.utc))

@pytest.fixture
def mock_message_create():
    """Return a ``MessageCreate`` instance for ``add_message_to_conversation``.
    """
    return MessageCreate(
        content="Test content",
        sender_id=1,
        is_user_message=True,
        role=MessageRole.USER,
    )

# --- Test Class ---

class TestMessageService:
    """Test suite for :class:`MessageService`."""

    @pytest.mark.asyncio
    async def test_get_conversation_messages_returns_list(self, mock_session):
        """``get_conversation_messages`` should return all messages for a conversation.

        The session ``exec`` call is mocked to return a result whose ``all``
        method yields a predefined list of ``Message`` objects.
        """
        # Arrange
        mock_msg1 = Message(id=1, conversation_id=1, content="Hello")
        mock_msg2 = Message(id=2, conversation_id=1, content="World")
        mock_result = MagicMock()
        mock_result.all.return_value = [mock_msg1, mock_msg2]
        mock_session.exec.return_value = mock_result

        # Act
        messages = await MessageService.get_conversation_messages(
            session=mock_session, conversation_id=1
        )

        # Assert
        assert isinstance(messages, list)
        assert messages == [mock_msg1, mock_msg2]
        mock_session.exec.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_message_by_id_returns_message_or_none(self, mock_session):
        """``get_message_by_id`` should return a single message or ``None``.
        """
        # Successful lookup
        mock_msg = Message(id=10, conversation_id=2, content="Found")
        mock_result_success = MagicMock()
        mock_result_success.first.return_value = mock_msg
        mock_session.exec.return_value = mock_result_success

        result = await MessageService.get_message_by_id(mock_session, 10)
        assert result is mock_msg

        # Not‑found case
        mock_result_none = MagicMock()
        mock_result_none.first.return_value = None
        mock_session.exec.return_value = mock_result_none

        result_none = await MessageService.get_message_by_id(mock_session, 99)
        assert result_none is None

    @pytest.mark.asyncio
    async def test_add_message_to_conversation_creates_and_updates(self, mock_session, mock_conversation, mock_message_create):
        """``add_message_to_conversation`` should create a Message, update the parent Conversation,
        and persist both via the session.
        """
        # Mock fetching the conversation
        mock_conv_result = MagicMock()
        mock_conv_result.first.return_value = mock_conversation
        # ``exec`` is called once to retrieve the conversation
        mock_session.exec.return_value = mock_conv_result

        # Act
        new_msg = await MessageService.add_message_to_conversation(
            session=mock_session,
            conversation_id=mock_conversation.id,
            payload=mock_message_create,
            prompt_tokens=5,
            completion_tokens=15,
            response_time_ms=123.4,
        )

        # Assertions on the returned Message
        assert isinstance(new_msg, Message)
        assert new_msg.prompt_tokens == 5
        assert new_msg.completion_tokens == 15
        assert new_msg.total_tokens == 20
        assert new_msg.response_time_ms == 123.4

        # Verify that the conversation's token count was updated
        assert mock_conversation.total_tokens == 120  # original 100 + 20
        # ``session.add`` should be called twice (Message, Conversation)
        assert mock_session.add.call_count == 2
        added_args = [call[0][0] for call in mock_session.add.call_args_list]
        assert any(isinstance(arg, Message) for arg in added_args)
        assert any(isinstance(arg, Conversation) for arg in added_args)
        # Commit and refresh should be awaited exactly once each
        mock_session.commit.assert_awaited_once()
        mock_session.refresh.assert_awaited_once_with(new_msg)

    @pytest.mark.asyncio
    async def test_add_message_to_conversation_invalid_conversation_raises(self, mock_session, mock_message_create):
        """When the specified conversation does not exist, ``add_message_to_conversation``
        should raise a ``ValueError``.

        The service fetches the conversation via ``session.exec``. We mock this call to
        return a result whose ``first`` method yields ``None`` to simulate a missing
        conversation.
        """
        # Mock ``exec`` to return a result with ``first`` = None
        mock_conv_result = MagicMock()
        mock_conv_result.first.return_value = None
        mock_session.exec.return_value = mock_conv_result

        with pytest.raises(ValueError) as exc_info:
            await MessageService.add_message_to_conversation(
                session=mock_session,
                conversation_id=999,  # non‑existent ID
                payload=mock_message_create,
                prompt_tokens=0,
                completion_tokens=0,
                response_time_ms=0.0,
            )

        assert "Conversation with id 999 does not exist" in str(exc_info.value)
