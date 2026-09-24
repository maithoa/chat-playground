import sys
from pathlib import Path
import pytest
from pydantic import ValidationError

# Ensure the project root is on PYTHONPATH for imports
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.config import Settings


def test_default_settings():
    """Validate that the Settings model loads expected default values."""
    config = Settings()
    assert config.PROJECT_NAME == "Chat Playground"
    assert config.APP_NAME == "Chat Playground application"
    assert config.VERSION == "0.1.0"
    assert config.API_V1_STR == "/api/v1"
    assert config.PORT == 8686
    # Port is defined as an int; ensure it's the default
    assert isinstance(config.PORT, int)

def test_env_override(monkeypatch):
    """Ensure environment variables correctly override default values."""
    # Mock the environment variables
    monkeypatch.setenv("PORT", "9898")
    monkeypatch.setenv("APP_NAME", "Test APP")

    config = Settings()
    assert config.PORT == 9898
    assert config.APP_NAME == "Test APP"

def test_invalid_port_type(monkeypatch):
    """Ensure validation error is raised when port is not integer"""
    monkeypatch.setenv("PORT","somestring")

    with pytest.raises(ValidationError):
        Settings()
