import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "TradeWatch - Vietnam Stock Monitoring System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    # Support both asyncpg URL or standard postgresql url fallback
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://tradewatch:tradewatch_secret@localhost:5432/tradewatch_db"
    )

    # Telegram defaults (can be overridden via DB settings)
    DEFAULT_TELEGRAM_BOT_TOKEN: Optional[str] = os.getenv("TELEGRAM_BOT_TOKEN", "")
    DEFAULT_TELEGRAM_CHAT_ID: Optional[str] = os.getenv("TELEGRAM_CHAT_ID", "")

    # Default Polling Configuration
    DEFAULT_POLLING_INTERVAL_SEC: int = 30
    DEFAULT_ALERT_COOLDOWN_MIN: int = 15

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
