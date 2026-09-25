from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, status

from app.models.conversation import ConversationRead, ConversationCreate, MessageRead, MessageCreate

router = APIRouter()

@router.get("/", response_model=List[ConversationRead], status_code=status.HTTP_200_OK)
async def list_conversations():
    """
    Retrieve a list of all conversations.
    """
    # TODO: Call service layer to fetch conversations from database
    return []


@router.post("/", response_model=ConversationRead, status_code=status.HTTP_201_CREATED)
async def create_conversation(payload: ConversationCreate):
    """
    Create a new conversation.
    """
    # TODO: Call service layer to create conversation in database
    # Mock data tạm thời để tránh lỗi Pydantic ValidationError
    return ConversationRead(
        id=1,
        title=payload.title,
        model_name=payload.model_name,
        total_tokens=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
