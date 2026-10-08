import json

from typing import Any, List, Optional
from enum import Enum

from pydantic import BaseModel, Field
from app.models.conversation import MessageBase


class ModelInfo(BaseModel):
    id: str
    name: str
    provider_id: Optional[str] = None
    context_window: int = 8192
    description: Optional[str] = None


class ProviderInfo(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_active: bool = True
    models: List[ModelInfo] = []


class ChatRequest(BaseModel):
    provider: str = Field(
        ..., json_schema_extra={"example": "google"}, description="Provider ID"
    )
    model: str = Field(
        ..., json_schema_extra={"example": "gemini-3.5-flash"}, description="Model ID"
    )
    messages: List[MessageBase] = Field(..., description="message history")
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0)


class StreamEventType(str, Enum):
    CONTENT = "content"
    USAGE = "usage"
    ERROR = "error"


class StreamEvent(BaseModel):
    type: StreamEventType
    data: Any

    def to_sse_data(self) -> str:
        """
        Serialize the payload for returning response to client

        Returns:
            {"type": "content", "content": "..."} or {"type": "usage", "usage": {...}}
        """
        payload = {"type": self.type.value, self.type.value: self.data}
        return f"data: {json.dumps(payload,ensure_ascii=False)}\n\n"
