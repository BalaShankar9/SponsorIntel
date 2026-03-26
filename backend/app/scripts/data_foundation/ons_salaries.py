"""ONS ASHE salary benchmark ingestion."""
import logging
import re
logger = logging.getLogger(__name__)

def parse_salary_value(value) -> int | None:
    if value is None:
        return None
    s = str(value).strip()
    if s in ("x", "..", "*", "-", "", ":", "#"):
        return None
    cleaned = re.sub(r"[^0-9.]", "", s)
    if not cleaned:
        return None
    return int(float(cleaned))

def parse_ashe_row(row: dict) -> dict | None:
    soc = str(row.get("soc_code", "")).strip()
    if not soc or len(soc) < 2:
        return None
    median = parse_salary_value(row.get("median"))
    if median is None or median < 1000:
        return None
    return {
        "soc_code": soc,
        "occupation_title": str(row.get("occupation", "")).strip(),
        "median_salary": median,
        "p10_salary": parse_salary_value(row.get("p10")),
        "p25_salary": parse_salary_value(row.get("p25")),
        "p75_salary": parse_salary_value(row.get("p75")),
        "p90_salary": parse_salary_value(row.get("p90")),
        "sample_size": parse_salary_value(row.get("sample_size")),
        "region": row.get("region", "UK"),
        "year": int(row.get("year", 0)),
    }
