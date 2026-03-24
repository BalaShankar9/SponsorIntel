"""Unified LLM service supporting Ollama, Anthropic, and disabled modes."""

import json
import hashlib
import logging
import httpx
from typing import Any

logger = logging.getLogger(__name__)


class LLMService:
    """Interface to Ollama with caching, batching, and fallback."""

    def __init__(
        self,
        backend: str = "ollama",
        ollama_url: str = "http://localhost:11434",
        ollama_model: str = "phi3:mini",
        anthropic_key: str | None = None,
        groq_api_key: str | None = None,
        nvidia_nim_api_key: str | None = None,
        nvidia_nim_base_url: str = "https://integrate.api.nvidia.com/v1",
        redis=None,
    ):
        self.backend = backend
        self.ollama_url = ollama_url
        self.ollama_model = ollama_model
        self.anthropic_key = anthropic_key
        self.groq_api_key = groq_api_key
        self.nvidia_nim_api_key = nvidia_nim_api_key
        self.nvidia_nim_base_url = nvidia_nim_base_url
        self.redis = redis
        self._healthy = True
        self._consecutive_failures = 0

    async def health_check(self) -> bool:
        """Check if LLM backend is available."""
        if self.backend == "disabled":
            return False
        if self.backend == "ollama":
            try:
                async with httpx.AsyncClient(timeout=5) as client:
                    r = await client.get(f"{self.ollama_url}/api/tags")
                    self._healthy = r.status_code == 200
                    if self._healthy:
                        self._consecutive_failures = 0
                    return self._healthy
            except Exception:
                self._consecutive_failures += 1
                if self._consecutive_failures >= 3 and self.anthropic_key:
                    logger.warning("Ollama unhealthy 3x, switching to Anthropic")
                    self.backend = "anthropic"
                self._healthy = False
                return False
        if self.backend == "anthropic":
            return bool(self.anthropic_key)
        if self.backend == "groq":
            return bool(self.groq_api_key)
        if self.backend == "nvidia_nim":
            return bool(self.nvidia_nim_api_key)
        return False

    async def complete(
        self,
        prompt: str,
        system: str = "",
        cache_key: str | None = None,
        timeout: int = 30,
    ) -> str | None:
        """Single completion with caching and retry."""
        if self.backend == "disabled":
            return None

        # Check cache
        if cache_key and self.redis:
            cached = await self.redis.get(f"llm:{cache_key}")
            if cached:
                return cached.decode() if isinstance(cached, bytes) else cached

        result = None
        try:
            if self.backend == "ollama":
                result = await self._ollama_complete(prompt, system, timeout)
            elif self.backend == "anthropic":
                result = await self._anthropic_complete(prompt, system, timeout)
        except Exception as e:
            logger.error(f"LLM completion failed: {e}")
            self._consecutive_failures += 1
            return None

        # Cache result
        if result and cache_key and self.redis:
            await self.redis.set(f"llm:{cache_key}", result, ex=86400 * 30)

        return result

    async def batch_complete(
        self,
        prompts: list[str],
        system: str = "",
        max_concurrent: int = 2,
    ) -> list[str | None]:
        """Process multiple prompts with concurrency limit."""
        import asyncio
        semaphore = asyncio.Semaphore(max_concurrent)

        async def _one(p):
            async with semaphore:
                return await self.complete(p, system)

        return await asyncio.gather(*[_one(p) for p in prompts])

    async def structured_output(
        self,
        prompt: str,
        system: str = "Respond with valid JSON only. No markdown.",
    ) -> dict | list | None:
        """Parse LLM output as JSON with retry on failure."""
        for attempt in range(2):
            raw = await self.complete(prompt, system)
            if not raw:
                return None
            try:
                cleaned = raw.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
                return json.loads(cleaned)
            except json.JSONDecodeError:
                if attempt == 0:
                    continue
                logger.warning(f"Failed to parse JSON from LLM: {raw[:200]}")
                return None

    async def _ollama_complete(self, prompt: str, system: str, timeout: int) -> str:
        async with httpx.AsyncClient(timeout=timeout) as client:
            body = {
                "model": self.ollama_model,
                "prompt": prompt,
                "system": system,
                "stream": False,
            }
            r = await client.post(f"{self.ollama_url}/api/generate", json=body)
            r.raise_for_status()
            return r.json()["response"]

    async def _anthropic_complete(self, prompt: str, system: str, timeout: int) -> str:
        async with httpx.AsyncClient(timeout=timeout) as client:
            body = {
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 1024,
                "system": system or "You are a helpful assistant.",
                "messages": [{"role": "user", "content": prompt}],
            }
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                json=body,
                headers={
                    "x-api-key": self.anthropic_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
            )
            r.raise_for_status()
            return r.json()["content"][0]["text"]

    async def _groq_complete(self, prompt: str, system: str, timeout: int) -> str:
        """Complete via Groq API (OpenAI-compatible endpoint)."""
        async with httpx.AsyncClient(timeout=timeout) as client:
            body = {
                "model": "llama-3.1-70b-versatile",
                "messages": [
                    {"role": "system", "content": system or "You are a helpful assistant."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.1,
                "max_tokens": 1024,
            }
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json=body,
                headers={
                    "Authorization": f"Bearer {self.groq_api_key}",
                    "Content-Type": "application/json",
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    async def _nvidia_nim_complete(self, prompt: str, system: str, timeout: int) -> str:
        """Complete via NVIDIA NIM API (OpenAI-compatible endpoint)."""
        async with httpx.AsyncClient(timeout=timeout) as client:
            body = {
                "model": "meta/llama-3.1-405b-instruct",
                "messages": [
                    {"role": "system", "content": system or "You are a helpful assistant."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 1500,
            }
            r = await client.post(
                f"{self.nvidia_nim_base_url}/chat/completions",
                json=body,
                headers={
                    "Authorization": f"Bearer {self.nvidia_nim_api_key}",
                    "Content-Type": "application/json",
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    async def complete_with_provider(
        self,
        provider: str,
        prompt: str,
        system: str = "",
        cache_key: str | None = None,
        timeout: int = 30,
    ) -> str | None:
        """Complete using a specific provider (groq, nvidia_nim, ollama, anthropic)."""
        # Check cache
        if cache_key and self.redis:
            cached = await self.redis.get(f"llm:{cache_key}")
            if cached:
                return cached.decode() if isinstance(cached, bytes) else cached

        result = None
        try:
            if provider == "groq":
                result = await self._groq_complete(prompt, system, timeout)
            elif provider == "nvidia_nim":
                result = await self._nvidia_nim_complete(prompt, system, timeout)
            elif provider == "ollama":
                result = await self._ollama_complete(prompt, system, timeout)
            elif provider == "anthropic":
                result = await self._anthropic_complete(prompt, system, timeout)
            else:
                logger.error(f"Unknown LLM provider: {provider}")
                return None
        except Exception as e:
            logger.error(f"LLM completion failed ({provider}): {e}")
            return None

        # Cache result
        if result and cache_key and self.redis:
            await self.redis.set(f"llm:{cache_key}", result, ex=86400 * 30)

        return result

    async def structured_output_with_provider(
        self,
        provider: str,
        prompt: str,
        system: str = "Respond with valid JSON only. No markdown.",
    ) -> dict | list | None:
        """Parse LLM output as JSON using a specific provider, with retry."""
        for attempt in range(2):
            raw = await self.complete_with_provider(provider, prompt, system)
            if not raw:
                return None
            try:
                cleaned = raw.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
                return json.loads(cleaned)
            except json.JSONDecodeError:
                if attempt == 0:
                    continue
                logger.warning(f"Failed to parse JSON from {provider}: {raw[:200]}")
                return None

    @staticmethod
    def cache_key_for(prefix: str, text: str) -> str:
        """Generate a stable cache key."""
        h = hashlib.md5(text.encode()).hexdigest()[:12]
        return f"{prefix}:{h}"
