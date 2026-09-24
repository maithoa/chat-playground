from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "Chat Playground"
    APP_NAME: str="Chat Playground application"
    VERSION: str = "0.1.0"
    API_V1_STR: str= "/api/v1"
    PORT: int=8686
    
#  Use Pydantic V2 model config
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
