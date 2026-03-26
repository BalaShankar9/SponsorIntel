"""Immigration Salary List (ISL) parser."""
import logging
logger = logging.getLogger(__name__)

def parse_isl_entry(entry: dict) -> dict:
    job_titles_str = entry.get("job_titles", "")
    if isinstance(job_titles_str, str):
        job_titles = [t.strip() for t in job_titles_str.split(",") if t.strip()]
    else:
        job_titles = list(job_titles_str)
    return {
        "soc_code": str(entry.get("soc_code", "")).strip(),
        "occupation_title": str(entry.get("occupation", "")).strip(),
        "job_titles": job_titles,
        "is_going_rate_exempt": True,
        "standard_threshold": 38700,
        "is_active": True,
    }

def check_job_on_isl(job_title: str, isl_entries: list[dict]) -> str | None:
    title_lower = job_title.lower().strip()
    for entry in isl_entries:
        for isl_title in entry.get("job_titles", []):
            if isl_title.lower() in title_lower:
                return entry["soc_code"]
    return None
