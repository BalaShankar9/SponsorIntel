"""Priya Kapoor — Lead Sponsorship Analyst (Intelligence department)."""

from __future__ import annotations

import logging
from typing import Any

from app.agents.base import BaseAgent, SubAgentResult
from app.agents.registry import register_agent

from app.agents.enrichment.salary_parser import SalaryParserAgent
from app.agents.enrichment.salary_normaliser import SalaryNormaliserAgent
from app.agents.enrichment.sponsorship_keyword_scanner import SponsorshipKeywordScannerAgent
from app.agents.enrichment.sponsor_register_matcher import SponsorRegisterMatcherAgent
from app.agents.enrichment.visa_threshold_checker import VisaThresholdCheckerAgent
from app.agents.enrichment.shortage_list_matcher import ShortageListMatcherAgent
from app.agents.enrichment.sponsorship_score_calculator import SponsorshipScoreCalculatorAgent
from app.agents.enrichment.certification_extractor import CertificationExtractorAgent
from app.agents.enrichment.tech_stack_extractor import TechStackExtractorAgent
from app.agents.enrichment.soc_classifier import SOCClassifierAgent
from app.agents.enrichment.work_model_detector import WorkModelDetectorAgent
from app.agents.enrichment.seniority_detector import SeniorityDetectorAgent

logger = logging.getLogger(__name__)


@register_agent("enrichment")
class EnrichmentAgent(BaseAgent):
    """Priya Kapoor: Predicts visa sponsorship probability for every job listing."""

    persona = "Priya Kapoor"
    title = "Lead Sponsorship Analyst"
    department = "Intelligence"
    name = "enrichment"
    description = (
        "Manages a 12-analyst team that scores every job (0-100%) for sponsorship "
        "likelihood using the UK Sponsor Register, shortage list, salary thresholds, "
        "and 40+ keyword signals."
    )

    # ------------------------------------------------------------------
    # Sub-agent registration
    # ------------------------------------------------------------------

    def _register_sub_agents(self) -> None:
        """Register all enrichment sub-agents in pipeline order."""
        self.register(SalaryParserAgent())
        self.register(SalaryNormaliserAgent())
        self.register(SponsorshipKeywordScannerAgent())
        self.register(SponsorRegisterMatcherAgent())
        self.register(VisaThresholdCheckerAgent())
        self.register(ShortageListMatcherAgent())
        self.register(SponsorshipScoreCalculatorAgent())
        self.register(CertificationExtractorAgent())
        self.register(TechStackExtractorAgent())
        self.register(SOCClassifierAgent())
        self.register(WorkModelDetectorAgent())
        self.register(SeniorityDetectorAgent())

    # ------------------------------------------------------------------
    # Pipeline
    # ------------------------------------------------------------------

    async def run_pipeline(self, jobs: list[dict[str, Any]], supabase: Any) -> list[dict[str, Any]]:
        """
        Run the full enrichment pipeline over a batch of jobs and persist
        results to Supabase.

        Parameters
        ----------
        jobs : list[dict]
            Raw job dicts (must contain at minimum ``id``, ``title``,
            ``description``, and optionally ``salary_raw``, ``company_name``).
        supabase : Any
            Authenticated Supabase client.

        Returns
        -------
        list[dict]
            The enriched job dicts.
        """
        salary_parser = self.get_sub_agent("salary_parser")
        salary_normaliser = self.get_sub_agent("salary_normaliser")
        keyword_scanner = self.get_sub_agent("sponsorship_keyword_scanner")
        register_matcher = self.get_sub_agent("sponsor_register_matcher")
        visa_checker = self.get_sub_agent("visa_threshold_checker")
        shortage_matcher = self.get_sub_agent("shortage_list_matcher")
        score_calculator = self.get_sub_agent("sponsorship_score_calculator")
        cert_extractor = self.get_sub_agent("certification_extractor")
        tech_extractor = self.get_sub_agent("tech_stack_extractor")
        soc_classifier = self.get_sub_agent("soc_classifier")
        work_model_detector = self.get_sub_agent("work_model_detector")
        seniority_detector = self.get_sub_agent("seniority_detector")

        enriched_jobs: list[dict[str, Any]] = []

        for job in jobs:
            try:
                enrichment: dict[str, Any] = {}
                # Map from Supabase column names (title_raw etc.) to agent inputs
                description = job.get("description_full") or job.get("description") or ""
                title = job.get("title_raw") or job.get("title") or ""
                company_name = job.get("company_name_raw") or job.get("company_name") or ""
                salary_raw = job.get("salary_text_raw") or job.get("salary_raw") or ""

                # --- Phase 1: Salary parsing & normalisation ----------------
                parsed_salary: SubAgentResult = await salary_parser.run(
                    salary_string=salary_raw,
                )
                enrichment["salary_parsed"] = parsed_salary.data

                normalised_salary: SubAgentResult = await salary_normaliser.run(
                    parsed_salary=parsed_salary.data,
                )
                enrichment["salary_normalised"] = normalised_salary.data
                annual_salary = normalised_salary.data.get("annual_gbp_min") if normalised_salary.data else None

                # --- Phase 2: Sponsorship signals ---------------------------
                keyword_result: SubAgentResult = await keyword_scanner.run(
                    description=description,
                    title=title,
                )
                enrichment["sponsorship_keywords"] = keyword_result.data

                register_result: SubAgentResult = await register_matcher.run(
                    company_name=company_name,
                )
                enrichment["sponsor_register"] = register_result.data

                visa_result: SubAgentResult = await visa_checker.run(
                    annual_salary=annual_salary,
                    soc_code=job.get("soc_code"),
                )
                enrichment["visa_threshold"] = visa_result.data

                shortage_result: SubAgentResult = await shortage_matcher.run(
                    title=title,
                    soc_code=job.get("soc_code"),
                    description=description,
                )
                enrichment["shortage_list"] = shortage_result.data

                # --- Phase 3: Sponsorship score -----------------------------
                score_result: SubAgentResult = await score_calculator.run(
                    register_data=register_result.data,
                    keyword_data=keyword_result.data,
                    visa_data=visa_result.data,
                    shortage_data=shortage_result.data,
                )
                enrichment["sponsorship_score"] = score_result.data

                # --- Phase 4: Classification & extraction -------------------
                cert_result: SubAgentResult = await cert_extractor.run(
                    description=description,
                )
                enrichment["certifications"] = cert_result.data

                tech_result: SubAgentResult = await tech_extractor.run(
                    description=description,
                    title=title,
                )
                enrichment["tech_stack"] = tech_result.data

                soc_result: SubAgentResult = await soc_classifier.run(
                    title=title,
                    description=description,
                )
                enrichment["soc_code"] = soc_result.data

                work_model_result: SubAgentResult = await work_model_detector.run(
                    description=description,
                    title=title,
                )
                enrichment["work_model"] = work_model_result.data

                seniority_result: SubAgentResult = await seniority_detector.run(
                    title=title,
                    description=description,
                )
                enrichment["seniority"] = seniority_result.data

                # --- Phase 5: Persist to Supabase ---------------------------
                job["enrichment"] = enrichment
                score_total = (
                    score_result.data.get("total", 0) if score_result.data else 0
                )

                # Build sponsorship signals dict for the JSONB column
                signals_dict = {
                    "keywords": enrichment["sponsorship_keywords"].get("matched_keywords", []) if enrichment["sponsorship_keywords"] else [],
                    "strong_positive": enrichment["sponsorship_keywords"].get("strong_positive", False) if enrichment["sponsorship_keywords"] else False,
                    "on_register": enrichment["sponsor_register"].get("on_register", False) if enrichment["sponsor_register"] else False,
                    "register_rating": enrichment["sponsor_register"].get("rating") if enrichment["sponsor_register"] else None,
                    "meets_visa_threshold": enrichment["visa_threshold"].get("meets_threshold", False) if enrichment["visa_threshold"] else False,
                    "on_shortage_list": enrichment["shortage_list"].get("on_shortage_list", False) if enrichment["shortage_list"] else False,
                    "score_breakdown": score_result.data.get("breakdown", {}) if score_result.data else {},
                    "tier": score_result.data.get("tier", "unknown") if score_result.data else "unknown",
                }

                update_payload = {
                    # Salary (normalised to annual GBP)
                    "salary_min": enrichment["salary_normalised"].get("annual_gbp_min") if enrichment["salary_normalised"] else job.get("salary_min"),
                    "salary_max": enrichment["salary_normalised"].get("annual_gbp_max") if enrichment["salary_normalised"] else job.get("salary_max"),
                    "salary_currency": enrichment["salary_parsed"].get("currency", "GBP") if enrichment["salary_parsed"] else job.get("salary_currency", "GBP"),
                    "salary_period": enrichment["salary_parsed"].get("period", "ANNUAL") if enrichment["salary_parsed"] else job.get("salary_period"),
                    # Sponsorship (the core value)
                    "sponsorship_likelihood": score_total,
                    "sponsorship_signals": signals_dict,
                    "is_on_shortage_list": enrichment["shortage_list"].get("on_shortage_list", False) if enrichment["shortage_list"] else False,
                    "meets_salary_threshold": enrichment["visa_threshold"].get("meets_threshold", False) if enrichment["visa_threshold"] else False,
                    # Classification
                    "skills_extracted": enrichment["tech_stack"].get("technologies", []) if enrichment["tech_stack"] else [],
                    "soc_code": enrichment["soc_code"].get("soc_code") if enrichment["soc_code"] else None,
                    "work_model": enrichment["work_model"].get("work_model") if enrichment["work_model"] else None,
                    "seniority": enrichment["seniority"].get("seniority") if enrichment["seniority"] else None,
                    # Mark as enriched with quality score
                    "data_quality_score": 80,
                }

                # Remove None values to avoid overwriting existing data with nulls
                update_payload = {k: v for k, v in update_payload.items() if v is not None}

                supabase.table("jobs").update(update_payload).eq("id", job["id"]).execute()

                enriched_jobs.append(job)
                logger.info(
                    "Enriched job %s (%s) - score=%d",
                    job["id"],
                    title[:60],
                    score_total,
                )

            except Exception:
                logger.exception("Failed to enrich job %s", job.get("id", "unknown"))
                enriched_jobs.append(job)

        logger.info(
            "Enrichment pipeline complete: %d/%d jobs enriched",
            len(enriched_jobs),
            len(jobs),
        )
        return enriched_jobs
