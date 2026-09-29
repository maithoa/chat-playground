# All routers of v1
from fastapi import APIRouter
from app.api.v1.endpoints import conversations, llm

api_router = APIRouter()

# Include all endpoint domain to v1 router
api_router.include_router(conversations.router)
api_router.include_router(llm.router)
