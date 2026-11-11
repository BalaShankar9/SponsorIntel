#!/usr/bin/env python3
"""Build a local register research pack from supplied public CSV bytes.

No network, database, application credentials, or publication operation is used.
Register-entry keys deliberately are not legal-company or production sponsor IDs.
"""

import argparse
import collections
import csv
import datetime as dt
import hashlib
import io
import json
from pathlib import Path
import re

HEADERS = ["Organisation Name", "Town/City", "County", "Type & Rating", "Route"]
COLUMNS = ["id", "name", "city", "county", "licences", "source_rows", "variants"]
MAX_BYTES = 25_000_000
MAX_ROWS = 500_000
MAX_FIELD = 4_096
PUBLICATION = "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers"
PLACEHOLDER = "__DOSSIER_DATA__"
FORBIDDEN_CONTROLS = re.compile(r"[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]")


def compact_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def validate_provenance(source_url, source_date, observed_at):
    # Only an already-supplied official CSV is accepted. This never fetches it.
    if not re.fullmatch(r"https://assets\.publishing\.service\.gov\.uk/[A-Za-z0-9_./%+-]+\.csv", source_url):
        raise ValueError("Source URL must identify an HTTPS official publishing-service CSV")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", source_date):
        raise ValueError("Source date must be YYYY-MM-DD")
    try:
        source_day = dt.date.fromisoformat(source_date)
    except ValueError as error:
        raise ValueError("Invalid source date") from error
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})", observed_at):
        raise ValueError("Observation must be an ISO timestamp with explicit timezone")
    try:
        observed = dt.datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("Invalid observation timestamp") from error
    if source_day > observed.astimezone(dt.timezone.utc).date():
        raise ValueError("Source date cannot be later than the observation UTC date")
    url_dates = re.findall(r"\d{4}-\d{2}-\d{2}", source_url)
    if url_dates and any(value != source_date for value in url_dates):
        raise ValueError("Source date disagrees with the date in the source URL")


def clean_field(value):
    if len(value) > MAX_FIELD or FORBIDDEN_CONTROLS.search(value):
        raise ValueError("Register field exceeds bounds or contains forbidden control characters")
    return " ".join(value.split())


def build_dataset(raw, source_url, source_date, observed_at):
    validate_provenance(source_url, source_date, observed_at)
    if not raw or len(raw) > MAX_BYTES:
        raise ValueError("CSV must contain 1 to 25,000,000 bytes")
    try:
        decoded = raw.decode("utf-8-sig", errors="strict")
    except UnicodeDecodeError as error:
        raise ValueError("CSV must be valid UTF-8") from error
    rows = csv.reader(io.StringIO(decoded, newline=""), strict=True)
    try:
        if next(rows, None) != HEADERS:
            raise ValueError("CSV header must exactly match the five official register columns")
        groups = {}
        source_rows = 0
        seen_rows = set()
        duplicates = 0
        for source_row, values in enumerate(rows, start=2):
            if source_row - 1 > MAX_ROWS:
                raise ValueError("Register exceeds the 500,000 source-row bound")
            if len(values) != len(HEADERS):
                raise ValueError(f"CSV record {source_row} does not have exactly five fields")
            name, city, county, rating, route = map(clean_field, values)
            if not name or not rating or not route:
                raise ValueError(f"CSV record {source_row} lacks name, rating, or route")
            identity = (name.casefold(), city.casefold(), county.casefold())
            group = groups.setdefault(identity, {"variants": set(), "licences": set(), "rows": []})
            group["variants"].add((name, city, county))
            group["licences"].add((route, rating))
            group["rows"].append(source_row)
            row_key = (*identity, rating, route)
            if row_key in seen_rows:
                duplicates += 1
            seen_rows.add(row_key)
            source_rows += 1
    except csv.Error as error:
        raise ValueError(f"Malformed CSV: {error}") from error
    if not source_rows:
        raise ValueError("CSV contains no register records")

    entries = []
    routes, cities = collections.Counter(), collections.Counter()
    city_names = {}
    for identity, group in sorted(groups.items()):
        variants = sorted(group["variants"])
        name, city, county = variants[0]
        licences = sorted(group["licences"])
        ident = sha256(compact_json(identity).encode("utf-8"))
        entries.append([ident, name, city, county, licences, group["rows"], variants])
        for route in {pair[0] for pair in licences}:
            routes[route] += 1
        if city:
            cities[identity[1]] += 1
            city_names[identity[1]] = min(city_names.get(identity[1], city), city)
    if sum(len(entry[5]) for entry in entries) != source_rows:
        raise ValueError("Source-row reconciliation failed")
    if len({entry[0] for entry in entries}) != len(entries):
        raise ValueError("Register-entry key collision")
    meta = {
        "source_url": source_url,
        "publication_url": PUBLICATION,
        "source_date": source_date,
        "observed_at": observed_at,
        "source_sha256": sha256(raw),
        "source_bytes": len(raw),
        "source_rows": source_rows,
        "grouped_entries": len(entries),
        "distinct_names": len({key[0] for key in groups}),
        "duplicate_source_rows": duplicates,
        "entries_with_spelling_variants": sum(len(entry[6]) > 1 for entry in entries),
        "blank_town_entries": sum(not entry[2] for entry in entries),
        "routes": [{"name": name, "entries": count} for name, count in sorted(routes.items(), key=lambda item: (-item[1], item[0]))],
        "cities": [{"name": city_names[name], "entries": count} for name, count in sorted(cities.items(), key=lambda item: (-item[1], item[0]))],
        "coverage": {
            "register_entries": "complete_for_supplied_snapshot",
            "business_identity": "not_collected",
            "website": "not_collected",
            "careers": "not_collected",
            "jobs": "not_collected",
        },
        "limitations": [
            "Presence is evidenced only in the supplied register snapshot at its source date; current licence status has not been rechecked by this offline build.",
            "Grouped entries use normalized name, town and county. They are not unique legal companies, verified employers, or licence numbers.",
            "Different locations remain separate; name or location changes can change the research key. It is not the production sponsor ID.",
            "Town/city is the register label, not a verified workplace or a standardized geographical city.",
            "The register does not establish a current vacancy, sponsorship offer, applicant eligibility, business website or trading-name relationship.",
            "Business identity, identifiers, activity, contacts, websites, careers links and jobs have not been collected in this pack.",
            "Route totals overlap because a register entry can have multiple route/rating pairs. Source rows preserve duplicates.",
            "Source row numbers count CSV records including the header, not physical lines inside quoted multiline fields.",
        ],
        "attribution": "Contains public sector information licensed under the Open Government Licence v3.0. Source: Home Office / UK Visas and Immigration.",
        "licence_url": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    }
    return {"schema_version": 1, "columns": COLUMNS, "meta": meta, "entries": entries}


def safe_embedded_json(dataset):
    # Script contents are parsed as text by HTML before JSON.parse reads them.
    return (compact_json(dataset).replace("&", "\\u0026").replace("<", "\\u003c")
            .replace(">", "\\u003e").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def spreadsheet_cell(value):
    text = str(value)
    # CSV quoting does not stop spreadsheet formula evaluation.
    return "'" + text if text.lstrip().startswith(("=", "+", "-", "@")) else text


def build_pack(csv_path, source_url, source_date, observed_at, out, template_path=None):
    out = Path(out)
    if out.exists():
        raise ValueError("Output directory already exists; choose a new path to preserve prior evidence")
    with Path(csv_path).open("rb") as handle:
        raw = handle.read(MAX_BYTES + 1)
    dataset = build_dataset(raw, source_url, source_date, observed_at)
    template = Path(template_path or Path(__file__).with_name("sponsor-dossiers-template.html")).read_text(encoding="utf-8")
    if template.count(PLACEHOLDER) != 1:
        raise ValueError("HTML template must have exactly one dossier-data placeholder")
    rendered = template.replace(PLACEHOLDER, safe_embedded_json(dataset))
    meta = dataset["meta"]
    # Validate everything before creating the output. mkdir must fail on a race.
    out.mkdir(parents=True, exist_ok=False)
    (out / "data.json").write_text(compact_json(dataset) + "\n", encoding="utf-8")
    (out / "index.html").write_text(rendered, encoding="utf-8")
    with (out / "register-entries.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Research key", "Register name", "Register town/city", "Register county", "Route and rating pairs (JSON)", "Source CSV records (JSON)", "Source date", "Business enrichment"])
        for ident, name, city, county, licences, source_rows, _ in dataset["entries"]:
            writer.writerow(map(spreadsheet_cell, [ident, name, city, county, compact_json(licences), compact_json(source_rows), source_date, "Not collected"]))
    (out / "README.md").write_text(
        f"# Sponsor Intel — register research pack\n\n"
        f"Open `index.html` directly in a browser. Search and filters work locally; no server is needed.\n\n"
        f"Source date: **{source_date}**. Actual source observation supplied by the operator: **{observed_at}**.\n"
        f"[Official CSV]({source_url}) · [Publication]({PUBLICATION})\n\n"
        f"- Source records: **{meta['source_rows']:,}**\n"
        f"- Grouped register entries: **{meta['grouped_entries']:,}**\n"
        f"- Distinct normalized names: **{meta['distinct_names']:,}** (not a verified legal-company count)\n"
        f"- Business enrichment: **not collected**; missing fields are not negative findings.\n\n"
        f"Each route remains paired with its source rating. Source CSV record numbers are retained. "
        f"The source digest is `{meta['source_sha256']}`. `receipt.json` hashes the generated files.\n\n"
        f"The compact `data.json` column order is `{compact_json(COLUMNS)}`. Variants retain the "
        f"whitespace-normalized source spellings. Research keys are not production sponsor IDs.\n\n"
        f"`register-entries.csv` prefixes potentially executable spreadsheet values with an apostrophe; "
        f"`data.json` retains their normalized source text.\n\n"
        + "\n".join(f"- {item}" for item in meta["limitations"])
        + f"\n\n{meta['attribution']} [OGL v3.0]({meta['licence_url']}).\n"
        + "\nThis local pack does not publish profiles, renew approvals, fetch websites, create discovery leads, write production data, or submit applications.\n",
        encoding="utf-8",
    )
    files = {}
    for name in ["data.json", "index.html", "register-entries.csv", "README.md"]:
        content = (out / name).read_bytes()
        files[name] = {"bytes": len(content), "sha256": sha256(content)}
    receipt = {
        "schema_version": 1,
        "operation": "offline_register_research_pack",
        "source_date": source_date,
        "observed_at": observed_at,
        "source_url": source_url,
        "source_sha256": meta["source_sha256"],
        "source_rows": meta["source_rows"],
        "grouped_entries": meta["grouped_entries"],
        "distinct_names": meta["distinct_names"],
        "row_reconciliation": "all_source_records_retained",
        "network_requests_by_builder": 0,
        "production_writes": 0,
        "business_enrichment": "not_collected",
        "files": files,
    }
    (out / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", required=True, type=Path)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--source-date", required=True)
    parser.add_argument("--observed-at", required=True)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    try:
        receipt = build_pack(args.csv, args.source_url, args.source_date, args.observed_at, args.out)
    except (ValueError, OSError) as error:
        parser.exit(1, f"No completed pack: {error}\n")
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
