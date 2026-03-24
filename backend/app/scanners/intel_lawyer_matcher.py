"""
Lawyer matching algorithm.

Scores candidates on: specialisation (40%), reviews (25%),
proximity (15%), accreditation (10%), transparency (10%).
"""

import logging
import uuid

logger = logging.getLogger(__name__)

ACCREDITATION_SCORES = {
    "Law Society Immigration Accreditation": 10,
    "LEXCEL": 8,
    "SQM": 7,
    "OISC Level 3": 10,
    "OISC Level 2": 6,
}


def compute_match_score(
    lawyer: dict,
    visa_route: str,
    location: str | None = None,
    case_complexity: str = "straightforward",
) -> float:
    """Compute 0-100 match score for a lawyer given user criteria."""
    score = 0.0

    # 1. Specialisation match (40%)
    practice_areas = lawyer.get("practice_areas") or []
    practice_lower = [p.lower() for p in practice_areas]
    route_lower = visa_route.lower()

    if any(route_lower in p for p in practice_lower):
        score += 40
    elif "immigration" in practice_lower or "general" in practice_lower:
        score += 20
    elif any("visa" in p or "work permit" in p for p in practice_lower):
        score += 15

    # Bonus for complexity match
    if case_complexity == "appeal" and any("appeal" in p for p in practice_lower):
        score += 5
    elif case_complexity == "complex":
        oisc_level = lawyer.get("oisc_level")
        if oisc_level and oisc_level >= 2:
            score += 3

    # 2. Review quality (25%)
    combined_rating = lawyer.get("combined_rating")
    google_count = lawyer.get("google_review_count") or 0
    trustpilot_count = lawyer.get("trustpilot_review_count") or 0
    total_reviews = google_count + trustpilot_count

    if combined_rating and combined_rating > 0:
        # Scale: 5.0 = 25pts, 4.0 = 20pts, 3.0 = 15pts
        rating_score = min((combined_rating / 5.0) * 25, 25)
        # Penalise if fewer than 10 reviews
        if total_reviews < 10:
            rating_score *= (total_reviews / 10)
        score += rating_score

    # 3. Proximity (15%) — skip if no location or remote
    if location and location.lower() != "remote":
        # Simplified: if same city, full points
        lawyer_city = (lawyer.get("city") or "").lower()
        if lawyer_city and location.lower() in lawyer_city:
            score += 15
        elif lawyer.get("offers_remote"):
            score += 10
        else:
            score += 5
    elif lawyer.get("offers_remote"):
        score += 15

    # 4. Accreditation (10%)
    accreditations = lawyer.get("accreditations") or []
    accred_score = 0
    for accred in accreditations:
        accred_score = max(accred_score, ACCREDITATION_SCORES.get(accred, 0))
    score += min(accred_score, 10)

    # 5. Transparency (10%)
    transparency = 0
    if lawyer.get("website"):
        transparency += 3
    if lawyer.get("fee_initial_consultation"):
        transparency += 3
    if lawyer.get("fee_hourly_range"):
        transparency += 2
    if lawyer.get("email") or lawyer.get("phone"):
        transparency += 2
    score += min(transparency, 10)

    return min(score, 100)


async def search_lawyers(
    supabase_client,
    llm_service,
    visa_route: str,
    nationality: str | None = None,
    location: str | None = None,
    case_complexity: str = "straightforward",
    budget_range: str | None = None,
    language_pref: str | None = None,
    page: int = 1,
    per_page: int = 10,
) -> dict:
    """Search and rank lawyers by match score."""
    # Base query: active, practicing, covers immigration
    query = supabase_client.table("intel_lawyers").select("*").eq(
        "is_active", True
    ).eq("practising_status", "active")

    if location and location.lower() != "remote":
        query = query.eq("city", location)

    if language_pref:
        query = query.contains("languages", [language_pref])

    result = query.limit(100).execute()
    lawyers = result.data or []

    # Score and sort
    scored = []
    for lawyer in lawyers:
        match_score = compute_match_score(lawyer, visa_route, location, case_complexity)
        lawyer["match_score"] = round(match_score, 1)
        scored.append(lawyer)

    scored.sort(key=lambda x: x["match_score"], reverse=True)

    # Paginate
    start = (page - 1) * per_page
    page_results = scored[start:start + per_page]

    # Generate AI blurbs for top results
    for lawyer in page_results:
        try:
            prompt = f"""Write a 2-sentence explanation of why this lawyer is a good match.

Lawyer: {lawyer['name']} at {lawyer.get('firm_name', 'Independent')}
Registration: {lawyer['registration_type'].upper()} {lawyer.get('registration_number', '')}
Practice areas: {', '.join(lawyer.get('practice_areas', []))}
Rating: {lawyer.get('combined_rating', 'N/A')}/5 ({(lawyer.get('google_review_count', 0) + lawyer.get('trustpilot_review_count', 0))} reviews)
City: {lawyer.get('city', 'Unknown')}

User needs: {visa_route} visa, complexity: {case_complexity}

Write 2 concise sentences. No disclaimers."""

            blurb = await llm_service.complete_with_provider(
                provider="groq", prompt=prompt,
                system="You write brief, factual lawyer match explanations. 2 sentences max.",
                timeout=10,
            )
            lawyer["why_matched"] = blurb or f"Specialises in {visa_route} applications with strong client reviews."
        except Exception:
            lawyer["why_matched"] = f"Specialises in {visa_route} applications with strong client reviews."

    # Log search
    search_id = str(uuid.uuid4())
    try:
        supabase_client.table("intel_lawyer_searches").insert({
            "id": search_id,
            "visa_route": visa_route,
            "nationality": nationality,
            "location": location,
            "case_complexity": case_complexity,
            "budget_range": budget_range,
            "language_pref": language_pref,
            "results_returned": len(page_results),
        }).execute()
    except Exception:
        pass

    return {
        "results": page_results,
        "total": len(scored),
        "page": page,
        "per_page": per_page,
        "search_id": search_id,
    }
