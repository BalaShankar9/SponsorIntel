"""
Job Deduplication Service.

Identifies duplicate job listings across multiple sources using
fuzzy matching on title + company name, combined with location matching.
"""

import logging
import uuid
from datetime import datetime
from typing import Optional

from rapidfuzz import fuzz
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job, JobDedupCluster

logger = logging.getLogger(__name__)

# Similarity threshold for considering two jobs as duplicates
SIMILARITY_THRESHOLD = 85


async def deduplicate_jobs(
    db: AsyncSession,
    batch_size: int = 1000,
) -> dict:
    """
    Deduplicate jobs by grouping similar listings into clusters.

    Algorithm:
    1. Fetch unclustered jobs in batches
    2. For each job, compare against existing clusters and unclustered jobs
    3. If title+company similarity >= 85% AND same city -> same cluster
    4. Set canonical_job_id to the most complete listing

    Returns dict with stats: {clusters_created, jobs_clustered, jobs_processed}
    """
    stats = {"clusters_created": 0, "jobs_clustered": 0, "jobs_processed": 0}

    # Fetch unclustered jobs
    result = await db.execute(
        select(Job)
        .where(Job.dedup_cluster_id.is_(None))
        .order_by(Job.scraped_at.desc())
        .limit(batch_size)
    )
    unclustered_jobs = list(result.scalars().all())

    if not unclustered_jobs:
        logger.info("No unclustered jobs to process")
        return stats

    logger.info("Processing %d unclustered jobs for deduplication", len(unclustered_jobs))

    # Fetch existing clusters with their canonical jobs for comparison
    existing_clusters = await _load_existing_clusters(db)

    for job in unclustered_jobs:
        stats["jobs_processed"] += 1

        # Try to match against existing clusters
        matched_cluster_id = await _match_to_existing_cluster(
            job, existing_clusters, db
        )

        if matched_cluster_id:
            job.dedup_cluster_id = matched_cluster_id
            stats["jobs_clustered"] += 1

            # Update cluster source count
            await db.execute(
                update(JobDedupCluster)
                .where(JobDedupCluster.id == matched_cluster_id)
                .values(source_count=JobDedupCluster.source_count + 1)
            )

            # Check if this job should become the canonical one
            await _maybe_update_canonical(db, matched_cluster_id, job)
        else:
            # Try to match against other unclustered jobs in this batch
            matched_job = _find_matching_unclustered(job, unclustered_jobs)

            if matched_job and matched_job.dedup_cluster_id:
                # The other job was already clustered in this batch
                job.dedup_cluster_id = matched_job.dedup_cluster_id
                stats["jobs_clustered"] += 1

                await db.execute(
                    update(JobDedupCluster)
                    .where(JobDedupCluster.id == matched_job.dedup_cluster_id)
                    .values(source_count=JobDedupCluster.source_count + 1)
                )
            elif matched_job:
                # Create a new cluster for both jobs
                cluster = JobDedupCluster(
                    id=uuid.uuid4(),
                    source_count=2,
                    sources=[str(job.source), str(matched_job.source)],
                    first_seen_at=min(job.first_seen_at, matched_job.first_seen_at),
                )
                # Set canonical to the most complete job
                canonical = _pick_canonical(job, matched_job)
                cluster.canonical_job_id = canonical.id

                db.add(cluster)
                await db.flush()

                job.dedup_cluster_id = cluster.id
                matched_job.dedup_cluster_id = cluster.id

                # Cache for subsequent iterations
                existing_clusters.append({
                    "cluster_id": cluster.id,
                    "canonical_title": canonical.title_normalised or canonical.title_raw,
                    "canonical_company": canonical.company_name_normalised or canonical.company_name_raw,
                    "canonical_city": canonical.location_city,
                })

                stats["clusters_created"] += 1
                stats["jobs_clustered"] += 2

    await db.flush()

    logger.info(
        "Dedup complete: %d processed, %d clustered, %d new clusters",
        stats["jobs_processed"],
        stats["jobs_clustered"],
        stats["clusters_created"],
    )

    return stats


def are_jobs_similar(
    title_a: str,
    company_a: str,
    city_a: Optional[str],
    title_b: str,
    company_b: str,
    city_b: Optional[str],
    threshold: int = SIMILARITY_THRESHOLD,
) -> bool:
    """
    Check if two jobs are likely the same listing.

    Criteria: title+company fuzzy similarity >= threshold AND same city.
    """
    if not title_a or not title_b or not company_a or not company_b:
        return False

    # Combine title + company for comparison
    text_a = f"{title_a.lower()} {company_a.lower()}"
    text_b = f"{title_b.lower()} {company_b.lower()}"

    similarity = fuzz.token_sort_ratio(text_a, text_b)

    if similarity < threshold:
        return False

    # City matching (both must be present and match, or both absent)
    city_a_norm = (city_a or "").lower().strip()
    city_b_norm = (city_b or "").lower().strip()

    if city_a_norm and city_b_norm:
        return city_a_norm == city_b_norm
    elif not city_a_norm and not city_b_norm:
        return True

    # One has city, other doesn't - still consider similar
    return True


async def _load_existing_clusters(db: AsyncSession) -> list[dict]:
    """Load existing clusters with their canonical job data for comparison."""
    result = await db.execute(
        select(
            JobDedupCluster.id,
            Job.title_normalised,
            Job.title_raw,
            Job.company_name_normalised,
            Job.company_name_raw,
            Job.location_city,
        )
        .join(Job, Job.id == JobDedupCluster.canonical_job_id)
        .limit(5000)
    )

    clusters = []
    for row in result.all():
        clusters.append({
            "cluster_id": row[0],
            "canonical_title": row[1] or row[2],
            "canonical_company": row[3] or row[4],
            "canonical_city": row[5],
        })

    return clusters


async def _match_to_existing_cluster(
    job: Job,
    clusters: list[dict],
    db: AsyncSession,
) -> Optional[uuid.UUID]:
    """Try to match a job against existing clusters."""
    job_title = job.title_normalised or job.title_raw
    job_company = job.company_name_normalised or job.company_name_raw
    job_city = job.location_city

    for cluster in clusters:
        if are_jobs_similar(
            job_title,
            job_company,
            job_city,
            cluster["canonical_title"],
            cluster["canonical_company"],
            cluster["canonical_city"],
        ):
            return cluster["cluster_id"]

    return None


def _find_matching_unclustered(job: Job, all_jobs: list[Job]) -> Optional[Job]:
    """Find a matching job among unclustered jobs."""
    job_title = job.title_normalised or job.title_raw
    job_company = job.company_name_normalised or job.company_name_raw
    job_city = job.location_city

    for other in all_jobs:
        if other.id == job.id:
            continue

        other_title = other.title_normalised or other.title_raw
        other_company = other.company_name_normalised or other.company_name_raw
        other_city = other.location_city

        if are_jobs_similar(
            job_title, job_company, job_city,
            other_title, other_company, other_city,
        ):
            return other

    return None


def _pick_canonical(job_a: Job, job_b: Job) -> Job:
    """
    Pick the canonical (best) job from two duplicates.

    Prefers: longest description, has salary, most recent scrape.
    """
    score_a = 0
    score_b = 0

    # Longer description
    len_a = len(job_a.description_full or "")
    len_b = len(job_b.description_full or "")
    if len_a > len_b:
        score_a += 2
    elif len_b > len_a:
        score_b += 2

    # Has salary
    if job_a.salary_min is not None:
        score_a += 1
    if job_b.salary_min is not None:
        score_b += 1

    # More recent scrape
    if job_a.scraped_at > job_b.scraped_at:
        score_a += 1
    elif job_b.scraped_at > job_a.scraped_at:
        score_b += 1

    return job_a if score_a >= score_b else job_b


async def _maybe_update_canonical(
    db: AsyncSession,
    cluster_id: uuid.UUID,
    new_job: Job,
) -> None:
    """Update the canonical job if the new job is more complete."""
    result = await db.execute(
        select(JobDedupCluster).where(JobDedupCluster.id == cluster_id)
    )
    cluster = result.scalar_one_or_none()
    if not cluster or not cluster.canonical_job_id:
        return

    current_canonical = await db.get(Job, cluster.canonical_job_id)
    if not current_canonical:
        return

    if _pick_canonical(current_canonical, new_job).id == new_job.id:
        cluster.canonical_job_id = new_job.id
