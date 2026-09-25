# Async engine & session dependency.
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings

# 1. Create async engine
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,
    future=True,
)

# 2. Create async session factory
async_session_maker = sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# 3. Create table automatically (Called when Startup)
async def init_db() -> None:
    async with async_engine.begin() as conn:
        #Import models for SQLModel to register tables metadata
        import app.models.conversation

        await conn.run_sync(SQLModel.metadata.create_all)

# 4. Dependency Injection for endpoints
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
