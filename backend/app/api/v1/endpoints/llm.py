from typing import List
from fastapi import APIRouter
from app.schemas.llm import ProviderInfo
from app.services.llm.service import LLMService

router = APIRouter(prefix="/llm", tags=["LLM Catalog"])


@router.get("/providers", response_model=List[ProviderInfo])
async def list_providers():
    """Return a list of LLM Cloud Providers and their models for Guest Mode"""
    return LLMService.get_llm_providers()
