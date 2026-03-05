from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "SponsorIntel"
    env: str = "development"
    debug: bool = True
    database_url: str = "postgresql+asyncpg://sponsor_user:sponsor_pass@db:5432/sponsorintel"
    database_url_sync: str = "postgresql+psycopg2://sponsor_user:sponsor_pass@db:5432/sponsorintel"
    redis_url: str = "redis://redis:6379/0"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    proxy_residential_url: str = ""
    proxy_datacenter_url: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
