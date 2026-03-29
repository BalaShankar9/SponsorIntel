"""Marcus Chen — Head of Data Quality (Quality Assurance department)."""

from __future__ import annotations

import logging
import time
from typing import Any

from app.agents.base import BaseAgent
from app.agents.registry import register_agent
from app.agents.validator.cluster_builder import ClusterBuilder
from app.agents.validator.company_normaliser import CompanyNormaliser
from app.agents.validator.date_validator import DateValidator
from app.agents.validator.description_cleaner import DescriptionCleaner
from app.agents.validator.salary_validator import SalaryValidator
from app.agents.validator.similarity_scorer import SimilarityScorer
from app.agents.validator.spam_classifier import SpamClassifier
from app.agents.validator.title_normaliser import TitleNormaliser

logger = logging.getLogger(__name__)

# Fields used to compute data quality score and their weights
_QUALITY_FIELDS: dict[str, float] = {
    "title": 0.15,
    "company_name": 0.15,
    "description": 0.15,
    "location": 0.10,
    "salary_raw": 0.10,
    "posted_date": 0.10,
    "salary_valid": 0.10,
    "date_valid": 0.05,
    "description_clean": 0.05,
    "company_name_normalised": 0.05,
}


@register_agent("validator")
class ValidatorAgent(BaseAgent):
    """Marcus Chen: Guards data integrity across the entire pipeline."""

    persona = "Marcus Chen"
    title = "Head of Data Quality"
    department = "Quality Assurance"
    name = "validator"
    description = (
        "Runs an 8-person QA team that cleans, validates, and deduplicates "
        "every record entering the platform. Zero tolerance for spam or bad data."
    )

    # ------------------------------------------------------------------
    def _register_sub_agents(self) -> None:
        self.register(DescriptionCleaner())
        self.register(CompanyNormaliser())
        self.register(TitleNormaliser())
        self.register(SalaryValidator())
        self.register(DateValidator())
        self.register(SpamClassifier())
        self.register(SimilarityScorer())
        self.register(ClusterBuilder())

    # ------------------------------------------------------------------
    async def run_pipeline(self, jobs: list[dict], supabase: Any = None, **kwargs: Any) -> dict:
        """
        Run the full validation pipeline on a list of job dicts.

        Steps:
            1. Clean descriptions
            2. Normalise company names and job titles
            3. Validate salaries and dates
            4. Run spam detection
            5. Score similarity and build dedup clusters
            6. Compute data_quality_score per job
            7. Update jobs in supabase (if client provided)

        Returns a summary dict with stats and the processed jobs.
        """
        pipeline_start = time.perf_counter()
        total_llm_calls = 0
        errors: list[str] = []

        logger.info("ValidatorAgent: starting pipeline for %d jobs", len(jobs))

        # --- Step 1: Clean descriptions ---
        desc_cleaner = self.get_sub_agent("description_cleaner")
        result = await desc_cleaner.run(jobs=jobs)
        total_llm_calls += result.llm_calls
        if not result.success:
            errors.append(f"description_cleaner: {result.error}")
        jobs = result.data if isinstance(result.data, list) else jobs

        # --- Step 2: Normalise company names and titles ---
        company_norm = self.get_sub_agent("company_normaliser")
        title_norm = self.get_sub_agent("title_normaliser")

        company_result = await company_norm.run(jobs=jobs)
        total_llm_calls += company_result.llm_calls
        if not company_result.success:
            errors.append(f"company_normaliser: {company_result.error}")
        jobs = company_result.data if isinstance(company_result.data, list) else jobs

        title_result = await title_norm.run(jobs=jobs, **kwargs)
        total_llm_calls += title_result.llm_calls
        if not title_result.success:
            errors.append(f"title_normaliser: {title_result.error}")
        jobs = title_result.data if isinstance(title_result.data, list) else jobs

        # --- Step 3: Validate salaries and dates ---
        salary_val = self.get_sub_agent("salary_validator")
        date_val = self.get_sub_agent("date_validator")

        salary_result = await salary_val.run(jobs=jobs)
        total_llm_calls += salary_result.llm_calls
        if not salary_result.success:
            errors.append(f"salary_validator: {salary_result.error}")
        if isinstance(salary_result.data, dict) and "jobs" in salary_result.data:
            jobs = salary_result.data["jobs"]

        date_result = await date_val.run(jobs=jobs)
        total_llm_calls += date_result.llm_calls
        if not date_result.success:
            errors.append(f"date_validator: {date_result.error}")
        if isinstance(date_result.data, dict) and "jobs" in date_result.data:
            jobs = date_result.data["jobs"]

        # --- Step 4: Spam detection ---
        spam_cls = self.get_sub_agent("spam_classifier")
        spam_result = await spam_cls.run(jobs=jobs, **kwargs)
        total_llm_calls += spam_result.llm_calls
        if not spam_result.success:
            errors.append(f"spam_classifier: {spam_result.error}")
        if isinstance(spam_result.data, dict) and "jobs" in spam_result.data:
            jobs = spam_result.data["jobs"]

        # --- Step 5: Similarity scoring and dedup clustering ---
        sim_scorer = self.get_sub_agent("similarity_scorer")
        sim_result = await sim_scorer.run(jobs=jobs)
        total_llm_calls += sim_result.llm_calls
        if not sim_result.success:
            errors.append(f"similarity_scorer: {sim_result.error}")

        scores = sim_result.data if isinstance(sim_result.data, list) else []

        cluster_builder = self.get_sub_agent("cluster_builder")
        cluster_result = await cluster_builder.run(scores=scores, num_jobs=len(jobs))
        total_llm_calls += cluster_result.llm_calls
        if not cluster_result.success:
            errors.append(f"cluster_builder: {cluster_result.error}")

        cluster_data = cluster_result.data if isinstance(cluster_result.data, dict) else {}
        clusters = cluster_data.get("clusters", {})

        # Mark duplicate jobs (keep the first in each cluster as canonical)
        duplicate_indices: set[int] = set()
        for members in clusters.values():
            for idx in members[1:]:
                duplicate_indices.add(idx)

        for i, job in enumerate(jobs):
            job["is_duplicate"] = i in duplicate_indices

        # --- Step 6: Compute data quality score ---
        for job in jobs:
            job["data_quality_score"] = self._compute_quality_score(job)

        # --- Step 7: Update in supabase ---
        updated_count = 0
        if supabase is not None:
            updated_count = await self._update_supabase(supabase, jobs)

        pipeline_duration = (time.perf_counter() - pipeline_start) * 1000
        spam_count = sum(1 for j in jobs if j.get("spam"))
        dup_count = len(duplicate_indices)
        avg_quality = sum(j.get("data_quality_score", 0) for j in jobs) / max(len(jobs), 1)

        summary = {
            "total_jobs": len(jobs),
            "spam_detected": spam_count,
            "duplicates_detected": dup_count,
            "clusters": len(clusters),
            "avg_quality_score": round(avg_quality, 1),
            "total_llm_calls": total_llm_calls,
            "duration_ms": round(pipeline_duration, 1),
            "errors": errors,
            "updated_in_db": updated_count,
            "jobs": jobs,
        }

        logger.info(
            "ValidatorAgent pipeline complete: %d jobs, %d spam, %d dupes, "
            "avg quality %.1f, %d LLM calls, %.1fms",
            len(jobs),
            spam_count,
            dup_count,
            avg_quality,
            total_llm_calls,
            pipeline_duration,
        )

        return summary

    # ------------------------------------------------------------------
    @staticmethod
    def _compute_quality_score(job: dict) -> int:
        """Compute a 0-100 data quality score based on field completeness and validation."""
        score = 0.0

        for field, weight in _QUALITY_FIELDS.items():
            value = job.get(field)
            if value is None or value == "":
                continue
            # Boolean validation fields contribute full weight only if True
            if isinstance(value, bool):
                if value:
                    score += weight * 100
            else:
                score += weight * 100

        # Penalise spam
        if job.get("spam"):
            score *= 0.1

        # Penalise duplicates
        if job.get("is_duplicate"):
            score *= 0.5

        return max(0, min(100, round(score)))

    # ------------------------------------------------------------------
    @staticmethod
    async def _update_supabase(supabase: Any, jobs: list[dict]) -> int:
        """Persist validated fields and quality scores to supabase."""
        updated = 0
        for job in jobs:
            job_id = job.get("id")
            if not job_id:
                continue

            update_payload = {
                "data_quality_score": job.get("data_quality_score"),
                "is_duplicate": job.get("is_duplicate", False),
                "spam": job.get("spam", False),
                "salary_valid": job.get("salary_valid"),
                "date_valid": job.get("date_valid"),
                "title_normalised": job.get("title_normalised"),
                "company_name_normalised": job.get("company_name_normalised"),
                "description_clean": job.get("description_clean"),
            }

            # Optional annual salary fields
            if job.get("salary_min_annual") is not None:
                update_payload["salary_min_annual"] = job["salary_min_annual"]
            if job.get("salary_max_annual") is not None:
                update_payload["salary_max_annual"] = job["salary_max_annual"]
            if job.get("posted_date_utc") is not None:
                update_payload["posted_date_utc"] = job["posted_date_utc"]

            try:
                await supabase.table("jobs").update(update_payload).eq("id", job_id).execute()
                updated += 1
            except Exception as exc:
                logger.warning("Failed to update job %s in supabase: %s", job_id, exc)

        logger.info("Updated %d/%d jobs in supabase", updated, len(jobs))
        return updated
