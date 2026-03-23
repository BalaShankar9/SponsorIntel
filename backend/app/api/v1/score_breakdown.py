"""
Score explanation endpoint — returns the 7-factor weighted breakdown.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import optional_auth
from app.core.database import get_db
from app.models.scoring import SponsorScore
from app.models.user import User

router = APIRouter(prefix="/sponsors", tags=["sponsors"])

# Weights per the spec scoring engine
WEIGHTS = {
    "compliance": 0.20,
    "financial_health": 0.15,
    "hiring_activity": 0.15,
    "reputation": 0.15,
    "legitimacy": 0.10,
    "track_record": 0.15,
    "growth_signal": 0.10,
}


@router.get("/{sponsor_id}/score-breakdown")
async def get_score_breakdown(
    sponsor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(optional_auth),
):
    """Detailed score factor breakdown for 'Why this score?' panel."""
    result = await db.execute(
        select(SponsorScore)
        .where(SponsorScore.sponsor_id == sponsor_id)
        .order_by(SponsorScore.computed_at.desc())
        .limit(1)
    )
    score = result.scalar_one_or_none()
    if not score:
        raise HTTPException(status_code=404, detail="No score data for this sponsor")

    risk_flags = []
    if score.risk_flags:
        if isinstance(score.risk_flags, list):
            risk_flags = score.risk_flags
        elif isinstance(score.risk_flags, dict):
            risk_flags = score.risk_flags.get("flags", [])

    factors = [
        {
            "key": "compliance",
            "label": "Compliance",
            "weight": WEIGHTS["compliance"],
            "score": score.compliance_score,
        },
        {
            "key": "financial_health",
            "label": "Financial Health",
            "weight": WEIGHTS["financial_health"],
            "score": score.financial_health_score,
        },
        {
            "key": "hiring_activity",
            "label": "Hiring Activity",
            "weight": WEIGHTS["hiring_activity"],
            "score": score.hiring_activity_score,
        },
        {
            "key": "reputation",
            "label": "Reputation",
            "weight": WEIGHTS["reputation"],
            "score": score.reputation_score,
        },
        {
            "key": "legitimacy",
            "label": "Legitimacy",
            "weight": WEIGHTS["legitimacy"],
            "score": score.legitimacy_score,
        },
        {
            "key": "track_record",
            "label": "Track Record",
            "weight": WEIGHTS["track_record"],
            "score": score.track_record_score,
        },
        {
            "key": "growth_signal",
            "label": "Growth Signal",
            "weight": WEIGHTS["growth_signal"],
            "score": score.growth_signal_score,
        },
    ]

    # Determine the weakest factor for improvement suggestion
    scored_factors = [f for f in factors if f["score"] is not None]
    weakest = min(scored_factors, key=lambda f: f["score"]) if scored_factors else None
    suggestion = None
    if weakest and weakest["score"] is not None and weakest["score"] < 60:
        suggestion = f"Improving {weakest['label']} (currently {weakest['score']}/100) would have the biggest impact on this score."

    return {
        "sponsor_id": str(sponsor_id),
        "overall_score": score.overall_score,
        "computed_at": score.computed_at.isoformat(),
        "factors": factors,
        "risk_flags": risk_flags,
        "suggestion": suggestion,
    }
