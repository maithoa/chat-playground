import sys
from pathlib import Path
import pytest_asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession


# Import all models to ensure they are registered with SQLModel
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture(scope="function")
async def async_session() -> AsyncGenerator[AsyncSession, None]:
    # Create DB in-memory for each test case
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Create all tables in memory
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    # Provide session for test function
    async_session_maker = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with async_session_maker() as session:
        yield session

    # Remove tables after test completes
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)

    await engine.dispose()
