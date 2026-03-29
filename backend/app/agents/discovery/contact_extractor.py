"""Naomi Tanaka — Contact Intelligence Specialist (Discovery department)."""

import re
import logging
from typing import Any

import httpx

from app.agents.base import BaseSubAgent

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
)
UK_PHONE_RE = re.compile(
    r"(?:(?:\+44\s?|0)(?:\d\s?){9,10})",
)
IGNORE_EMAIL_DOMAINS = {
    "example.com", "sentry.io", "wixpress.com", "wordpress.org",
    "w3.org", "schema.org", "googleapis.com", "gravatar.com",
}
REQUEST_TIMEOUT = 5.0
CONTACT_PATHS = ["/contact", "/contact-us", "/about/contact", "/get-in-touch"]


class ContactInfoExtractorAgent(BaseSubAgent):
    name = "contact_extractor"
    persona = "Naomi Tanaka"
    title = "Contact Intelligence Specialist"
    agent_type = "DET"
    description = "Extracts email addresses and UK phone numbers from company websites"

    async def run(self, **kwargs: Any) -> dict:
        website_url: str = kwargs["website_url"]
        base = website_url.rstrip("/")

        pages_to_fetch = [base] + [f"{base}{p}" for p in CONTACT_PATHS]
        all_html = []

        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
            verify=False,
            headers={"User-Agent": "Mozilla/5.0"},
        ) as client:
            for url in pages_to_fetch:
                try:
                    resp = await client.get(url)
                    if resp.status_code < 400:
                        all_html.append(resp.text[:50_000])
                except (httpx.HTTPError, httpx.InvalidURL):
                    continue

        combined = "\n".join(all_html)

        raw_emails = set(EMAIL_RE.findall(combined))
        emails = sorted({
            e.lower() for e in raw_emails
            if not any(e.lower().endswith(f"@{d}") for d in IGNORE_EMAIL_DOMAINS)
            and not e.lower().endswith(".png")
            and not e.lower().endswith(".jpg")
        })

        raw_phones = UK_PHONE_RE.findall(combined)
        phones = sorted(set(
            re.sub(r"\s+", "", p) for p in raw_phones
        ))

        return {"emails": emails[:10], "phones": phones[:5]}
