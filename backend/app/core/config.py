from pydantic_settings import BaseSettings
from pydantic import model_validator
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    app_name: str = "SponsorIntel"
    env: str = "development"
    debug: bool = True
    database_url: str = "postgresql+asyncpg://sponsor_user:sponsor_pass@db:5432/sponsorintel"
    database_url_sync: str = "postgresql+psycopg2://sponsor_user:sponsor_pass@db:5432/sponsorintel"
    redis_url: str = "redis://redis:6379/0"
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    proxy_residential_url: str = ""
    proxy_datacenter_url: str = ""
    reed_api_key: str = ""
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""
    jooble_api_key: str = ""
    companies_house_api_key: str = ""
    cors_origins: str = "http://localhost:3333,http://127.0.0.1:3333"

    # Agent Swarm / LLM
    llm_backend: str = "ollama"  # ollama | anthropic | disabled
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "phi3:mini"
    anthropic_api_key: str | None = None

    # Supabase (for direct access from Railway)
    supabase_url: str | None = None
    supabase_service_key: str | None = None
    supabase_anon_key: str | None = None

    # Groq (for intel classification + digest)
    groq_api_key: str = ""

    # NVIDIA NIM (for intel impact analysis)
    nvidia_nim_api_key: str = ""
    nvidia_nim_base_url: str = "https://integrate.api.nvidia.com/v1"

    # OpenRouter (for T4 fallback)
    openrouter_api_key: str = ""

    # Army Tier Router model overrides
    army_t1_model: str = "llama-3.1-8b-instant"
    army_t2_model: str = "llama-3.3-70b-versatile"
    army_t3_model: str = "meta/llama-3.1-405b-instruct"
    army_t4_model: str = "claude-haiku-4-5-20251001"

    # Reddit API (for intel social scanner)
    reddit_client_id: str = ""
    reddit_client_secret: str = ""

    # Resend (for email notifications)
    resend_api_key: str = ""

    # Notifications
    discord_webhook_url: str | None = None

    @model_validator(mode="after")
    def validate_secret_key(self) -> "Settings":
        if self.env == "development":
            if not self.secret_key:
                self.secret_key = "dev-secret-key-not-for-production"
        else:
            if not self.secret_key:
                raise ValueError(
                    "secret_key must be set via environment variable in production"
                )
        return self

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
