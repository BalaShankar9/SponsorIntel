"""Native ArmyAgent operators for Intel Immigration Intelligence.

These are not legacy adapters — they're built directly on ArmyAgent and call
the existing scanner/classifier async functions from app.scanners.intel_*.
"""

import logging
from app.agents.army_agent import ArmyAgent
from app.agents.army_types import AgentReport, Role

logger = logging.getLogger(__name__)


class IntelScannerAgent(ArmyAgent):
    """Runs all Intel scanners: GOV.UK, news, legal, social, lawyers."""

    async def run(self, input: dict) -> AgentReport:
        sources = input.get("sources", ["gov", "news", "legal", "social"])
        supabase = input.get("supabase") or self.supabase
        if not supabase:
            return AgentReport(
                agent_id=self.agent_id, mission_type="intel_scan",
                status="failed", data={}, errors=["No supabase client"],
            )

        results = {}
        errors = []
        total_new = 0

        for source in sources:
            try:
                stats = await self._scan_source(source, supabase, input)
                results[source] = stats
                total_new += stats.get("items_new", 0)
            except Exception as e:
                logger.error(f"[{self.agent_id}] Scanner {source} failed: {e}")
                errors.append(f"{source}: {e}")
                results[source] = {"error": str(e)}

        return AgentReport(
            agent_id=self.agent_id,
            mission_type="intel_scan",
            status="success" if not errors else ("partial" if total_new > 0 else "failed"),
            data=results,
            items_processed=len(sources),
            items_created=total_new,
            errors=errors,
        )

    async def _scan_source(self, source: str, supabase, input: dict) -> dict:
        if source == "gov":
            from app.scanners.intel_gov import scan_gov_feeds
            import redis.asyncio as aioredis
            from app.core.config import get_settings
            s = get_settings()
            r = aioredis.from_url(s.redis_url, decode_responses=False)
            try:
                return await scan_gov_feeds(supabase, r)
            finally:
                await r.aclose()
        elif source == "news":
            from app.scanners.intel_news import scan_news_feeds
            return await scan_news_feeds(supabase)
        elif source == "legal":
            from app.scanners.intel_legal import scan_legal_sources
            return await scan_legal_sources(supabase)
        elif source == "social":
            from app.scanners.intel_social import scan_social_sources
            from app.core.config import get_settings
            s = get_settings()
            return await scan_social_sources(supabase, s.reddit_client_id, s.reddit_client_secret)
        elif source == "lawyers":
            from app.scanners.intel_lawyers import scan_lawyer_registers
            return await scan_lawyer_registers(supabase)
        else:
            raise ValueError(f"Unknown source: {source}")


class IntelProcessorAgent(ArmyAgent):
    """Runs Intel processing pipeline: classify → analyze → dedup."""

    async def run(self, input: dict) -> AgentReport:
        steps = input.get("steps", ["classify", "analyze", "dedup"])
        supabase = input.get("supabase") or self.supabase
        if not supabase:
            return AgentReport(
                agent_id=self.agent_id, mission_type="intel_process",
                status="failed", data={}, errors=["No supabase client"],
            )

        results = {}
        errors = []
        total_processed = 0

        for step in steps:
            try:
                stats = await self._run_step(step, supabase)
                results[step] = stats
                total_processed += stats.get("items_processed", 0) if isinstance(stats, dict) else 0
            except Exception as e:
                logger.error(f"[{self.agent_id}] Processor {step} failed: {e}")
                errors.append(f"{step}: {e}")

        return AgentReport(
            agent_id=self.agent_id,
            mission_type="intel_process",
            status="success" if not errors else "partial",
            data=results,
            items_processed=total_processed,
            errors=errors,
        )

    async def _run_step(self, step: str, supabase) -> dict:
        from app.agents.llm_service import LLMService
        from app.core.config import get_settings
        s = get_settings()

        if step == "classify":
            llm = LLMService(backend="groq", groq_api_key=s.groq_api_key,
                             nvidia_nim_api_key=s.nvidia_nim_api_key,
                             nvidia_nim_base_url=s.nvidia_nim_base_url)
            from app.scanners.intel_classifier import classify_raw_items
            return await classify_raw_items(supabase, llm)
        elif step == "analyze":
            llm = LLMService(backend="groq", groq_api_key=s.groq_api_key,
                             nvidia_nim_api_key=s.nvidia_nim_api_key,
                             nvidia_nim_base_url=s.nvidia_nim_base_url)
            from app.scanners.intel_classifier import analyze_classified_items
            return await analyze_classified_items(supabase, llm)
        elif step == "dedup":
            from app.scanners.intel_classifier import run_dedup
            return await run_dedup(supabase)
        else:
            raise ValueError(f"Unknown step: {step}")
