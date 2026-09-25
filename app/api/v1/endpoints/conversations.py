from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends,status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.db import get_async_session
from app.models.conversation import ConversationRead, ConversationCreate, MessageRead, MessageCreate
from app.services.conversation_service import ConversationService

router = APIRouter()

@router.get("/", response_model=List[ConversationRead], status_code=status.HTTP_200_OK)
async def list_conversations(
    session: AsyncSession = Depends(get_async_session)
):
    """
    Retrieve a list of all conversations.
    """
    # Call service layer to fetch conversations from database
    conversations = await ConversationService.get_all_conversations(session)
    return conversations


@router.post("/", response_model=ConversationRead, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    session: AsyncSession = Depends(get_async_session),
    payload: ConversationCreate = None
):
    """
    Create a new conversation.
    """
    # Call service layer to create conversation in database

    return ConversationService.create_conversation(session, payload)
