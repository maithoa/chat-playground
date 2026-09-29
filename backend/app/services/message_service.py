from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.conversation import Conversation, Message, MessageCreate, MessageRead


class MessageService:
    @staticmethod
    async def get_conversation_messages(
        session: AsyncSession, conversation_id: int
    ) -> Sequence[Message]:
        """
        Retrieve all messages for a specific conversation order chronologically.
        """
        statement = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        result = await session.exec(statement)
        return result.all()

    @staticmethod
    async def get_message_by_id(
        session: AsyncSession, message_id: int
    ) -> Optional[Message]:
        """
        Retrieve a specific message by its ID from the database.
        """
        statement = select(Message).where(Message.id == message_id)
        result = await session.exec(statement)
        return result.first()

    @staticmethod
    async def add_message_to_conversation(
        session: AsyncSession,
        conversation_id: int,
        payload: MessageCreate,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        response_time_ms: float = 0.0,
    ) -> Message:
        """
        Create a new message and aggregate token counts and updated timestamp on the parent conversation.
        """

        # Fetch the conversation
        statement = select(Conversation).where(Conversation.id == conversation_id)
        result = await session.exec(statement)
        conversation = result.first()

        if not conversation:
            raise ValueError(f"Conversation with id {conversation_id} does not exist.")

        new_message = Message(
            **payload.model_dump(),
            conversation_id=conversation_id,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            response_time_ms=response_time_ms,
        )

        # Update the conversation's total tokens and updated_at timestamp
        conversation.total_tokens += new_message.total_tokens
        conversation.updated_at = datetime.now(timezone.utc)

        session.add(new_message)
        session.add(conversation)

        # Ensure the conversation is updated in the session
        await session.commit()
        await session.refresh(new_message)

        return new_message
