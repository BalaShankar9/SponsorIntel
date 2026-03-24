"""TierRouter — 5-tier intelligent LLM routing engine.

Routes agent LLM requests through 5 tiers:
  T0: Zero-cost Python rules/regex ($0)
  T1: Groq 8b micro (~$0.0001)
  T2: Groq 70b standard (~$0.001)
  T3: NVIDIA NIM 405b heavy (~$0.01)
  T4: Anthropic/OpenRouter elite (~$0.05)

Features: fallback chains, connection pooling, Redis caching,
routing history logging for self-learning.
"""

import hashlib
import json
import logging
import re
import time
from datetime import datetime, timezone

import httpx

from app.agents.army_types import TierResult

logger = logging.getLogger(__name__)

FALLBACK_CHAINS = {
    4: ["anthropic", "openrouter", "nvidia_nim"],
    3: ["nvidia_nim", "openrouter", "groq"],
    2: ["groq", "nvidia_nim", "openrouter"],
    1: ["groq", "groq_t2"],
    0: [],
}

DEFAULT_TIER_MAP = {
    "salary_parse": 0, "url_validate": 0, "dedup_hash": 0,
    "date_normalize": 0, "keyword_match": 0,
    "spam_check": 1, "title_cleanup": 1, "language_detect": 1,
    "work_model_detect": 1,
    "job_enrichment": 2, "soc_classify": 2, "company_match": 2,
    "sponsorship_analysis": 2, "tech_stack_extract": 2,
    "deep_analysis": 3, "report_generation": 3, "policy_impact": 3,
    "lawyer_match": 3,
    "legal_document": 4, "executive_briefing": 4,
    "multi_doc_synthesis": 4,
}

TIER_COSTS = {
    0: 0.0,
    1: 0.0001,
    2: 0.001,
    3: 0.01,
    4: 0.05,
}


class T0Engine:
    """Zero-cost rule-based resolution for simple tasks."""

    _SALARY_RE = re.compile(
        r"[£$€]?\s*([\d,]+(?:\.\d+)?)\s*(?:[-–to]+\s*[£$€]?\s*([\d,]+(?:\.\d+)?))?",
        re.IGNORECASE,
    )
    _URL_RE = re.compile(r"^https?://[^\s]+$")

    def try_resolve(self, task_type: str, prompt: str, metadata: dict) -> str | None:
        handler = getattr(self, f"_handle_{task_type}", None)
        if handler:
            return handler(prompt, metadata)
        return None

    def _handle_salary_parse(self, prompt: str, metadata: dict) -> str | None:
        match = self._SALARY_RE.search(prompt)
        if match:
            low = match.group(1).replace(",", "")
            high = match.group(2).replace(",", "") if match.group(2) else low
            return json.dumps({"salary_min": float(low), "salary_max": float(high), "raw": prompt})
        return None

    def _handle_url_validate(self, prompt: str, metadata: dict) -> str | None:
        url = prompt.strip()
        if self._URL_RE.match(url):
            return json.dumps({"url": url, "valid": True})
        return json.dumps({"url": url, "valid": False})

    def _handle_dedup_hash(self, prompt: str, metadata: dict) -> str | None:
        normalized = re.sub(r"\s+", " ", prompt.strip().lower())
        h = hashlib.md5(normalized.encode()).hexdigest()
        return h

    def _handle_date_normalize(self, prompt: str, metadata: dict) -> str | None:
        iso_match = re.search(r"\d{4}-\d{2}-\d{2}", prompt)
        if iso_match:
            return iso_match.group(0)
        return None

    def _handle_keyword_match(self, prompt: str, metadata: dict) -> str | None:
        keywords = metadata.get("keywords", [])
        if not keywords:
            return None
        text_lower = prompt.lower()
        matches = [kw for kw in keywords if kw.lower() in text_lower]
        return json.dumps({"matches": matches, "count": len(matches)})


class TierRouter:
    """5-tier intelligent LLM routing with fallbacks and connection pooling."""

    def __init__(
        self,
        redis,
        supabase=None,
        groq_api_key: str = "",
        nvidia_nim_api_key: str = "",
        anthropic_api_key: str = "",
        openrouter_api_key: str = "",
        t1_model: str = "llama-3.1-8b-instant",
        t2_model: str = "llama-3.3-70b-versatile",
        t3_model: str = "meta/llama-3.1-405b-instruct",
        t4_model: str = "claude-haiku-4-5-20251001",
    ):
        self.redis = redis
        self.supabase = supabase
        self.t0 = T0Engine()

        self._api_keys = {
            "groq": groq_api_key,
            "nvidia_nim": nvidia_nim_api_key,
            "anthropic": anthropic_api_key,
            "openrouter": openrouter_api_key,
        }
        self._models = {
            "t1": t1_model,
            "t2": t2_model,
            "t3": t3_model,
            "t4": t4_model,
        }

        self._clients: dict[str, httpx.AsyncClient] = {}
        self._tier_config_cache: dict[str, dict] = {}

    def _get_client(self, provider: str) -> httpx.AsyncClient:
        lookup = "groq" if provider == "groq_t2" else provider
        if lookup not in self._clients:
            configs = {
                "groq": ("https://api.groq.com", 30, 20, 10),
                "nvidia_nim": ("https://integrate.api.nvidia.com", 60, 10, 5),
                "openrouter": ("https://openrouter.ai", 60, 10, 5),
                "anthropic": ("https://api.anthropic.com", 60, 5, 3),
            }
            base_url, timeout, max_conn, keepalive = configs.get(
                lookup, ("", 30, 10, 5)
            )
            self._clients[lookup] = httpx.AsyncClient(
                base_url=base_url,
                timeout=timeout,
                limits=httpx.Limits(
                    max_connections=max_conn,
                    max_keepalive_connections=keepalive,
                ),
            )
        return self._clients[lookup]

    def _get_default_tier(self, task_type: str) -> int:
        cached = self._tier_config_cache.get(task_type)
        if cached:
            return cached.get("default_tier", 2)
        return DEFAULT_TIER_MAP.get(task_type, 2)

    def _classify_complexity(self, prompt: str, metadata: dict) -> float:
        length = len(prompt)
        if length < 100:
            return 0.1
        elif length < 500:
            return 0.3
        elif length < 2000:
            return 0.5
        elif length < 5000:
            return 0.7
        return 0.9

    async def route(
        self,
        prompt: str,
        system: str = "",
        task_type: str = "general",
        agent_id: str = "",
        tier_hint: int | None = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
        cache_key: str | None = None,
        metadata: dict | None = None,
    ) -> TierResult:
        start = time.time()

        if cache_key:
            cached = await self._check_cache(cache_key)
            if cached:
                return cached

        t0_result = self.t0.try_resolve(task_type, prompt, metadata or {})
        if t0_result is not None:
            result = TierResult(
                content=t0_result,
                tier_used=0,
                provider="t0_rules",
                model="",
                tokens_in=0,
                tokens_out=0,
                cost_usd=0.0,
                latency_ms=int((time.time() - start) * 1000),
                from_cache=False,
            )
            await self._log_routing(task_type, result)
            return result

        tier = tier_hint if tier_hint is not None else self._get_default_tier(task_type)
        tier = max(1, min(4, tier))

        chain = FALLBACK_CHAINS.get(tier, ["groq"])
        result = None
        for provider in chain:
            key_lookup = "groq" if provider == "groq_t2" else provider
            if not self._api_keys.get(key_lookup):
                continue
            try:
                result = await self._call_provider(
                    provider, tier, prompt, system, temperature, max_tokens,
                )
                if result:
                    break
            except Exception as e:
                logger.warning(f"TierRouter: {provider} failed for tier {tier}: {e}")
                continue

        if result is None:
            latency = int((time.time() - start) * 1000)
            result = TierResult(
                content="",
                tier_used=tier,
                provider="none",
                model="",
                tokens_in=0,
                tokens_out=0,
                cost_usd=0.0,
                latency_ms=latency,
                from_cache=False,
            )

        result.latency_ms = int((time.time() - start) * 1000)

        if cache_key and result.content:
            await self._set_cache(cache_key, result)

        await self._log_routing(task_type, result)

        return result

    async def _call_provider(
        self,
        provider: str,
        tier: int,
        prompt: str,
        system: str,
        temperature: float,
        max_tokens: int,
    ) -> TierResult | None:
        client = self._get_client(provider)
        model = self._get_model(provider, tier)

        if provider in ("groq", "groq_t2"):
            if provider == "groq_t2":
                model = self._models["t2"]
            return await self._call_groq(client, model, prompt, system, temperature, max_tokens, tier)
        elif provider == "nvidia_nim":
            return await self._call_nvidia(client, model, prompt, system, temperature, max_tokens, tier)
        elif provider == "anthropic":
            return await self._call_anthropic(client, model, prompt, system, temperature, max_tokens, tier)
        elif provider == "openrouter":
            return await self._call_openrouter(client, model, prompt, system, temperature, max_tokens, tier)
        return None

    def _get_model(self, provider: str, tier: int) -> str:
        if tier == 1:
            return self._models["t1"]
        elif tier == 2:
            return self._models["t2"]
        elif tier == 3:
            return self._models["t3"]
        elif tier == 4:
            return self._models["t4"]
        return self._models["t2"]

    async def _call_groq(self, client, model, prompt, system, temperature, max_tokens, tier) -> TierResult:
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system or "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        r = await client.post(
            "/openai/v1/chat/completions",
            json=body,
            headers={
                "Authorization": f"Bearer {self._api_keys['groq']}",
                "Content-Type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()
        usage = data.get("usage", {})
        return TierResult(
            content=data["choices"][0]["message"]["content"],
            tier_used=tier,
            provider="groq",
            model=model,
            tokens_in=usage.get("prompt_tokens", 0),
            tokens_out=usage.get("completion_tokens", 0),
            cost_usd=TIER_COSTS.get(tier, 0.001),
            latency_ms=0,
            from_cache=False,
        )

    async def _call_nvidia(self, client, model, prompt, system, temperature, max_tokens, tier) -> TierResult:
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system or "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        r = await client.post(
            "/v1/chat/completions",
            json=body,
            headers={
                "Authorization": f"Bearer {self._api_keys['nvidia_nim']}",
                "Content-Type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()
        usage = data.get("usage", {})
        return TierResult(
            content=data["choices"][0]["message"]["content"],
            tier_used=tier,
            provider="nvidia_nim",
            model=model,
            tokens_in=usage.get("prompt_tokens", 0),
            tokens_out=usage.get("completion_tokens", 0),
            cost_usd=TIER_COSTS.get(tier, 0.01),
            latency_ms=0,
            from_cache=False,
        )

    async def _call_anthropic(self, client, model, prompt, system, temperature, max_tokens, tier) -> TierResult:
        body = {
            "model": model,
            "max_tokens": max_tokens,
            "system": system or "You are a helpful assistant.",
            "messages": [{"role": "user", "content": prompt}],
        }
        r = await client.post(
            "/v1/messages",
            json=body,
            headers={
                "x-api-key": self._api_keys["anthropic"],
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()
        usage = data.get("usage", {})
        return TierResult(
            content=data["content"][0]["text"],
            tier_used=tier,
            provider="anthropic",
            model=model,
            tokens_in=usage.get("input_tokens", 0),
            tokens_out=usage.get("output_tokens", 0),
            cost_usd=TIER_COSTS.get(tier, 0.05),
            latency_ms=0,
            from_cache=False,
        )

    async def _call_openrouter(self, client, model, prompt, system, temperature, max_tokens, tier) -> TierResult:
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system or "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        r = await client.post(
            "/api/v1/chat/completions",
            json=body,
            headers={
                "Authorization": f"Bearer {self._api_keys['openrouter']}",
                "Content-Type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()
        usage = data.get("usage", {})
        return TierResult(
            content=data["choices"][0]["message"]["content"],
            tier_used=tier,
            provider="openrouter",
            model=model,
            tokens_in=usage.get("prompt_tokens", 0),
            tokens_out=usage.get("completion_tokens", 0),
            cost_usd=TIER_COSTS.get(tier, 0.01),
            latency_ms=0,
            from_cache=False,
        )

    async def _check_cache(self, cache_key: str) -> TierResult | None:
        try:
            raw = await self.redis.get(f"army:llm:{cache_key}")
            if raw:
                data = json.loads(raw if isinstance(raw, str) else raw.decode())
                return TierResult(**data)
        except Exception:
            pass
        return None

    async def _set_cache(self, cache_key: str, result: TierResult, ttl: int = 86400):
        try:
            data = {
                "content": result.content,
                "tier_used": result.tier_used,
                "provider": "cache",
                "model": result.model,
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": 0.0,
                "latency_ms": 1,
                "from_cache": True,
            }
            await self.redis.set(f"army:llm:{cache_key}", json.dumps(data), ex=ttl)
        except Exception as e:
            logger.debug(f"TierRouter cache set failed: {e}")

    async def _log_routing(self, task_type: str, result: TierResult):
        if not self.supabase:
            return
        try:
            self.supabase.table("army_routing_history").insert({
                "task_type": task_type,
                "tier_used": result.tier_used,
                "cost_usd": result.cost_usd,
                "latency_ms": result.latency_ms,
            }).execute()
        except Exception as e:
            logger.debug(f"TierRouter log_routing failed: {e}")

    async def load_tier_config(self):
        if not self.supabase:
            return
        try:
            result = self.supabase.table("army_tier_config").select("*").execute()
            for row in (result.data or []):
                self._tier_config_cache[row["task_type"]] = row
            logger.info(f"TierRouter loaded {len(self._tier_config_cache)} tier configs")
        except Exception as e:
            logger.warning(f"TierRouter load_tier_config failed: {e}")

    async def close(self):
        for client in self._clients.values():
            await client.aclose()
        self._clients.clear()
