"""Zara Mahmood — Keyword Optimisation Specialist (Improvement & R&D department).

Analyses which search keywords actually find sponsorship jobs vs noise,
and recommends additions/removals to the keyword list.
"""

import logging
from collections import Counter
from app.agents.base import BaseSubAgent

logger = logging.getLogger(__name__)


class KeywordOptimizer(BaseSubAgent):
    name = "keyword_optimizer"
    persona = "Zara Mahmood"
    title = "Keyword Optimisation Specialist"
    agent_type = "DET"
    description = "Analyses keyword effectiveness and recommends changes to improve job discovery hit rates."

    async def run(self, supabase=None, **kwargs):
        """Analyse recent scrape results to evaluate keyword effectiveness.

        Looks at:
        - Which keywords produced the most jobs with sponsorship_likelihood > 50
        - Which keywords produced mostly noise (likelihood < 20)
        - New keywords appearing in high-scoring job descriptions
        """
        if not supabase:
            return {"status": "no_supabase", "recommendations": []}

        recommendations = []

        # Get recent jobs with their sponsorship scores
        result = supabase.table("jobs").select(
            "title_raw, sponsorship_likelihood, sponsorship_signals, source"
        ).gte("sponsorship_likelihood", 50).order(
            "first_seen_at", desc=True
        ).limit(1000).execute()

        high_quality_jobs = result.data or []

        # Count title keywords in high-scoring jobs
        keyword_freq = Counter()
        for job in high_quality_jobs:
            title = (job.get("title_raw") or "").lower()
            for word in title.split():
                if len(word) > 3:
                    keyword_freq[word] += 1

        # Find emerging keywords not in our current list
        from app.tasks.scraping import DEFAULT_KEYWORDS
        current_keywords_lower = {k.lower() for k in DEFAULT_KEYWORDS}

        emerging = []
        for word, count in keyword_freq.most_common(50):
            if word not in current_keywords_lower and count >= 5:
                emerging.append({"keyword": word, "frequency": count})

        if emerging:
            recommendations.append({
                "type": "add_keywords",
                "reason": "Frequently appearing in high-scoring jobs but not in search list",
                "keywords": emerging[:10],
            })

        # Check for underperforming keywords (lots of results but low scores)
        low_result = supabase.table("jobs").select(
            "title_raw, sponsorship_likelihood"
        ).lt("sponsorship_likelihood", 20).order(
            "first_seen_at", desc=True
        ).limit(500).execute()

        low_quality = low_result.data or []
        noise_freq = Counter()
        for job in low_quality:
            title = (job.get("title_raw") or "").lower()
            for kw in DEFAULT_KEYWORDS:
                if kw.lower() in title:
                    noise_freq[kw] += 1

        noisy = [{"keyword": kw, "noise_count": c} for kw, c in noise_freq.most_common(5) if c > 20]
        if noisy:
            recommendations.append({
                "type": "review_keywords",
                "reason": "These keywords produce many low-scoring results",
                "keywords": noisy,
            })

        # Log to improvement_log table
        try:
            supabase.table("improvement_log").insert({
                "agent": self.name,
                "persona": self.persona,
                "analysis_type": "keyword_optimization",
                "recommendations": recommendations,
                "high_quality_sample_size": len(high_quality_jobs),
                "low_quality_sample_size": len(low_quality),
            }).execute()
        except Exception as e:
            logger.debug(f"[{self.persona}] Could not log to improvement_log: {e}")

        logger.info(
            f"[{self.persona}] Keyword analysis: {len(recommendations)} recommendations, "
            f"{len(emerging)} emerging keywords found"
        )
        return {
            "recommendations": recommendations,
            "emerging_keywords": emerging[:10],
            "sample_sizes": {
                "high_quality": len(high_quality_jobs),
                "low_quality": len(low_quality),
            },
        }
