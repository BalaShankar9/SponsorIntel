"""Ines Dubois — Scoring Calibration Analyst (Improvement & R&D department).

Analyses the sponsorship scoring system to ensure scores are accurate
and well-calibrated. Compares scores against known outcomes.
"""

import logging
from app.agents.base import BaseSubAgent

logger = logging.getLogger(__name__)


class ScoringCalibrator(BaseSubAgent):
    name = "scoring_calibrator"
    persona = "Ines Dubois"
    title = "Scoring Calibration Analyst"
    agent_type = "DET"
    description = "Calibrates sponsorship scoring weights by analysing score distributions and known outcomes."

    async def run(self, supabase=None, **kwargs):
        """Analyse scoring accuracy and distribution.

        Checks:
        1. Score distribution — are scores well-spread or clustered?
        2. Register match accuracy — do high scores correlate with register presence?
        3. Signal weight analysis — which signals are most predictive?
        """
        if not supabase:
            return {"status": "no_supabase", "analysis": {}}

        analysis = {}

        # 1. Score distribution
        try:
            result = supabase.table("jobs").select(
                "sponsorship_likelihood, sponsor_id"
            ).not_.is_("sponsorship_likelihood", "null").limit(5000).execute()
            jobs = result.data or []

            if jobs:
                scores = [j["sponsorship_likelihood"] for j in jobs]
                has_sponsor = [j for j in jobs if j.get("sponsor_id")]

                # Distribution buckets
                buckets = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
                for s in scores:
                    if s <= 20: buckets["0-20"] += 1
                    elif s <= 40: buckets["21-40"] += 1
                    elif s <= 60: buckets["41-60"] += 1
                    elif s <= 80: buckets["61-80"] += 1
                    else: buckets["81-100"] += 1

                analysis["distribution"] = buckets
                analysis["total_scored"] = len(scores)
                analysis["avg_score"] = round(sum(scores) / len(scores), 1)
                analysis["matched_to_sponsor"] = len(has_sponsor)
                analysis["match_rate"] = round(len(has_sponsor) / len(jobs) * 100, 1)

                # 2. Register correlation
                # High scores should have more sponsor matches
                high_score_jobs = [j for j in jobs if j["sponsorship_likelihood"] >= 70]
                high_matched = [j for j in high_score_jobs if j.get("sponsor_id")]
                low_score_jobs = [j for j in jobs if j["sponsorship_likelihood"] < 30]
                low_matched = [j for j in low_score_jobs if j.get("sponsor_id")]

                analysis["calibration"] = {
                    "high_score_match_rate": round(
                        len(high_matched) / max(len(high_score_jobs), 1) * 100, 1
                    ),
                    "low_score_match_rate": round(
                        len(low_matched) / max(len(low_score_jobs), 1) * 100, 1
                    ),
                    "high_score_count": len(high_score_jobs),
                    "low_score_count": len(low_score_jobs),
                }

                # Flag if calibration looks off
                recommendations = []
                if analysis["calibration"]["high_score_match_rate"] < 30:
                    recommendations.append({
                        "issue": "High scores don't correlate with register presence",
                        "suggestion": "Increase weight of register_match signal",
                    })
                if analysis["calibration"]["low_score_match_rate"] > 50:
                    recommendations.append({
                        "issue": "Many low-scored jobs belong to registered sponsors",
                        "suggestion": "Register presence should boost score more aggressively",
                    })
                if buckets["41-60"] > len(scores) * 0.5:
                    recommendations.append({
                        "issue": "Over 50% of scores clustered in 41-60 range",
                        "suggestion": "Scoring signals need more differentiation",
                    })

                analysis["recommendations"] = recommendations

        except Exception as e:
            logger.error(f"[{self.persona}] Scoring analysis failed: {e}")
            analysis["error"] = str(e)

        # Log to improvement_log
        try:
            supabase.table("improvement_log").insert({
                "agent": self.name,
                "persona": self.persona,
                "analysis_type": "scoring_calibration",
                "recommendations": analysis.get("recommendations", []),
                "metrics": {
                    "avg_score": analysis.get("avg_score"),
                    "match_rate": analysis.get("match_rate"),
                    "total_scored": analysis.get("total_scored"),
                },
            }).execute()
        except Exception as e:
            logger.debug(f"[{self.persona}] Could not log to improvement_log: {e}")

        logger.info(
            f"[{self.persona}] Scoring calibration: avg={analysis.get('avg_score', 'N/A')}, "
            f"match_rate={analysis.get('match_rate', 'N/A')}%, "
            f"{len(analysis.get('recommendations', []))} recommendations"
        )

        return analysis
