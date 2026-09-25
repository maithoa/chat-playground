import sys
from pathlib import Path
import pytest_asyncio
from httpx import AsyncClient, ASGITransport


from app.main import app
from app.core.config import settings

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as ac:
        yield ac

async def test_read_root(client):
    """The root endpoint should return a welcome message and docs path."""

    response = await client.get("/")

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Welcome to Chat Playground API"
    assert data["docs"] == "/docs"


async def test_health_endpoint(client):
    """The health endpoint should be reachable under the API version prefix and return status ok."""
    health_path = f"{settings.API_V1_STR}/health"

    response = await client.get(health_path)

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
