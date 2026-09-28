from typing import List, Optional
from pydantic import BaseModel

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
