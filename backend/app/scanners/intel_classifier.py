"""
Intel AI pipeline: classifier (Groq) + impact analyzer (NVIDIA NIM) + dedup.
"""

import json
import logging
import random
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

CLASSIFIER_SYSTEM_PROMPT = """You are an immigration policy classifier for the United Kingdom. You receive raw news items, government announcements, legal blog posts, court decisions, and community discussions related to UK immigration.

Your job is to classify each item into structured metadata. You must return valid JSON only, with no additional text.

Output JSON schema:
{
  "topic": "rule_change" | "policy_update" | "court_decision" | "statistics" | "opinion" | "news" | "community",
  "impact_level": "critical" | "high" | "medium" | "low",
  "visa_routes_affected": ["Skilled Worker", "Global Talent", "Graduate", "Innovator Founder", "Family", "Visitor", "Student", "High Potential Individual", "Scale-up", "General"],
  "nationalities_affected": ["string"] or [],
  "industries_affected": ["string"] or [],
  "confidence": 0.0 to 1.0
}

Classification rules:
- "critical": Changes that immediately affect current visa holders or pending applications.
- "high": Confirmed changes with a future effective date, major court rulings, significant policy shifts.
- "medium": Proposed changes under consultation, notable statistics releases, MAC recommendations.
- "low": Opinion pieces, community discussions, minor news coverage.
- "rule_change": Official Statement of Changes to the Immigration Rules.
- "policy_update": Home Office guidance updates, UKVI procedural changes.
- "court_decision": Upper Tribunal or higher court immigration judgments.
- "statistics": ONS migration data, Home Office quarterly stats.
- "opinion": Blog posts, expert commentary, editorials.
- "news": General news coverage of immigration topics.
- "community": Reddit posts, forum discussions, user experiences.
- visa_routes_affected: Only include routes specifically mentioned or clearly affected. Use "General" if it affects the overall system.
- nationalities_affected: Only include if specific nationalities are mentioned. Leave empty for general items.
- industries_affected: Only include if specific industries are mentioned."""

CLASSIFIER_USER_TEMPLATE = """Classify this item:

Title: {title}
Source: {source_name} ({source_category})
Published: {published_at}
Content: {content}

Return JSON only."""

ANALYZER_SYSTEM_PROMPT = """You are an immigration policy analyst specialising in the UK immigration system. You receive classified immigration news items and produce detailed impact analysis.

Your audience includes: visa applicants, employers who sponsor workers, immigration lawyers, HR professionals, and recruiters.

You must return valid JSON only, with no additional text.

Output JSON schema:
{
  "summary": "string (2-3 sentences: what happened, in plain English)",
  "who_affected": "string (specific groups affected)",
  "action_required": "string or null (what should affected people do NOW)",
  "before_after": {
    "before": "string (how things were before)",
    "after": "string (how things are after)"
  } or null,
  "key_dates": [{"date": "YYYY-MM-DD", "description": "string"}],
  "severity_reasoning": "string (1 sentence: why this impact level)"
}

Guidelines:
- Write for a non-expert audience. Avoid legal jargon.
- Be specific about WHO is affected.
- For rule changes: always provide before_after if possible.
- action_required should be concrete or null.
- Never speculate beyond what the source material states."""

ANALYZER_USER_TEMPLATE = """Analyze this classified item:

Title: {title}
Source: {source_name}
Topic: {topic}
Impact Level: {impact_level}
Visa Routes Affected: {visa_routes_affected}
Content:
{content}

Return JSON only."""


async def classify_raw_items(supabase_client, llm_service, batch_size: int = 20) -> dict:
    """Classify raw intel items using Groq LLM."""
    stats = {"processed": 0, "classified": 0, "errors": 0}

    # Fetch raw items
    result = supabase_client.table("intel_items").select("*").eq(
        "status", "raw"
    ).order("created_at", desc=False).limit(batch_size).execute()

    items = result.data or []
    stats["processed"] = len(items)

    for item in items:
        try:
            content = item.get("content_text") or item.get("content_snippet") or ""
            prompt = CLASSIFIER_USER_TEMPLATE.format(
                title=item["title"],
                source_name=item["source_name"],
                source_category=item["source_category"],
                published_at=item.get("published_at") or "Unknown",
                content=content[:2000],
            )

            classification = await llm_service.structured_output_with_provider(
                provider="groq",
                prompt=prompt,
                system=CLASSIFIER_SYSTEM_PROMPT,
            )

            if not classification:
                stats["errors"] += 1
                continue

            update_data = {
                "topic": classification.get("topic", "news"),
                "impact_level": classification.get("impact_level", "low"),
                "visa_routes_affected": classification.get("visa_routes_affected", []),
                "nationalities_affected": classification.get("nationalities_affected", []),
                "industries_affected": classification.get("industries_affected", []),
                "status": "classified",
            }

            supabase_client.table("intel_items").update(update_data).eq(
                "id", item["id"]
            ).execute()
            stats["classified"] += 1

            # Quality sampling: 1% of items
            if random.random() < 0.01:
                supabase_client.table("intel_quality_samples").insert({
                    "intel_item_id": item["id"],
                    "llm_topic": classification.get("topic"),
                    "llm_impact": classification.get("impact_level"),
                    "llm_confidence": classification.get("confidence", 0.0),
                    "reviewed": False,
                }).execute()

        except Exception as e:
            logger.error(f"Classification failed for item {item['id']}: {e}")
            stats["errors"] += 1

    return stats


async def analyze_classified_items(supabase_client, llm_service, batch_size: int = 10) -> dict:
    """Analyze classified items with impact >= medium using NVIDIA NIM."""
    stats = {"processed": 0, "analyzed": 0, "errors": 0}

    result = supabase_client.table("intel_items").select("*").eq(
        "status", "classified"
    ).in_("impact_level", ["critical", "high", "medium"]).order(
        "created_at", desc=False
    ).limit(batch_size).execute()

    items = result.data or []
    stats["processed"] = len(items)

    for item in items:
        try:
            content = item.get("content_text") or item.get("content_snippet") or ""
            prompt = ANALYZER_USER_TEMPLATE.format(
                title=item["title"],
                source_name=item["source_name"],
                topic=item.get("topic", "news"),
                impact_level=item.get("impact_level", "medium"),
                visa_routes_affected=", ".join(item.get("visa_routes_affected") or ["General"]),
                content=content[:4000],
            )

            analysis = await llm_service.structured_output_with_provider(
                provider="nvidia_nim",
                prompt=prompt,
                system=ANALYZER_SYSTEM_PROMPT,
            )

            if not analysis:
                # Fallback to Groq
                analysis = await llm_service.structured_output_with_provider(
                    provider="groq",
                    prompt=prompt,
                    system=ANALYZER_SYSTEM_PROMPT,
                )

            if not analysis:
                stats["errors"] += 1
                continue

            update_data = {
                "summary": analysis.get("summary"),
                "who_affected": analysis.get("who_affected"),
                "action_required": analysis.get("action_required"),
                "before_after": analysis.get("before_after"),
                "status": "analyzed",
            }

            supabase_client.table("intel_items").update(update_data).eq(
                "id", item["id"]
            ).execute()
            stats["analyzed"] += 1

        except Exception as e:
            logger.error(f"Analysis failed for item {item['id']}: {e}")
            stats["errors"] += 1

    return stats


async def run_dedup(supabase_client, window_hours: int = 48, similarity_threshold: float = 0.6) -> dict:
    """Deduplicate intel items using pg_trgm similarity within a time window."""
    stats = {"clusters_created": 0, "items_deduped": 0}

    # Use RPC call for the similarity query (requires a Supabase function)
    # For now, fetch recent items and do client-side dedup by exact title match
    from datetime import timedelta

    cutoff = (datetime.utcnow() - timedelta(hours=window_hours)).isoformat()
    result = supabase_client.table("intel_items").select(
        "id, title, source_name, published_at, created_at"
    ).in_("status", ["classified", "analyzed"]).is_(
        "dedup_cluster_id", "null"
    ).gte("created_at", cutoff).order("created_at", desc=False).limit(500).execute()

    items = result.data or []
    if len(items) < 2:
        return stats

    # Simple client-side dedup: group by normalized title similarity
    from difflib import SequenceMatcher

    processed = set()
    for i, a in enumerate(items):
        if a["id"] in processed:
            continue
        cluster = [a]
        for b in items[i + 1:]:
            if b["id"] in processed:
                continue
            ratio = SequenceMatcher(None, a["title"].lower(), b["title"].lower()).ratio()
            if ratio > similarity_threshold:
                cluster.append(b)
                processed.add(b["id"])

        if len(cluster) >= 2:
            processed.add(a["id"])
            cluster_id = str(uuid.uuid4())

            # Keep earliest as canonical
            canonical_id = cluster[0]["id"]
            supabase_client.table("intel_items").update(
                {"dedup_cluster_id": cluster_id}
            ).eq("id", canonical_id).execute()

            for dup in cluster[1:]:
                supabase_client.table("intel_items").update(
                    {"status": "deduped", "dedup_cluster_id": cluster_id}
                ).eq("id", dup["id"]).execute()
                stats["items_deduped"] += 1

            stats["clusters_created"] += 1

    return stats
