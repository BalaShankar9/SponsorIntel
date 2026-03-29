"""Elena Volkov — Company Research Director (Research department)."""

import logging
from typing import Any

from app.agents.base import BaseAgent
from app.agents.registry import register_agent

from .website_finder import WebsiteFinderAgent
from .linkedin_finder import LinkedInFinderAgent
from .careers_detector import CareersPageDetectorAgent
from .contact_extractor import ContactInfoExtractorAgent

logger = logging.getLogger(__name__)


@register_agent("discovery")
class DiscoveryAgent(BaseAgent):
    persona = "Elena Volkov"
    title = "Company Research Director"
    department = "Research"
    name = "discovery"
    description = (
        "Leads digital research on 124,000+ UK sponsor licence holders — finding "
        "their websites, LinkedIn pages, career portals, ATS platforms, and contacts."
    )

    def _register_sub_agents(self):
        self.register(WebsiteFinderAgent())
        self.register(LinkedInFinderAgent())
        self.register(CareersPageDetectorAgent())
        self.register(ContactInfoExtractorAgent())

    async def run_pipeline(self, sponsors: list[dict], supabase: Any, **kwargs) -> dict:
        """Run the discovery pipeline for a batch of sponsors.

        Each sponsor dict must have: id, organisation_name, town_city (optional).
        """
        metrics = {
            "processed": 0,
            "websites_found": 0,
            "linkedin_found": 0,
            "careers_found": 0,
            "contacts_found": 0,
            "errors": 0,
        }

        website_finder = self.get_sub_agent("website_finder")
        linkedin_finder = self.get_sub_agent("linkedin_finder")
        careers_detector = self.get_sub_agent("careers_detector")
        contact_extractor = self.get_sub_agent("contact_extractor")

        for sponsor in sponsors:
            sponsor_id = sponsor["id"]
            company_name = sponsor["organisation_name"]
            town_city = sponsor.get("town_city")

            try:
                update_data = {}

                # Step 1: Find website
                ws_result = await website_finder.execute(
                    company_name=company_name,
                    town_city=town_city,
                )
                website_url = None
                if ws_result.success and ws_result.data.get("website_url"):
                    website_url = ws_result.data["website_url"]
                    update_data["website_url"] = website_url
                    metrics["websites_found"] += 1

                # Step 2: Find LinkedIn
                li_result = await linkedin_finder.execute(company_name=company_name)
                if li_result.success and li_result.data.get("linkedin_url"):
                    update_data["linkedin_url"] = li_result.data["linkedin_url"]
                    metrics["linkedin_found"] += 1

                # Step 3: Detect careers page (only if website found)
                if website_url:
                    cp_result = await careers_detector.execute(website_url=website_url)
                    if cp_result.success and cp_result.data.get("has_careers_page"):
                        update_data["careers_url"] = cp_result.data["careers_url"]
                        if cp_result.data.get("ats_platform"):
                            update_data["ats_platform"] = cp_result.data["ats_platform"]
                        metrics["careers_found"] += 1

                    # Step 4: Extract contact info
                    ci_result = await contact_extractor.execute(website_url=website_url)
                    if ci_result.success:
                        if ci_result.data.get("emails"):
                            update_data["contact_email"] = ci_result.data["emails"][0]
                        if ci_result.data.get("phones"):
                            update_data["contact_phone"] = ci_result.data["phones"][0]
                        if ci_result.data.get("emails") or ci_result.data.get("phones"):
                            metrics["contacts_found"] += 1

                # Update Supabase if we found anything
                if update_data:
                    supabase.table("company_profiles").update(
                        update_data
                    ).eq("sponsor_id", sponsor_id).execute()

                metrics["processed"] += 1

            except Exception as e:
                logger.error(f"[Discovery] Failed for {company_name}: {e}")
                metrics["errors"] += 1

        logger.info(
            f"[Discovery] Pipeline complete: {metrics['processed']} processed, "
            f"{metrics['websites_found']} websites, {metrics['linkedin_found']} LinkedIn, "
            f"{metrics['careers_found']} careers pages, {metrics['contacts_found']} contacts"
        )
        return metrics
