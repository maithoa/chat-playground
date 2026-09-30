import sys
from pathlib import Path
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

# Import all models to ensure they are registered with SQLModel
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# NOTE: The async database fixture was originally provided via ``pytest_asyncio``.
# Since that dependency is not available, we expose a simple synchronous fixture
# that creates an async engine and yields a session. Tests that require the
# fixture can use ``asyncio.run`` to drive the async session if needed.

import pytest


@pytest.fixture(scope="function")
def async_session() -> AsyncGenerator[AsyncSession, None]:
    """Create an in‑memory async SQLite session for tests.

    The fixture returns a regular (synchronous) generator that yields an
    ``AsyncSession`` instance.  Test code can ``await`` database operations on
    the returned session.  Cleanup drops all tables and disposes the engine.
    """

    # Create the async engine for an in‑memory SQLite database.
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Helper to run async setup/teardown steps synchronously.
    import asyncio

    async def _create_schema():
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

    async def _drop_schema():
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.drop_all)
        await engine.dispose()

    # Initialise the database schema before yielding the session.
    asyncio.run(_create_schema())

    # Create a session maker bound to the engine.
    async_session_maker = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    session = async_session_maker()

    try:
        # Yield the session to the test.
        yield session
    finally:
        # Ensure the session is closed and the schema is torn down.
        async def _close_and_cleanup():
            await session.close()
            await _drop_schema()

        asyncio.run(_close_and_cleanup())
