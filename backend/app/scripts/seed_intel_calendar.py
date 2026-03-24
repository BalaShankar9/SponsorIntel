"""Seed initial immigration calendar events for 2026."""

from supabase import create_client
from app.core.config import get_settings

SEED_EVENTS = [
    {
        "title": "Home Office Immigration Statistics Q4 2025",
        "description": "Quarterly immigration statistics release covering October-December 2025.",
        "event_date": "2026-03-27",
        "event_type": "statistics_release",
        "visa_routes": ["General"],
        "source_url": "https://www.gov.uk/government/collections/immigration-statistics-quarterly-release",
        "is_confirmed": True,
    },
    {
        "title": "MAC Annual Report 2025-26",
        "description": "Migration Advisory Committee annual report on the labour market and immigration.",
        "event_date": "2026-04-15",
        "event_type": "mac_report",
        "visa_routes": ["Skilled Worker", "General"],
        "is_confirmed": False,
    },
    {
        "title": "Statement of Changes HC Spring 2026",
        "description": "Expected spring statement of changes to the Immigration Rules.",
        "event_date": "2026-04-01",
        "event_type": "rule_change",
        "visa_routes": ["General"],
        "is_confirmed": False,
    },
    {
        "title": "SOL Review Consultation Closes",
        "description": "Shortage Occupation List review consultation deadline.",
        "event_date": "2026-05-01",
        "event_type": "consultation",
        "visa_routes": ["Skilled Worker"],
        "is_confirmed": False,
    },
    {
        "title": "ONS Net Migration Estimate",
        "description": "Office for National Statistics releases updated net migration estimates.",
        "event_date": "2026-05-22",
        "event_type": "statistics_release",
        "visa_routes": ["General"],
        "source_url": "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration",
        "is_confirmed": True,
    },
    {
        "title": "Home Office Immigration Statistics Q1 2026",
        "description": "Quarterly immigration statistics release covering January-March 2026.",
        "event_date": "2026-06-26",
        "event_type": "statistics_release",
        "visa_routes": ["General"],
        "is_confirmed": True,
    },
]


def seed():
    s = get_settings()
    sb = create_client(s.supabase_url, s.supabase_service_key)

    for event in SEED_EVENTS:
        existing = sb.table("intel_calendar").select("id").eq(
            "title", event["title"]
        ).limit(1).execute()
        if not existing.data:
            sb.table("intel_calendar").insert(event).execute()
            print(f"  Seeded: {event['title']}")
        else:
            print(f"  Skipped (exists): {event['title']}")

    print("Done seeding calendar events.")


if __name__ == "__main__":
    seed()
