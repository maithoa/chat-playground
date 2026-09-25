import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.conversation import Conversation, Message, MessageRole


@pytest.mark.asyncio
async def test_create_conversation_and_messages(async_session: AsyncSession):
    """Test init Conversation with Message"""
    # Given
    conv = Conversation(title="Test Conv", model_name="gpt-4o")
    async_session.add(conv)
    await async_session.commit()
    await async_session.refresh(conv)

    msg = Message(
        conversation = conv,
        role=MessageRole.USER,
        content="Hello AI",
        prompt_tokens=10,
        completion_tokens=5,
        total_tokens=15,
    )
    async_session.add(msg)
    await async_session.commit()

    await async_session.refresh(conv)  # Refresh to get updated messages relationship

    # When
    statement = select(Conversation).where(Conversation.id == conv.id)
    result = await async_session.exec(statement)
    fetched_conv = result.first()

    # Then
    assert fetched_conv is not None
    assert fetched_conv.title == "Test Conv"
    assert fetched_conv.total_tokens == 0
    assert len(fetched_conv.messages) == 1
    assert fetched_conv.messages[0].content == "Hello AI"


@pytest.mark.asyncio
async def test_cascade_delete_messages(async_session: AsyncSession):
    """Test delete Conversation and confirm that related messages are deleted."""
    # Given
    conv = Conversation(title="Delete Me", model_name="gpt-4o")
    async_session.add(conv)
    await async_session.commit()

    msg = Message(
        conversation_id=conv.id, role=MessageRole.USER, content="Bye world"
    )
    async_session.add(msg)
    await async_session.commit()

    # When: Xóa Conversation
    await async_session.delete(conv)
    await async_session.commit()

    # Then: Message cũng phải biến mất
    result = await async_session.exec(
        select(Message).where(Message.conversation_id == conv.id)
    )
    assert len(result.all()) == 0
