"""Fictional-data tests for the offline register research-pack boundary."""

import csv
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import copy
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build-sponsor-dossiers.py"
SPEC = importlib.util.spec_from_file_location("sponsor_dossiers", SCRIPT)
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)
URL = "https://assets.publishing.service.gov.uk/media/fictional/Worker_2026-11-11.csv"
DAY = "2026-11-11"
OBSERVED = "2026-11-11T12:00:00Z"
TEMPLATE = '<!doctype html><script type="application/json" id="data">__DOSSIER_DATA__</script>'


def csv_bytes(rows, headers=None):
    text = io.StringIO(newline="")
    writer = csv.writer(text)
    writer.writerow(builder.HEADERS if headers is None else headers)
    writer.writerows(rows)
    return text.getvalue().encode("utf-8")


def data(rows):
    return builder.build_dataset(csv_bytes(rows), URL, DAY, OBSERVED)


def evidence_packet(dataset):
    row = dataset["entries"][0]
    return {
        "schema_version": 1, "kind": "sponsor_intel_retained_business_evidence",
        "register_sha256": dataset["meta"]["source_sha256"], "prepared_at": "2026-11-11T16:00:00Z",
        "observations": [{"id": "fictional_source", "url": "https://example.org/legal",
                          "observed_at": "2026-10-30T12:00:00.000Z", "evidence_kind": "retained_operator_observation",
                          "summary": "A retained fictional legal notice identifies the trading name.",
                          "receipt_reference": "cloudflare/tests/evidence/fictional.json", "receipt_sha256": "a" * 64,
                          "attribution": "Fictional organisation; agent-assisted retained observation."}],
        "subjects": [{"entry_key": row[0], "name": row[1], "city": row[2], "county": row[3], "source_rows": row[5],
                      "prior_review_due_at": "2026-10-27T12:00:00.000Z",
                      "claims": [{"field": "business_name", "value": "Fictional Trading Name", "observation_ids": ["fictional_source"]},
                                 {"field": "relationship", "value": "trading_name", "observation_ids": ["fictional_source"]},
                                 {"field": "website", "value": "https://example.org/", "observation_ids": ["fictional_source"]}]}],
    }


def packet_bytes(packet):
    return json.dumps(packet, ensure_ascii=False, indent=2).encode("utf-8")


class RegisterDossiersTests(unittest.TestCase):
    def test_grouping_preserves_pairs_variants_and_every_source_record(self):
        result = data([
            ["Example Co", "Cardiff", "", "Worker (A rating)", "Skilled Worker"],
            ["EXAMPLE CO", "  Cardiff ", "", "Temporary Worker (A rating)", "Creative Worker"],
            ["Example Co", "Cardiff", "", "Worker (A rating)", "Skilled Worker"],
            ["Example Co", "Leeds", "", "Worker (A rating)", "Skilled Worker"],
        ])
        self.assertEqual(result["meta"]["source_rows"], 4)
        self.assertEqual(result["meta"]["grouped_entries"], 2)
        self.assertEqual(result["meta"]["distinct_names"], 1)
        self.assertEqual(result["meta"]["duplicate_source_rows"], 1)
        cardiff = next(row for row in result["entries"] if row[2] == "Cardiff")
        self.assertEqual(cardiff[4], [("Creative Worker", "Temporary Worker (A rating)"), ("Skilled Worker", "Worker (A rating)")])
        self.assertEqual(cardiff[5], [2, 3, 4])
        self.assertEqual(len(cardiff[6]), 2)
        self.assertEqual(sum(len(row[5]) for row in result["entries"]), 4)
        self.assertEqual(result["meta"]["routes"], [{"name": "Skilled Worker", "entries": 2}, {"name": "Creative Worker", "entries": 1}])

    def test_csv_quoted_commas_unicode_and_multiline(self):
        result = data([["Fictional, Café\nGroup", "", "County", "Worker (A rating)", "Skilled Worker"]])
        row = result["entries"][0]
        self.assertEqual(row[1], "Fictional, Café Group")
        self.assertEqual(row[5], [2])
        self.assertEqual(result["meta"]["blank_town_entries"], 1)
        self.assertEqual(result["meta"]["cities"], [])

    def test_tuple_keys_do_not_confuse_delimiters_and_are_order_stable(self):
        rows = [["A|B", "C", "", "A", "Skilled Worker"], ["A", "B|C", "", "A", "Skilled Worker"]]
        first, second = data(rows), data(list(reversed(rows)))
        self.assertEqual(first["meta"]["grouped_entries"], 2)
        self.assertEqual([row[0] for row in first["entries"]], [row[0] for row in second["entries"]])
        self.assertNotEqual(first["entries"][0][0], first["entries"][1][0])
        self.assertTrue(all(len(row[0]) == 64 for row in first["entries"]))

    def test_missing_enrichment_is_not_invented(self):
        result = data([["Looks Like A Website Ltd", "London", "", "A", "Skilled Worker"]])
        self.assertEqual(result["meta"]["coverage"]["business_identity"], "not_collected")
        self.assertTrue(all(result["meta"]["coverage"][key] == "not_collected" for key in ["website", "careers", "jobs"]))
        self.assertEqual(len(result["entries"][0]), 7)
        self.assertFalse(any("https://" in str(field) for field in result["entries"][0]))

    def test_headers_are_exact_and_not_duplicated_or_reordered(self):
        rows = [["Example", "", "", "A", "Skilled Worker"]]
        for headers in [builder.HEADERS[:-1], [*builder.HEADERS, "Extra"], [*builder.HEADERS[:-1], "Route "], list(reversed(builder.HEADERS)), ["Organisation Name"] * 5]:
            with self.subTest(headers=headers), self.assertRaises(ValueError):
                builder.build_dataset(csv_bytes(rows, headers), URL, DAY, OBSERVED)

    def test_malformed_or_empty_records_and_controls_rejected(self):
        cases = [[], [["Example", "", "", "A"]], [["Example", "", "", "A", "Skilled Worker", "extra"]], [["", "", "", "A", "Skilled Worker"]], [["Example", "", "", "", "Skilled Worker"]], [["Example", "", "", "A", ""]], [["Bad\x00Name", "", "", "A", "Skilled Worker"]], [[]]]
        for rows in cases:
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                data(rows)
        broken = csv_bytes([]) + b'"Unfinished,,,A,Skilled Worker\n'
        with self.assertRaises(ValueError):
            builder.build_dataset(broken, URL, DAY, OBSERVED)
        with self.assertRaises(ValueError):
            builder.build_dataset(b"\xff", URL, DAY, OBSERVED)

    def test_source_byte_row_and_field_bounds(self):
        raw = csv_bytes([["Example", "", "", "A", "Skilled Worker"]])
        with patch.object(builder, "MAX_BYTES", len(raw) - 1), self.assertRaises(ValueError):
            builder.build_dataset(raw, URL, DAY, OBSERVED)
        with patch.object(builder, "MAX_ROWS", 1), self.assertRaises(ValueError):
            data([["A", "", "", "A", "Skilled Worker"], ["B", "", "", "A", "Skilled Worker"]])
        with patch.object(builder, "MAX_FIELD", 3), self.assertRaises(ValueError):
            data([["Long name", "", "", "A", "Skilled Worker"]])

    def test_provenance_dates_and_official_host_enforced(self):
        bad = [
            (URL, "2026-02-30", OBSERVED),
            (URL, "2026-11-12", OBSERVED),
            (URL, DAY, "2026-11-11T12:00:00"),
            (URL, DAY, "2026-11-11T25:00:00Z"),
            (URL, DAY, "2026-11-11T00:30:00+01:00"),
            (URL.replace("2026-11-11", "2026-11-10"), DAY, OBSERVED),
            ("https://assets.publishing.service.gov.uk.evil.example/file.csv", DAY, OBSERVED),
            ("http://assets.publishing.service.gov.uk/file.csv", DAY, OBSERVED),
            ("https://user@assets.publishing.service.gov.uk/file.csv", DAY, OBSERVED),
        ]
        for args in bad:
            with self.subTest(args=args), self.assertRaises(ValueError):
                builder.validate_provenance(*args)
        builder.validate_provenance(URL, DAY, "2026-11-11T13:00:00+01:00")

    def test_embedded_json_cannot_close_html_script(self):
        result = data([["</script><img src=x onerror=alert(1)>&\u2028", "", "", "A", "Skilled Worker"]])
        embedded = builder.safe_embedded_json(result)
        self.assertNotIn("<", embedded)
        self.assertNotIn(">", embedded)
        self.assertNotIn("&", embedded)
        self.assertEqual(json.loads(embedded)["entries"][0][1], result["entries"][0][1])
        self.assertNotIn("\u2028", embedded)

    def test_spreadsheet_fields_neutralize_formula_prefixes(self):
        for value in ["=HYPERLINK(\"bad\")", "+1", "-1", "@SUM(A1)", "  =1", "\t=1"]:
            with self.subTest(value=value):
                self.assertEqual(builder.spreadsheet_cell(value), "'" + value)
        self.assertEqual(builder.spreadsheet_cell("Ordinary Ltd"), "Ordinary Ltd")

    def test_pack_hashes_exports_and_refuses_replay(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            csv_path, template, out = root / "source.csv", root / "template.html", root / "pack"
            raw = csv_bytes([["=TEST", "Cardiff", "", "A", "Skilled Worker"]])
            csv_path.write_bytes(raw)
            template.write_text(TEMPLATE, encoding="utf-8")
            receipt = builder.build_pack(csv_path, URL, DAY, OBSERVED, out, template)
            self.assertEqual(receipt["network_requests_by_builder"], 0)
            self.assertEqual(receipt["production_writes"], 0)
            self.assertEqual(receipt["source_sha256"], hashlib.sha256(raw).hexdigest())
            for name, file in receipt["files"].items():
                content = (out / name).read_bytes()
                self.assertEqual(file["bytes"], len(content))
                self.assertEqual(file["sha256"], hashlib.sha256(content).hexdigest())
            exported = list(csv.reader(io.StringIO((out / "register-entries.csv").read_text())))
            self.assertEqual(exported[1][1], "'=TEST")
            self.assertEqual(json.loads((out / "data.json").read_text())["entries"][0][1], "=TEST")
            self.assertNotIn(builder.PLACEHOLDER, (out / "index.html").read_text())
            before = (out / "receipt.json").read_bytes()
            with self.assertRaises(ValueError):
                builder.build_pack(csv_path, URL, DAY, OBSERVED, out, template)
            self.assertEqual((out / "receipt.json").read_bytes(), before)

    def test_invalid_template_does_not_create_partial_output(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source, template, out = root / "source.csv", root / "template.html", root / "pack"
            source.write_bytes(csv_bytes([["Example", "", "", "A", "Skilled Worker"]]))
            for invalid in ["no placeholder", builder.PLACEHOLDER * 2]:
                template.write_text(invalid, encoding="utf-8")
                with self.assertRaises(ValueError):
                    builder.build_pack(source, URL, DAY, OBSERVED, out, template)
                self.assertFalse(out.exists())


class RetainedEvidenceTests(unittest.TestCase):
    def baseline(self):
        return data([["Fictional Limited", "Cardiff", "", "A", "Skilled Worker"]])

    def test_retained_evidence_is_bound_historical_and_never_approved(self):
        result = self.baseline()
        entries = copy.deepcopy(result["entries"])
        packet = evidence_packet(result)
        raw = packet_bytes(packet)
        builder.add_retained_evidence(result, raw)
        self.assertEqual(result["entries"], entries)
        self.assertEqual(result["columns"], builder.COLUMNS)
        self.assertEqual(result["schema_version"], 1)
        self.assertEqual(result["evidence"]["packet_sha256"], hashlib.sha256(raw).hexdigest())
        retained = result["evidence"]["subjects"][entries[0][0]]
        self.assertEqual(retained["review_status"], "owner_review_required")
        self.assertEqual(retained["prior_review_due_at"], "2026-10-27T12:00:00.000Z")
        self.assertLess(retained["prior_review_due_at"], packet["observations"][0]["observed_at"])
        self.assertEqual(result["evidence"]["observations"], packet["observations"])
        coverage = result["meta"]["coverage"]
        self.assertEqual(coverage["retained_evidence_entries"], 1)
        self.assertEqual(coverage["retained_evidence_claims"], 3)
        self.assertEqual(coverage["newly_verified_businesses"], 0)
        self.assertEqual(coverage["website"], "retained_evidence_requires_review")
        self.assertEqual(coverage["careers"], "not_collected")
        self.assertEqual(coverage["jobs"], "not_collected")
        with self.assertRaises(ValueError):
            builder.add_retained_evidence(result, raw)

    def test_mismatched_snapshot_subject_or_row_refs_leave_dataset_unchanged(self):
        mutations = [
            lambda p: p.update(register_sha256="b" * 64),
            lambda p: p["subjects"][0].update(entry_key="b" * 64),
            lambda p: p["subjects"][0].update(name="fictional limited"),
            lambda p: p["subjects"][0].update(city="London"),
            lambda p: p["subjects"][0].update(county="Elsewhere"),
            lambda p: p["subjects"][0].update(source_rows=[3]),
            lambda p: p["subjects"][0].update(source_rows=[2.0]),
            lambda p: p["subjects"][0].update(source_rows=[True]),
            lambda p: p["subjects"][0].update(source_rows=[2, 2]),
        ]
        for mutate in mutations:
            result = self.baseline(); before = copy.deepcopy(result); packet = evidence_packet(result)
            mutate(packet)
            with self.assertRaises(ValueError):
                builder.add_retained_evidence(result, packet_bytes(packet))
            self.assertEqual(result, before)

    def test_production_identity_and_approval_fields_are_rejected_at_every_level(self):
        for target in ["packet", "observation", "subject", "claim"]:
            for forbidden in ["state", "approval", "actor", "production_id", "request_key", "revision"]:
                result = self.baseline(); packet = evidence_packet(result)
                obj = {"packet": packet, "observation": packet["observations"][0], "subject": packet["subjects"][0], "claim": packet["subjects"][0]["claims"][0]}[target]
                obj[forbidden] = "approved"
                with self.subTest(target=target, forbidden=forbidden), self.assertRaises(ValueError):
                    builder.add_retained_evidence(result, packet_bytes(packet))

    def test_duplicate_json_and_records_cannot_inflate_counts(self):
        result = self.baseline(); packet = evidence_packet(result)
        duplicate_key = packet_bytes(packet).decode().replace('"schema_version": 1', '"schema_version": 1, "schema_version": 1', 1)
        with self.assertRaises(ValueError):
            builder.add_retained_evidence(result, duplicate_key.encode())
        nested_duplicate = packet_bytes(packet).decode().replace('"value": "Fictional Trading Name"', '"value": "Fictional Trading Name", "value": "Hidden replacement"', 1)
        with self.assertRaises(ValueError):
            builder.add_retained_evidence(result, nested_duplicate.encode())
        for target in ["subject", "observation", "same_observation_new_id", "claim", "reference"]:
            result = self.baseline(); packet = evidence_packet(result)
            if target == "subject": packet["subjects"].append(copy.deepcopy(packet["subjects"][0]))
            if target == "observation": packet["observations"].append(copy.deepcopy(packet["observations"][0]))
            if target == "same_observation_new_id":
                other = copy.deepcopy(packet["observations"][0]); other["id"] = "second_id"; packet["observations"].append(other)
            if target == "claim": packet["subjects"][0]["claims"].append(copy.deepcopy(packet["subjects"][0]["claims"][0]))
            if target == "reference": packet["subjects"][0]["claims"][0]["observation_ids"] *= 2
            with self.subTest(target=target), self.assertRaises(ValueError):
                builder.add_retained_evidence(result, packet_bytes(packet))

    def test_dangling_or_fresh_primary_sources_are_rejected(self):
        mutations = [
            lambda p: p["subjects"][0]["claims"][0].update(observation_ids=["missing"]),
            lambda p: p["observations"][0].update(evidence_kind="primary_source_quote"),
            lambda p: p["observations"].append({**p["observations"][0], "id": "unused", "summary": "Another retained observation that no claim references."}),
        ]
        for mutate in mutations:
            result = self.baseline(); packet = evidence_packet(result); mutate(packet)
            with self.assertRaises(ValueError):
                builder.add_retained_evidence(result, packet_bytes(packet))

    def test_competing_values_are_retained_without_selecting_a_winner(self):
        result = self.baseline(); packet = evidence_packet(result)
        claims = packet["subjects"][0]["claims"]
        claims.extend([{"field": "official_identifier", "value": "Company 11111111", "observation_ids": ["fictional_source"]},
                       {"field": "official_identifier", "value": "Company 22222222", "observation_ids": ["fictional_source"]}])
        builder.add_retained_evidence(result, packet_bytes(packet))
        retained = result["evidence"]["subjects"][result["entries"][0][0]]
        self.assertEqual(retained["claims"], claims)
        self.assertEqual(retained["review_status"], "owner_review_required")
        self.assertEqual(result["meta"]["coverage"]["retained_evidence_claims"], 5)
        self.assertNotIn("selected", retained)

    def test_public_urls_exclude_credentials_private_targets_and_tokens(self):
        urls = ["http://example.org", "https://user:secret@example.org/", "https://127.0.0.1/", "https://[::1]/", "https://10.0.0.1/", "https://localhost/", "https://example.local/", "https://service.internal/", "file:///tmp/secret", "https://example.org:443/", "https://example.org/?token=secret", "https://example.org/?ref=anything", "https://example.org/#secret", "https://example.org/\\evil", "https://example.org/\nsecret", "https://example.org/ "]
        for url in urls:
            for target in ["observation", "website"]:
                result = self.baseline(); packet = evidence_packet(result)
                if target == "observation": packet["observations"][0]["url"] = url
                else: packet["subjects"][0]["claims"][2]["value"] = url
                with self.subTest(url=url, target=target), self.assertRaises(ValueError):
                    builder.add_retained_evidence(result, packet_bytes(packet))

    def test_dates_receipt_paths_hashes_and_field_bounds_are_strict(self):
        mutations = [
            lambda p: p.update(prepared_at="2026-11-11"),
            lambda p: p["observations"][0].update(observed_at="2026-11-12T00:00:00Z"),
            lambda p: p["observations"][0].update(observed_at="2026-02-30T00:00:00Z"),
            lambda p: p["subjects"][0].update(prior_review_due_at="2026-11-11T00:00:00"),
            lambda p: p["observations"][0].update(receipt_reference="/Users/private/file.json"),
            lambda p: p["observations"][0].update(receipt_reference="docs/../private.json"),
            lambda p: p["observations"][0].update(receipt_sha256="not-a-digest"),
            lambda p: p["observations"][0].update(summary="x" * 2001),
            lambda p: p["subjects"][0]["claims"][0].update(value="x" * 201),
            lambda p: p["subjects"][0]["claims"][1].update(value="parent_company"),
            lambda p: p["subjects"][0]["claims"][0].update(field="sponsorship_offer"),
            lambda p: p["subjects"][0]["claims"][0].update(value="Bad\x00Name"),
        ]
        for mutate in mutations:
            result = self.baseline(); packet = evidence_packet(result); mutate(packet)
            with self.assertRaises(ValueError):
                builder.add_retained_evidence(result, packet_bytes(packet))

    def test_packet_size_collection_limits_and_schema_types(self):
        result = self.baseline(); packet = evidence_packet(result); raw = packet_bytes(packet)
        with patch.object(builder, "MAX_EVIDENCE_BYTES", len(raw) - 1), self.assertRaises(ValueError):
            builder.add_retained_evidence(result, raw)
        for key, limit in [("subjects", 500), ("observations", 2000)]:
            invalid = copy.deepcopy(packet); invalid[key] = invalid[key] * (limit + 1)
            with self.assertRaises(ValueError):
                builder.add_retained_evidence(result, packet_bytes(invalid))
        packet["subjects"][0]["claims"] *= 34
        with self.assertRaisesRegex(ValueError, "1 to 100"):
            builder.add_retained_evidence(result, packet_bytes(packet))
        packet = evidence_packet(result); packet["schema_version"] = True
        with self.assertRaises(ValueError):
            builder.add_retained_evidence(result, packet_bytes(packet))

    def test_future_preparation_is_rejected_without_rewriting_old_observations(self):
        result = self.baseline(); packet = evidence_packet(result)
        with self.assertRaisesRegex(ValueError, "cannot be in the future"):
            builder.add_retained_evidence(result, packet_bytes(packet), validation_at="2026-11-11T15:59:59Z")
        self.assertNotIn("evidence", result)
        builder.add_retained_evidence(result, packet_bytes(packet), validation_at="2026-11-11T16:00:00Z")
        self.assertEqual(result["evidence"]["prepared_at"], "2026-11-11T16:00:00Z")
        self.assertEqual(result["evidence"]["observations"][0]["observed_at"], "2026-10-30T12:00:00.000Z")

    def test_literal_candidate_text_is_safe_in_html_and_in_export(self):
        result = self.baseline(); packet = evidence_packet(result)
        value = '  </script><img src=x onerror="alert(1)">  '
        packet["subjects"][0]["claims"][0]["value"] = value
        builder.add_retained_evidence(result, packet_bytes(packet))
        self.assertEqual(result["evidence"]["subjects"][result["entries"][0][0]]["claims"][0]["value"], value)
        embedded = builder.safe_embedded_json(result)
        self.assertNotIn("<", embedded)
        self.assertEqual(json.loads(embedded)["evidence"]["observations"], packet["observations"])

    def test_pack_reports_candidates_and_keeps_invalid_packets_from_creating_output(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); source = root / "source.csv"; template = root / "template.html"; evidence = root / "evidence.json"
            source.write_bytes(csv_bytes([["Fictional Limited", "Cardiff", "", "A", "Skilled Worker"]]))
            template.write_text(TEMPLATE, encoding="utf-8")
            packet = evidence_packet(self.baseline()); evidence.write_bytes(packet_bytes(packet))
            receipt = builder.build_pack(source, URL, DAY, OBSERVED, root / "valid", template, evidence)
            self.assertEqual(receipt["business_enrichment"], "retained_evidence_requires_review")
            self.assertEqual(receipt["retained_evidence_claims"], 3)
            self.assertEqual(receipt["retained_evidence_observations"], 1)
            self.assertEqual(receipt["newly_verified_businesses"], 0)
            rows = list(csv.reader(io.StringIO((root / "valid/register-entries.csv").read_text())))
            self.assertIn("owner review required", rows[1][7])
            self.assertEqual(json.loads(rows[1][8]), packet["subjects"][0]["claims"])
            self.assertEqual(rows[1][9], packet["subjects"][0]["prior_review_due_at"])
            self.assertIn("zero newly verified businesses", (root / "valid/README.md").read_text())
            packet["register_sha256"] = "b" * 64; evidence.write_bytes(packet_bytes(packet))
            with self.assertRaises(ValueError):
                builder.build_pack(source, URL, DAY, OBSERVED, root / "invalid", template, evidence)
            self.assertFalse((root / "invalid").exists())


if __name__ == "__main__":
    unittest.main()
