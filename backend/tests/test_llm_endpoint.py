"""Tests for the LLM providers FastAPI endpoint.

The endpoint ``GET /api/v1/llm/providers`` should return the static list of
providers defined in :class:`app.services.llm_service.LLMService`.  The test
uses FastAPI's ``TestClient`` to make an in‑process request against the
application instance defined in ``app.main``.
"""

from fastapi.testclient import TestClient

from app.main import app
from app.services.llm_service import LLMService


def test_list_providers_returns_catalog() -> None:
    """Ensure the endpoint returns the exact provider catalog.

    The service method ``LLMService.get_llm_providers`` returns a list of
    ``ProviderInfo`` Pydantic models.  ``model_dump`` (Pydantic v2) converts each
    model to a plain ``dict`` that matches the JSON response format.  The test
    asserts that the HTTP response body is identical to this expected list.
    """

    client = TestClient(app)
    response = client.get("/api/v1/llm/providers")

    assert response.status_code == 200

    # Expected payload – convert the Pydantic models to plain dicts
    expected = [provider.model_dump() for provider in LLMService.get_llm_providers()]
    assert response.json() == expected
