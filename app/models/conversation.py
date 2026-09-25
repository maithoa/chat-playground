# Domain: Conversation & Messages
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List
from pydantic import ConfigDict
from sqlmodel import Field, Relationship, SQLModel

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

#================================
# 1. Message Model & Schema
#================================

class MessageBase(SQLModel):
    role: MessageRole
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(MessageBase):
    pass

class MessageRead(MessageBase):
    id: int
    conversation_id: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    response_time_ms: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Message(MessageBase, table=True):
    __tablename__ = "messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: int = Field(
        foreign_key="conversations.id",
        index=True,
        ondelete="CASCADE"
        )
    # Metrics for each chat turn
    prompt_tokens: int = Field(default=0)
    completion_tokens: int = Field(default=0)
    total_tokens: int = Field(default=0)
    response_time_ms: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationship to Conversation
    conversation: Optional["Conversation"] = Relationship(back_populates="messages")


#===============================
# 2. Conversation Model & Schema
#===============================

class ConversationBase(SQLModel):
    title: Optional[str] = Field(default="New Conversation")
    model_name: str = Field(index=True, default="gpt-4o")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ConversationCreate(ConversationBase):
    pass

# Schema for reading conversations without messages
class ConversationRead(ConversationBase):
    id: int
    total_tokens: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Schema for reading a conversation along with its messages
class ConversationWithMessages(ConversationRead):
    messages: List[MessageRead] = []

class Conversation(ConversationBase, table=True):
    __tablename__ = "conversations"

    id: Optional[int] = Field(default=None, primary_key=True)
    total_tokens: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationship to Messages
    messages: List[Message] = Relationship(
        back_populates="conversation",
        sa_relationship_kwargs={
            "lazy": "selectin",
            "cascade": "all, delete-orphan"}
    )
