from typing import List, Optional
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
