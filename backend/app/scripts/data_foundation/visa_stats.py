"""Home Office visa statistics ingestion."""
import logging
import re

logger = logging.getLogger(__name__)

def parse_number(value: str) -> int:
    if not value or str(value).strip() in ("..", "-", "x", "~", "*", ""):
        return 0
    cleaned = re.sub(r"[^0-9]", "", str(value))
    return int(cleaned) if cleaned else 0

def parse_soc_row(row: dict) -> dict:
    return {
        "soc_code": str(row.get("soc_code", "")).strip(),
        "occupation_title": str(row.get("occupation", "")).strip(),
        "grants_total": parse_number(str(row.get("grants", "0"))),
        "year": int(row.get("year", 0)),
        "grants_by_nationality": row.get("grants_by_nationality"),
        "grants_by_industry": row.get("grants_by_industry"),
    }
