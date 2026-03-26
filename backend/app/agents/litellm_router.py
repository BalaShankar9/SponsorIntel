"""LiteLLM-powered routing backend for TierRouter.

Uses the litellm Python library for unified model access with
automatic fallbacks, cost tracking, and 100+ provider support.
Falls back to direct API calls if litellm is not installed.
"""

import json
import logging
import time

logger = logging.getLogger(__name__)

# Tier → LiteLLM model mapping
TIER_MODELS = {
    1: "groq/llama-3.1-8b-instant",
    2: "groq/llama-3.3-70b-versatile",
    3: "nvidia_nim/meta/llama-3.1-405b-instruct",
    4: "anthropic/claude-haiku-4-5-20251001",
}

TIER_FALLBACKS = {
    4: ["anthropic/claude-haiku-4-5-20251001", "openrouter/anthropic/claude-3.5-sonnet"],
    3: ["nvidia_nim/meta/llama-3.1-405b-instruct", "groq/llama-3.3-70b-versatile"],
    2: ["groq/llama-3.3-70b-versatile", "nvidia_nim/meta/llama-3.1-405b-instruct"],
    1: ["groq/llama-3.1-8b-instant", "groq/llama-3.3-70b-versatile"],
}


def _get_litellm():
    """Import litellm lazily."""
    try:
        import litellm
        return litellm
    except ImportError:
        return None


async def litellm_completion(
    tier: int,
    prompt: str,
    system: str = "",
    temperature: float = 0.3,
    max_tokens: int = 1024,
    metadata: dict | None = None,
) -> dict | None:
    """Call LLM via litellm with fallback chain.

    Returns dict with: content, model, tokens_in, tokens_out, cost_usd
    Returns None if litellm not installed or all providers fail.
    """
    litellm = _get_litellm()
    if not litellm:
        return None

    models = TIER_FALLBACKS.get(tier, [TIER_MODELS.get(tier, "groq/llama-3.3-70b-versatile")])
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    start = time.time()
    last_error = None

    for model in models:
        try:
            response = await litellm.acompletion(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                metadata=metadata or {},
            )

            usage = response.usage
            cost = litellm.completion_cost(completion_response=response)

            return {
                "content": response.choices[0].message.content,
                "model": model,
                "tokens_in": usage.prompt_tokens if usage else 0,
                "tokens_out": usage.completion_tokens if usage else 0,
                "cost_usd": cost or 0.0,
                "latency_ms": int((time.time() - start) * 1000),
            }
        except Exception as e:
            last_error = e
            logger.warning(f"LiteLLM {model} failed: {e}")
            continue

    logger.error(f"All LiteLLM models failed for tier {tier}: {last_error}")
    return None
