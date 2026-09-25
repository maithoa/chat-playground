from typing import Sequence
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.conversation import Conversation, ConversationCreate

class ConversationService:
    @staticmethod
    async def get_all_conversations(session: AsyncSession) -> Sequence[Conversation]:
        """
        Retrieve all conversations from the database.
        """
        statement = select(Conversation)
        result = await session.exec(statement)
        return result.all()

    @staticmethod
    async def create_conversation(session:AsyncSession,
                                  payload: ConversationCreate)-> Conversation:
        """
        Create a new conversation in the database.
        """
        new_conversation = Conversation.model_validate(payload)
        session.add(new_conversation)
        await session.commit()
        await session.refresh(new_conversation)
        return new_conversation
