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
from urllib.parse import urlsplit

HEADERS = ["Organisation Name", "Town/City", "County", "Type & Rating", "Route"]
COLUMNS = ["id", "name", "city", "county", "licences", "source_rows", "variants"]
COMPARISON_COLUMNS = ["id", "status", "added_pairs", "removed_pairs", "variants_changed"]
MAX_BYTES = 25_000_000
MAX_ROWS = 500_000
MAX_FIELD = 4_096
PUBLICATION = "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers"
PLACEHOLDER = "__DOSSIER_DATA__"
FORBIDDEN_CONTROLS = re.compile(r"[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]")
MAX_EVIDENCE_BYTES = 2_000_000
MAX_EVIDENCE_SUBJECTS = 500
MAX_EVIDENCE_OBSERVATIONS = 2_000
RELATIONSHIPS = {"trading_name", "website_operator", "operating_organisation", "subsidiary", "group_relationship"}
CLAIM_BOUNDS = {"business_name": (2, 200), "relationship": (1, 40), "website": (1, 1500),
                "activity": (1, 400), "locations": (1, 400), "official_identifier": (1, 150), "careers_url": (1, 1500)}


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
            "retained_evidence_entries": 0,
            "retained_evidence_claims": 0,
            "newly_verified_businesses": 0,
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


def add_register_comparison(dataset, earlier_raw, earlier_source_url, earlier_source_date, earlier_observed_at):
    """Attach exact snapshot differences without assigning a cause or an entity.

    The earlier snapshot is parsed independently. Its source rows are local to
    that file, not stable identifiers. No business evidence is carried across.
    """
    if "comparison" in dataset:
        raise ValueError("This dataset already has a register comparison; build a new edition")
    earlier = build_dataset(earlier_raw, earlier_source_url, earlier_source_date, earlier_observed_at)
    if earlier_source_date >= dataset["meta"]["source_date"]:
        raise ValueError("Earlier source date must be strictly before the current source date")
    before = {row[0]: row for row in earlier["entries"]}
    after = {row[0]: row for row in dataset["entries"]}
    counts = {name: 0 for name in [
        "present_both", "current_only", "earlier_only", "matched_pairs_changed", "matched_variants_changed",
        "changed_matched", "unchanged_matched", "matched_source_row_count_changed", "matched_duplicate_count_changed",
        "matched_pairs_added", "matched_pairs_removed",
    ]}
    rows = []
    for key in sorted(before.keys() | after.keys()):
        old, new = before.get(key), after.get(key)
        old_pairs = set(map(tuple, old[4])) if old else set()
        new_pairs = set(map(tuple, new[4])) if new else set()
        added, removed = sorted(new_pairs - old_pairs), sorted(old_pairs - new_pairs)
        variants_changed = False
        if old is not None and new is not None:
            # A digest collision must fail closed rather than attach another
            # name or location to this research entry, even across snapshots.
            if tuple(value.casefold() for value in old[1:4]) != tuple(value.casefold() for value in new[1:4]):
                raise ValueError("Cross-snapshot register-entry key collision")
            status = "present_both"
            variants_changed = old[6] != new[6]
            pairs_changed = bool(added or removed)
            counts["matched_pairs_changed"] += pairs_changed
            counts["matched_variants_changed"] += variants_changed
            counts["changed_matched" if pairs_changed or variants_changed else "unchanged_matched"] += 1
            counts["matched_source_row_count_changed"] += len(old[5]) != len(new[5])
            counts["matched_duplicate_count_changed"] += (len(old[5]) - len(old_pairs)) != (len(new[5]) - len(new_pairs))
            counts["matched_pairs_added"] += len(added)
            counts["matched_pairs_removed"] += len(removed)
        else:
            status = "current_only" if new is not None else "earlier_only"
        counts[status] += 1
        rows.append([key, status, added, removed, variants_changed])
    counts["union_entries"] = len(rows)
    for prefix, source in [("earlier", earlier), ("current", dataset)]:
        for field in ["source_rows", "grouped_entries", "duplicate_source_rows"]:
            counts[f"{prefix}_{field}"] = source["meta"][field]
    if (counts["present_both"] + counts["current_only"] != len(after)
            or counts["present_both"] + counts["earlier_only"] != len(before)
            or counts["changed_matched"] + counts["unchanged_matched"] != counts["present_both"]):
        raise ValueError("Register comparison reconciliation failed")
    # The full older rows remain separate from the current register and from
    # any exact-current-snapshot retained evidence. Mutate only after validation.
    dataset["comparison"] = {
        "schema_version": 1,
        "match_basis": "normalized_name_city_county_exact",
        "columns": COMPARISON_COLUMNS,
        "earlier": {"meta": earlier["meta"], "entries": earlier["entries"]},
        "current_source_sha256": dataset["meta"]["source_sha256"],
        "counts": counts,
        "entries": rows,
    }


def exact_keys(value, keys, label):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError(f"{label} contains missing or unsupported fields")


def evidence_text(value, minimum, maximum, label):
    if (not isinstance(value, str) or len(value.strip()) < minimum or len(value) > maximum
            or re.search(r"[\x00-\x09\x0b-\x1f\x7f]", value)):
        raise ValueError(f"{label} is missing, too long, or contains control characters")
    return value  # Retained observations are not silently trimmed or rewritten.


def evidence_stamp(value, label):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})", value):
        raise ValueError(f"{label} needs an ISO timestamp with explicit timezone")
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"Invalid {label}") from error


def public_evidence_url(value):
    evidence_text(value, 1, 1500, "Public evidence URL")
    if value != value.strip() or re.search(r"[\s\\]", value):
        raise ValueError("Use a public HTTPS URL without whitespace or backslashes")
    try:
        url = urlsplit(value)
        host = url.hostname or ""
        if (url.scheme != "https" or url.username is not None or url.password is not None or url.port is not None
                or url.query or url.fragment or len(host) > 253
                or not re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", host)
                or re.search(r"(?:^|\.)(?:localhost|local|internal|invalid|test|onion|home|lan)$", host)):
            raise ValueError("Use a public HTTPS URL without credentials, IP addresses, local hosts, query fields or fragments")
    except ValueError as error:
        raise ValueError("Invalid public HTTPS evidence URL") from error
    return value


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON field: {key}")
        result[key] = value
    return result


def add_retained_evidence(dataset, raw, validation_at=None):
    """Validate a bounded historical packet; it supplies no approval authority.

    Receipt hashes are retained declarations, not a fresh read of the original
    source or an independent semantic verification of the supplied summary.
    """
    if "evidence" in dataset:
        raise ValueError("This dataset already has a retained-evidence packet; build a new edition")
    if not raw or len(raw) > MAX_EVIDENCE_BYTES:
        raise ValueError("Evidence packet must contain 1 to 2,000,000 bytes")
    try:
        packet = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object,
                            parse_constant=lambda value: (_ for _ in ()).throw(ValueError("Non-finite JSON value")))
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError) as error:
        raise ValueError("Evidence packet must be valid UTF-8 JSON") from error
    exact_keys(packet, ["schema_version", "kind", "register_sha256", "prepared_at", "observations", "subjects"], "Evidence packet")
    if type(packet["schema_version"]) is not int or packet["schema_version"] != 1 or packet["kind"] != "sponsor_intel_retained_business_evidence":
        raise ValueError("Unsupported retained-evidence schema")
    if packet["register_sha256"] != dataset["meta"]["source_sha256"]:
        raise ValueError("Evidence packet does not match these exact register bytes")
    prepared = evidence_stamp(packet["prepared_at"], "Evidence preparation time")
    # The clock is only a future-date guard; it never becomes a source visit or
    # replaces any retained observation/follow-up date. Tests can pin this clock.
    checked_at = evidence_stamp(validation_at, "Validation time") if validation_at is not None else dt.datetime.now(dt.timezone.utc)
    if prepared > checked_at:
        raise ValueError("Evidence preparation time cannot be in the future")
    observations, subjects = packet["observations"], packet["subjects"]
    if not isinstance(observations, list) or not 1 <= len(observations) <= MAX_EVIDENCE_OBSERVATIONS:
        raise ValueError("Evidence packet requires 1 to 2,000 observations")
    if not isinstance(subjects, list) or not 1 <= len(subjects) <= MAX_EVIDENCE_SUBJECTS:
        raise ValueError("Evidence packet requires 1 to 500 subjects")
    observation_ids, observation_values, retained_observations = set(), set(), []
    observation_keys = ["id", "url", "observed_at", "evidence_kind", "summary", "receipt_reference", "receipt_sha256", "attribution"]
    for observation in observations:
        exact_keys(observation, observation_keys, "Retained observation")
        ident = observation["id"]
        if (not isinstance(ident, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}", ident)
                or ident in {"constructor", "prototype", "__proto__"} or ident in observation_ids):
            raise ValueError("Observation identifiers must be unique bounded public references")
        observation_ids.add(ident)
        public_evidence_url(observation["url"])
        if evidence_stamp(observation["observed_at"], "Source observation time") > prepared:
            raise ValueError("A retained observation cannot be later than packet preparation")
        if observation["evidence_kind"] != "retained_operator_observation":
            raise ValueError("Only retained operator observations are accepted; not fresh primary quotations")
        evidence_text(observation["summary"], 10, 2000, "Retained observation summary")
        evidence_text(observation["attribution"], 1, 300, "Source attribution")
        reference = observation["receipt_reference"]
        if (not isinstance(reference, str) or len(reference) > 300
                or not re.fullmatch(r"(?:docs|cloudflare/tests/evidence)/[A-Za-z0-9_./-]+\.(?:json|md)", reference)
                or any(part in {".", "..", ""} for part in reference.split("/"))):
            raise ValueError("Use a public repository receipt reference, not a local/private path")
        if not isinstance(observation["receipt_sha256"], str) or not re.fullmatch(r"[a-f0-9]{64}", observation["receipt_sha256"]):
            raise ValueError("Receipt SHA-256 must identify the retained receipt bytes")
        signature = compact_json([observation[key] for key in observation_keys if key != "id"])
        if signature in observation_values:
            raise ValueError("Duplicate retained observations must not inflate evidence counts")
        observation_values.add(signature)
        retained_observations.append({key: observation[key] for key in observation_keys})
    register = {entry[0]: entry for entry in dataset["entries"]}
    retained_subjects, used_observations, retained_fields = {}, set(), set()
    claim_count = 0
    subject_keys = ["entry_key", "name", "city", "county", "source_rows", "prior_review_due_at", "claims"]
    for subject in subjects:
        exact_keys(subject, subject_keys, "Evidence subject")
        key = subject["entry_key"]
        if not isinstance(key, str) or key not in register or key in retained_subjects:
            raise ValueError("Evidence subjects must match distinct exact register-entry keys")
        entry = register[key]
        if [subject["name"], subject["city"], subject["county"]] != entry[1:4]:
            raise ValueError("Evidence name/town/county differs from the bound register entry")
        rows = subject["source_rows"]
        if not isinstance(rows, list) or any(type(row) is not int for row in rows) or rows != entry[5]:
            raise ValueError("Evidence source-row references differ from the bound register entry")
        if subject["prior_review_due_at"] is not None:
            evidence_stamp(subject["prior_review_due_at"], "Prior review deadline")
        claims = subject["claims"]
        if not isinstance(claims, list) or not 1 <= len(claims) <= 100:
            raise ValueError("Each subject requires 1 to 100 retained claims")
        retained_claims, seen_claims = [], set()
        for claim in claims:
            exact_keys(claim, ["field", "value", "observation_ids"], "Retained claim")
            field = claim["field"]
            if not isinstance(field, str) or field not in CLAIM_BOUNDS:
                raise ValueError("Unsupported business-identity field")
            value = evidence_text(claim["value"], *CLAIM_BOUNDS[field], "Business claim")
            if field == "relationship" and value not in RELATIONSHIPS:
                raise ValueError("Unsupported business relationship")
            if field in {"website", "careers_url"}:
                public_evidence_url(value)
            signature = (field, value)
            if signature in seen_claims:
                raise ValueError("Duplicate claims must use one claim with its supporting observations")
            seen_claims.add(signature)
            ids = claim["observation_ids"]
            if (not isinstance(ids, list) or not 1 <= len(ids) <= 20 or any(not isinstance(ident, str) for ident in ids)
                    or len(set(ids)) != len(ids) or not set(ids) <= observation_ids):
                raise ValueError("A claim needs distinct references to 1 to 20 retained observations")
            used_observations.update(ids)
            retained_fields.add(field)
            # Competing values deliberately remain separate unresolved claims.
            retained_claims.append({"field": field, "value": value, "observation_ids": list(ids)})
        claim_count += len(retained_claims)
        retained_subjects[key] = {"prior_review_due_at": subject["prior_review_due_at"], "claims": retained_claims,
                                  "review_status": "owner_review_required"}
    if used_observations != observation_ids:
        raise ValueError("Every retained observation must support a claim; remove dangling observations")
    # Mutate only after the entire packet validates, leaving rejected input inert.
    dataset["evidence"] = {"schema_version": 1, "prepared_at": packet["prepared_at"], "packet_sha256": sha256(raw),
                           "observations": retained_observations, "subjects": retained_subjects}
    coverage = dataset["meta"]["coverage"]
    coverage.update(retained_evidence_entries=len(retained_subjects), retained_evidence_claims=claim_count,
                    newly_verified_businesses=0)
    for name, fields in [("business_identity", {"business_name", "relationship", "official_identifier", "activity", "locations"}),
                         ("website", {"website"}), ("careers", {"careers_url"})]:
        if retained_fields & fields:
            coverage[name] = "retained_evidence_requires_review"
    dataset["meta"]["limitations"][5] = "Some entries contain historical operator observations, not newly checked primary evidence or approved business profiles. Uncovered details and all current jobs remain uncollected."
    dataset["meta"]["limitations"].extend([
        "Retained summaries are not verbatim source quotations. Receipt hashes are declarations identifying retained files, not independent validation of their claims.",
        "All imported claims require owner review. Competing values remain unresolved; historical follow-up dates are preserved without renewal. No production state or approval is imported.",
    ])
    return dataset


def safe_embedded_json(dataset):
    # Script contents are parsed as text by HTML before JSON.parse reads them.
    return (compact_json(dataset).replace("&", "\\u0026").replace("<", "\\u003c")
            .replace(">", "\\u003e").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def spreadsheet_cell(value):
    text = str(value)
    # CSV quoting does not stop spreadsheet formula evaluation.
    return "'" + text if text.lstrip().startswith(("=", "+", "-", "@")) else text


def build_pack(csv_path, source_url, source_date, observed_at, out, template_path=None, evidence_path=None,
               earlier_csv_path=None, earlier_source_url=None, earlier_source_date=None, earlier_observed_at=None):
    out = Path(out)
    if out.exists():
        raise ValueError("Output directory already exists; choose a new path to preserve prior evidence")
    earlier_args = [earlier_csv_path, earlier_source_url, earlier_source_date, earlier_observed_at]
    if any(value is not None for value in earlier_args) and not all(value is not None for value in earlier_args):
        raise ValueError("All four earlier snapshot arguments must be supplied together")
    with Path(csv_path).open("rb") as handle:
        raw = handle.read(MAX_BYTES + 1)
    dataset = build_dataset(raw, source_url, source_date, observed_at)
    if evidence_path is not None:
        with Path(evidence_path).open("rb") as handle:
            add_retained_evidence(dataset, handle.read(MAX_EVIDENCE_BYTES + 1))
    if earlier_csv_path is not None:
        with Path(earlier_csv_path).open("rb") as handle:
            add_register_comparison(dataset, handle.read(MAX_BYTES + 1), earlier_source_url, earlier_source_date, earlier_observed_at)
    template = Path(template_path or Path(__file__).with_name("sponsor-dossiers-template.html")).read_text(encoding="utf-8")
    if template.count(PLACEHOLDER) != 1:
        raise ValueError("HTML template must have exactly one dossier-data placeholder")
    rendered = template.replace(PLACEHOLDER, safe_embedded_json(dataset))
    meta = dataset["meta"]
    retained = dataset.get("evidence", {})
    comparison = dataset.get("comparison")
    coverage = meta["coverage"]
    enriched = coverage["retained_evidence_entries"] > 0
    enrichment_status = "retained_evidence_requires_review" if enriched else "not_collected"
    enrichment_note = (f"**{coverage['retained_evidence_entries']:,} entries / {coverage['retained_evidence_claims']:,} retained candidate claims**; "
                       "all require owner review, with **zero newly verified businesses**. Current jobs remain uncollected."
                       if enriched else "**not collected**; missing fields are not negative findings.")
    # Validate everything before creating the output. mkdir must fail on a race.
    out.mkdir(parents=True, exist_ok=False)
    (out / "data.json").write_text(compact_json(dataset) + "\n", encoding="utf-8")
    (out / "index.html").write_text(rendered, encoding="utf-8")
    with (out / "register-entries.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Research key", "Register name", "Register town/city", "Register county", "Route and rating pairs (JSON)", "Source CSV records (JSON)", "Source date", "Business enrichment", "Retained candidate claims (JSON)", "Prior review due", "Evidence packet SHA-256"])
        for ident, name, city, county, licences, source_rows, _ in dataset["entries"]:
            subject = retained.get("subjects", {}).get(ident)
            status = f"Retained candidate evidence; owner review required ({len(subject['claims'])} claims)" if subject else "Not collected"
            writer.writerow(map(spreadsheet_cell, [ident, name, city, county, compact_json(licences), compact_json(source_rows), source_date, status,
                                                   compact_json(subject["claims"]) if subject else "", subject["prior_review_due_at"] or "" if subject else "",
                                                   retained["packet_sha256"] if subject else ""]))
    if comparison:
        previous = {row[0]: row for row in comparison["earlier"]["entries"]}
        current = {row[0]: row for row in dataset["entries"]}
        with (out / "register-comparison.csv").open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["Research key", "Snapshot presence", "Earlier register name", "Earlier town/city", "Earlier county",
                             "Current register name", "Current town/city", "Current county", "Route/rating pairs only in later supplied record (JSON)",
                             "Route/rating pairs only in earlier supplied record (JSON)", "Recorded spelling variants changed", "Earlier source CSV records (JSON)",
                             "Current source CSV records (JSON)", "Earlier route/rating pairs (JSON)", "Current route/rating pairs (JSON)",
                             "Earlier spelling variants (JSON)", "Current spelling variants (JSON)", "Earlier duplicate records",
                             "Current duplicate records", "Earlier source date", "Current source date", "Earlier source SHA-256", "Current source SHA-256"])
            for ident, status, added, removed, variants_changed in comparison["entries"]:
                old, new = previous.get(ident), current.get(ident)
                writer.writerow(map(spreadsheet_cell, [ident, status, *(old[1:4] if old else ["", "", ""]),
                    *(new[1:4] if new else ["", "", ""]), compact_json(added), compact_json(removed),
                    "yes" if variants_changed else "no", compact_json(old[5]) if old else "", compact_json(new[5]) if new else "",
                    compact_json(old[4]) if old else "", compact_json(new[4]) if new else "",
                    compact_json(old[6]) if old else "", compact_json(new[6]) if new else "",
                    len(old[5]) - len(old[4]) if old else "", len(new[5]) - len(new[4]) if new else "",
                    earlier_source_date, source_date, comparison["earlier"]["meta"]["source_sha256"], meta["source_sha256"]]))
    comparison_note = ""
    if comparison:
        older, counts = comparison["earlier"]["meta"], comparison["counts"]
        comparison_note = (
            f"## Supplied register snapshot comparison\n\n"
            f"Earlier source date: **{older['source_date']}**; actual supplied observation: **{older['observed_at']}**. "
            f"[Earlier official CSV]({older['source_url']}); SHA-256 `{older['source_sha256']}`. "
            f"Later source date: **{source_date}**; SHA-256 `{meta['source_sha256']}`.\n\n"
            f"- Present in both supplied snapshots: **{counts['present_both']:,}**\n"
            f"- Only in the later snapshot: **{counts['current_only']:,}**\n"
            f"- Only in the earlier snapshot: **{counts['earlier_only']:,}**\n"
            f"- Matched entries with changed route/rating pairs or recorded spelling variants: **{counts['changed_matched']:,}**\n"
            f"- Matched entries with unchanged pairs and variants: **{counts['unchanged_matched']:,}**\n"
            f"- Matched source-record count differences: **{counts['matched_source_row_count_changed']:,}**; "
            f"duplicate-record count differences: **{counts['matched_duplicate_count_changed']:,}** (overlapping recording differences, not additional primary changes)\n\n"
            "Matching uses the exact existing whitespace-normalized, casefolded name/town/county tuple. "
            "Changed names or locations remain separate unmatched entries; there is no fuzzy remapping. "
            "Route and rating remain paired. Source-row numbers and row order are local to each file; "
            "row-order or duplicate-count differences alone do not mark an entry as changed. "
            "Spelling-variant changes are recorded text differences, not proof of a different organisation. "
            "Presence or absence between these two snapshots does not establish the reason, a licence grant/revocation, "
            "business opening/closure, current licence status, or current job sponsorship. No business evidence or approval is inherited from the earlier snapshot.\n\n"
            f"`comparison.entries` uses `{compact_json(COMPARISON_COLUMNS)}`. Each union key has one comparison row; "
            "one-sided rows include their complete added/removed pair set and have `variants_changed: false`. "
            "`comparison.earlier.entries` retains every earlier seven-column row, including earlier-only entries; "
            "these are not added to the current register totals. `register-comparison.csv` exports both sides with safe spreadsheet cells. "
            "Full source metadata and hashes remain in `data.json`.\n\n"
        )
    (out / "README.md").write_text(
        f"# Sponsor Intel — register research pack\n\n"
        f"Open `index.html` directly in a browser. Search and filters work locally; no server is needed.\n\n"
        f"Source date: **{source_date}**. Actual source observation supplied by the operator: **{observed_at}**.\n"
        f"[Official CSV]({source_url}) · [Publication]({PUBLICATION})\n\n"
        f"- Source records: **{meta['source_rows']:,}**\n"
        f"- Grouped register entries: **{meta['grouped_entries']:,}**\n"
        f"- Distinct normalized names: **{meta['distinct_names']:,}** (not a verified legal-company count)\n"
        f"- Business enrichment: {enrichment_note}\n\n"
        f"Each route remains paired with its source rating. Source CSV record numbers are retained. "
        f"The source digest is `{meta['source_sha256']}`. `receipt.json` hashes the generated files.\n\n"
        f"The compact `data.json` column order is `{compact_json(COLUMNS)}`. Variants retain the "
        f"whitespace-normalized source spellings. Research keys are not production sponsor IDs.\n\n"
        f"`register-entries.csv` prefixes potentially executable spreadsheet values with an apostrophe; "
        f"`data.json` retains their normalized register text and literal retained-claim text. "
        f"Candidate CSV fields do not imply approval.\n\n"
        + (f"Retained-evidence packet prepared **{retained['prepared_at']}**, SHA-256 `{retained['packet_sha256']}`. "
           "Historical source observations, supporting receipt declarations and prior follow-up dates remain unchanged. "
           "Summaries are retained operator observations, not newly checked sources or verbatim quotations. "
           "Competing claims are unresolved; no current company/job verification or production approval is imported.\n\n" if enriched else "")
        + comparison_note
        + "\n".join(f"- {item}" for item in meta["limitations"])
        + f"\n\n{meta['attribution']} [OGL v3.0]({meta['licence_url']}).\n"
        + "\nThis local pack does not publish profiles, renew approvals, fetch websites, create discovery leads, write production data, or submit applications.\n",
        encoding="utf-8",
    )
    files = {}
    for name in ["data.json", "index.html", "register-entries.csv", "README.md"] + (["register-comparison.csv"] if comparison else []):
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
        "business_enrichment": enrichment_status,
        "retained_evidence_entries": coverage["retained_evidence_entries"],
        "retained_evidence_claims": coverage["retained_evidence_claims"],
        "retained_evidence_observations": len(retained.get("observations", [])),
        "newly_verified_businesses": 0,
        "evidence_packet_sha256": retained.get("packet_sha256"),
        "files": files,
    }
    if comparison:
        receipt["comparison"] = {
            "schema_version": 1, "match_basis": comparison["match_basis"],
            "earlier_source_url": earlier_source_url, "earlier_source_date": earlier_source_date,
            "earlier_observed_at": earlier_observed_at, "earlier_source_sha256": comparison["earlier"]["meta"]["source_sha256"],
            "current_source_sha256": meta["source_sha256"], "counts": comparison["counts"],
            "row_reconciliation": "all_records_retained_in_each_snapshot",
            "business_evidence_carried_forward": 0,
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
    parser.add_argument("--evidence", type=Path, help="Optional bounded retained-observation JSON; never imports approval")
    parser.add_argument("--earlier-csv", type=Path, help="Optional earlier local register CSV; requires its three provenance arguments")
    parser.add_argument("--earlier-source-url")
    parser.add_argument("--earlier-source-date")
    parser.add_argument("--earlier-observed-at")
    args = parser.parse_args()
    try:
        receipt = build_pack(args.csv, args.source_url, args.source_date, args.observed_at, args.out, evidence_path=args.evidence,
                             earlier_csv_path=args.earlier_csv, earlier_source_url=args.earlier_source_url,
                             earlier_source_date=args.earlier_source_date, earlier_observed_at=args.earlier_observed_at)
    except (ValueError, OSError) as error:
        parser.exit(1, f"No completed pack: {error}\n")
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
