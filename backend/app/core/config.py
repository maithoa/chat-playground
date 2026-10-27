# Pydantic Settings for the application configuration, including default values and environment variable overrides.

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    PROJECT_NAME: str = "Chat Playground"
    APP_NAME: str = "Chat Playground application"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    PORT: int = 8686
    DATABASE_URL: str = "sqlite+aiosqlite:///./chat_playground.db"

    # Clould LLM Provider API keys
    OPENAI_API_KEY: str | None = None
    GROQ_API_KEY: str | None = None
    OPENROUTER_API_KEY: str | None = None
    GOOGLE_API_KEY: str | None = None

    # Logging configuration
    LOG_LEVEL: str | None = None
    LOG_FILE_PATH: str | None = None

    #  Use Pydantic V2 model config
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    # User's rate limit (10 request per min) and usage (5000 tokens per day)
    USER_MAX_REQS_PER_MIN: int = 10
    USER_MAX_DAILY_TOKENS: int = 5000


# LRU Cache so that Pydantic only read .env once and cache the settings for future use.
@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
