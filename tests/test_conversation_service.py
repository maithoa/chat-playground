import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Sequence

from app.services.conversation_service import ConversationService
from app.models.conversation import Conversation, ConversationCreate


@pytest.mark.asyncio
class TestConversationService:
    """Test suite for ConversationService."""

    async def test_get_all_conversations_returns_empty_list_when_no_conversations(self):
        """Test get_all_conversations returns empty list when database is empty."""
        # Arrange
        mock_session = AsyncMock(spec=AsyncSession)
        mock_result = MagicMock()
        mock_result.all.return_value = []
        mock_session.exec.return_value = mock_result

        # Act
        result = await ConversationService.get_all_conversations(mock_session)

        # Assert
        assert result == []
        mock_session.exec.assert_called_once()
        # We've verified that exec was called, which is sufficient for this test

    async def test_get_all_conversations_returns_list_of_conversations(self):
        """Test get_all_conversations returns list of conversations when data exists."""
        # Arrange
        mock_session = AsyncMock(spec=AsyncSession)
        mock_conversations = [
            Conversation(id=1, title="Test Conv 1", model_name="gpt-4o"),
            Conversation(id=2, title="Test Conv 2", model_name="gpt-3.5-turbo")
        ]
        mock_result = MagicMock()
        mock_result.all.return_value = mock_conversations
        mock_session.exec.return_value = mock_result

        # Act
        result = await ConversationService.get_all_conversations(mock_session)

        # Assert
        assert result == mock_conversations
        assert len(result) == 2
        assert result[0].id == 1
        assert result[1].id == 2
        mock_session.exec.assert_called_once()

    async def test_create_conversation_creates_and_returns_conversation(self):
        """Test create_conversation properly creates and returns a conversation."""
        # Arrange
        mock_session = AsyncMock(spec=AsyncSession)
        conversation_data = ConversationCreate(
            title="Test Conversation",
            model_name="gpt-4o"
        )

        # Mock the created conversation (what would be returned after refresh)
        created_conversation = Conversation(
            id=1,
            title="Test Conversation",
            model_name="gpt-4o"
        )

        # Act
        result = await ConversationService.create_conversation(
            session=mock_session,
            payload=conversation_data
        )

        # Assert
        # Verify session.add was called with a Conversation instance
        mock_session.add.assert_called_once()
        added_conversation = mock_session.add.call_args[0][0]
        assert isinstance(added_conversation, Conversation)
        assert added_conversation.title == "Test Conversation"
        assert added_conversation.model_name == "gpt-4o"

        # Verify commit and refresh were called
        mock_session.commit.assert_awaited_once()
        mock_session.refresh.assert_awaited_once()

        # The actual result would be the refreshed conversation from the DB
        # Since we're mocking, we'll check that the method returns something
        assert result is not None

    async def test_create_conversation_handles_different_payloads(self):
        """Test create_conversation works with various valid payloads."""
        # Arrange
        mock_session = AsyncMock(spec=AsyncSession)

        test_cases = [
            ConversationCreate(title="First Chat", model_name="claude-3"),
            ConversationCreate(title="Second Chat", model_name="llama-2"),
            ConversationCreate(title="", model_name="gpt-4"),  # Empty title
            ConversationCreate(model_name="gpt-4o")  # Using default title
        ]

        for conversation_data in test_cases:
            # Fresh mock for each test case
            mock_session = AsyncMock(spec=AsyncSession)

            # Act
            result = await ConversationService.create_conversation(
                session=mock_session,
                payload=conversation_data
            )

            # Assert - verify the session methods were called
            assert mock_session.add.call_count == 1
            assert mock_session.commit.await_count == 1
            assert mock_session.refresh.await_count == 1

            # Verify the added conversation has correct data
            added_conversation = mock_session.add.call_args[0][0]
            assert added_conversation.title == conversation_data.title
            assert added_conversation.model_name == conversation_data.model_name


if __name__ == "__main__":
    pytest.main([__file__])
