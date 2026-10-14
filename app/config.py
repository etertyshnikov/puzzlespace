# -*- coding: utf-8 -*-
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


_PROJECT_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    """Конфигурация из переменных окружения (или .env)."""
    db_uri: str = "postgresql://smetadoma04:Lenina21@localhost:5432/smetadoma04_db"
    db_pool_size: int = 10
    app_production: bool = False
    jwt_secret_key: str = "smetadoma03-dev-jwt-secret-change-in-production"
    jwt_expire_minutes: int = 480
    max_bot_token: str = ""
    max_bot_username: str = "id614902200022_1_bot"
    max_channel_id: str = ""
    public_base_url: str = "https://puzzlespace.ru"
    telegram_bot_token: str = ""
    portal_ingest_secret: str = ""

    class Config:
        # Важно: systemd/uvicorn могут запускаться с другим cwd.
        # Читаем .env всегда из корня проекта.
        env_file = str(_PROJECT_ROOT / ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
