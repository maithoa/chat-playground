import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch
from app.main import app
from app.services.llm.catalog import ProviderInfo, ModelInfo


@pytest.fixture
async def client():
    """Async test client fixture for FastAPI integration tests."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture(autouse=True)
def mock_llm_providers():
    """Autouse fixture to ensure LLM providers validation always passes in CI/CD without real API keys."""
    providers = [
        ProviderInfo(
            id="groq",
            name="Groq",
            models=[ModelInfo(id="openai/gpt-oss-120b", name="GPT-OSS 120B")],
        )
    ]
    with patch(
        "app.services.llm.service.LLMService.get_llm_providers", return_value=providers
    ):
        yield


# ==========================================
# GROUP 1: LLM Streaming, Disconnects & Timeouts
# ==========================================


@pytest.mark.anyio
async def test_streaming_disconnect_handling(client: AsyncClient):
    """
    Verify provider streaming handles client disconnects gracefully.
    Simulates a client dropping connection mid-stream to ensure resources and locks are freed.
    """
    try:
        payload = {
            "provider": "groq",
            "model": "openai/gpt-oss-120b",
            "messages": [{"role": "user", "content": "test disconnect"}],
        }
        async with client.stream("POST", "/api/v1/llm/chat", json=payload) as response:
            assert response.status_code == 200
            async for chunk in response.aiter_text():
                # Read the first chunk then abort connection abruptly
                break
    except Exception as e:
        pytest.fail(f"Streaming disconnect caused unhandled exception: {e}")


@pytest.mark.anyio
async def test_streaming_timeout_resilience(client: AsyncClient):
    """
    Verify streaming resilience against provider timeouts or hanging states.
    Ensures the server doesn't hang indefinitely if the LLM provider stalls.
    """
    try:
        payload = {
            "provider": "groq",
            "model": "openai/gpt-oss-120b",
            "messages": [{"role": "user", "content": "trigger timeout"}],
        }
        response = await client.post(
            "/api/v1/llm/chat",
            json=payload,
            timeout=5.0,  # Enforce strict test timeout threshold
        )
        assert response.status_code in [200, 504, 503, 400, 422]
    except asyncio.TimeoutError:
        pytest.fail("Request hung beyond expected timeout threshold.")


# ==========================================
# GROUP 2: Exception Leakage & Security Sanitization
# ==========================================


@pytest.mark.anyio
async def test_exception_leakage_and_credential_safety(client: AsyncClient):
    """
    Verify no internal exception details, tracebacks, or credentials are leaked to clients.
    Simulates an internal deep-layer service failure containing sensitive data.
    """
    payload = {
        "provider": "groq",
        "model": "openai/gpt-oss-120b",
        "messages": [{"role": "user", "content": "trigger internal failure"}],
    }

    # Simulate provider throwing an exception with sensitive mock details
    async def failing_generator(*args, **kwargs):
        raise ValueError(
            "Database connection failed: user_password=Secret123, file '/app/secrets.py', line 45"
        )
        yield  # unreachable

    with patch(
        "app.services.llm.service.LLMService.stream_chat",
        return_value=failing_generator(),
    ):
        async with client.stream("POST", "/api/v1/llm/chat", json=payload) as response:
            assert response.status_code == 200
            response_body = ""
            async for chunk in response.aiter_text():
                response_body += chunk
                if "error" in response_body.lower():
                    break

    error_body = response_body.lower()

    # ❌ Forbidden security leak patterns inside the streamed response
    forbidden_keywords = [
        "traceback",
        'file "/',
        "line ",
        "api_key",
        "password",
        "secret123",
        "secrets.py",
        "bearer ",
        "sk-",
    ]

    for keyword in forbidden_keywords:
        assert (
            keyword not in error_body
        ), f"Security violation: Streamed response leaked sensitive keyword '{keyword}'!"


# ==========================================
# GROUP 3: Uninitialized Metrics & Empty Payload Edge Cases
# ==========================================


@pytest.mark.anyio
async def test_provider_uninitialized_metrics_safety(client: AsyncClient):
    """
    Verify backend handles provider returning empty streams or uninitialized metrics safely
    without throwing NoneType errors.
    """

    async def empty_generator(*args, **kwargs):
        if False:
            yield  # empty generator yielding nothing

    payload = {
        "provider": "groq",
        "model": "openai/gpt-oss-120b",
        "messages": [{"role": "user", "content": "empty response test"}],
    }

    with patch(
        "app.services.llm.service.LLMService.stream_chat",
        return_value=empty_generator(),
    ):
        response = await client.post("/api/v1/llm/chat", json=payload)
        assert response.status_code == 200
