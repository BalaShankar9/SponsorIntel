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
EARLIER_URL = "https://assets.publishing.service.gov.uk/media/fictional/Worker_2026-10-02.csv"
EARLIER_DAY = "2026-10-02"
EARLIER_OBSERVED = "2026-10-04T07:58:43.247144+00:00"
TEMPLATE = '<!doctype html><script type="application/json" id="data">__DOSSIER_DATA__</script>'


def csv_bytes(rows, headers=None):
    text = io.StringIO(newline="")
    writer = csv.writer(text)
    writer.writerow(builder.HEADERS if headers is None else headers)
    writer.writerows(rows)
    return text.getvalue().encode("utf-8")


def data(rows):
    return builder.build_dataset(csv_bytes(rows), URL, DAY, OBSERVED)


def compared(earlier_rows, current_rows):
    result = data(current_rows)
    builder.add_register_comparison(result, csv_bytes(earlier_rows), EARLIER_URL, EARLIER_DAY, EARLIER_OBSERVED)
    return result


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


def review_packet(dataset):
    packet = evidence_packet(dataset)
    packet["schema_version"] = 2
    packet["observations"][0].update(evidence_kind="retained_operator_review", observed_at=None, reviewed_on="2026-10-08")
    return packet


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


class RegisterComparisonTests(unittest.TestCase):
    def test_complete_union_preserves_earlier_only_records_without_changing_current(self):
        old = [["Both", "Cardiff", "", "A", "Skilled Worker"], ["Earlier only", "Leeds", "County", "A", "Creative Worker"]]
        new = [["Both", "Cardiff", "", "A", "Skilled Worker"], ["Later only", "Bath", "", "B", "Skilled Worker"]]
        baseline = data(new)
        result = compared(old, new)
        comparison = result.pop("comparison")
        self.assertEqual(result, baseline)
        self.assertEqual(result["columns"], builder.COLUMNS)
        self.assertTrue(all(len(row) == 7 for row in result["entries"]))
        self.assertEqual(comparison["columns"], ["id", "status", "added_pairs", "removed_pairs", "variants_changed"])
        self.assertEqual(comparison["match_basis"], "normalized_name_city_county_exact")
        self.assertEqual(comparison["current_source_sha256"], hashlib.sha256(csv_bytes(new)).hexdigest())
        earlier = comparison["earlier"]
        self.assertEqual(earlier["meta"]["source_sha256"], hashlib.sha256(csv_bytes(old)).hexdigest())
        self.assertEqual(earlier["meta"]["observed_at"], EARLIER_OBSERVED)
        self.assertEqual(sum(len(row[5]) for row in earlier["entries"]), len(old))
        self.assertEqual(len(comparison["entries"]), 3)
        self.assertEqual([row[0] for row in comparison["entries"]], sorted(row[0] for row in comparison["entries"]))
        counts = comparison["counts"]
        for field in ["present_both", "earlier_only", "current_only", "unchanged_matched"]:
            self.assertEqual(counts[field], 1)
        self.assertEqual(counts["changed_matched"], 0)
        for row in comparison["entries"]:
            if row[1] == "earlier_only":
                self.assertEqual(row[2:], [[], [("Creative Worker", "A")], False])
            elif row[1] == "current_only":
                self.assertEqual(row[2:], [[("Skilled Worker", "B")], [], False])

    def test_pair_differences_do_not_cross_routes_and_ratings(self):
        old = [["Pair Co", "", "", "A", "Route One"], ["Pair Co", "", "", "B", "Route Two"]]
        new = [["Pair Co", "", "", "B", "Route One"], ["Pair Co", "", "", "A", "Route Two"]]
        comparison = compared(old, new)["comparison"]
        self.assertEqual(comparison["entries"][0][2], [("Route One", "B"), ("Route Two", "A")])
        self.assertEqual(comparison["entries"][0][3], [("Route One", "A"), ("Route Two", "B")])
        self.assertEqual(comparison["counts"]["matched_pairs_changed"], 1)
        self.assertEqual(comparison["counts"]["matched_pairs_added"], 2)
        self.assertEqual(comparison["counts"]["matched_pairs_removed"], 2)
        self.assertEqual(comparison["counts"]["changed_matched"], 1)
        self.assertEqual(comparison["counts"]["matched_duplicate_count_changed"], 0)

    def test_variant_changes_and_normalization_remain_explicit(self):
        old = [["  EXAMPLE  Ltd ", "  Cardiff  ", "", "A", "Skilled Worker"],
               ["Space   Name", "New  Town", "", "A", "Skilled Worker"],
               ["Straße Ltd", "Bonn", "", "A", "Skilled Worker"]]
        new = [["Example Ltd", "Cardiff", "", "A", "Skilled Worker"],
               ["Space Name", "New Town", "", "A", "Skilled Worker"],
               ["STRASSE LTD", "Bonn", "", "A", "Skilled Worker"]]
        result = compared(old, new)
        counts = result["comparison"]["counts"]
        self.assertEqual(counts["present_both"], 3)
        self.assertEqual(counts["matched_variants_changed"], 2)
        self.assertEqual(counts["changed_matched"], 2)
        self.assertEqual(counts["unchanged_matched"], 1)
        self.assertEqual(counts["matched_pairs_changed"], 0)

    def test_name_location_punctuation_and_unicode_changes_are_not_remapped(self):
        old = [["Name Ltd", "Cardiff", "", "A", "SW"], ["Town Ltd", "London", "", "A", "SW"],
               ["County Ltd", "Bath", "County One", "A", "SW"], ["A-B Ltd", "York", "", "A", "SW"],
               ["Café", "Leeds", "", "A", "SW"], ["Same Ltd", "Oxford", "", "A", "SW"]]
        new = [["New Name Ltd", "Cardiff", "", "A", "SW"], ["Town Ltd", "Ilford", "", "A", "SW"],
               ["County Ltd", "Bath", "County Two", "A", "SW"], ["A B Ltd", "York", "", "A", "SW"],
               ["Cafe\u0301", "Leeds", "", "A", "SW"], ["Same Ltd", "Cambridge", "", "A", "SW"]]
        comparison = compared(old, new)["comparison"]
        self.assertEqual(comparison["counts"]["present_both"], 0)
        self.assertEqual(comparison["counts"]["earlier_only"], len(old))
        self.assertEqual(comparison["counts"]["current_only"], len(new))
        self.assertTrue(all(row[4] is False for row in comparison["entries"]))

    def test_reordered_records_and_duplicate_only_differences_are_not_primary_changes(self):
        a, b = ["A Ltd", "", "", "A", "SW"], ["B Ltd", "", "", "A", "SW"]
        reordered = compared([a, b], [b, a])["comparison"]
        self.assertEqual(reordered["counts"]["unchanged_matched"], 2)
        self.assertEqual(reordered["counts"]["matched_source_row_count_changed"], 0)
        self.assertNotEqual(reordered["earlier"]["entries"][0][5], data([b, a])["entries"][0][5])
        comparison = compared([a, a, a, b], [b, a])["comparison"]
        self.assertEqual(comparison["counts"]["changed_matched"], 0)
        self.assertEqual(comparison["counts"]["unchanged_matched"], 2)
        self.assertEqual(comparison["counts"]["matched_source_row_count_changed"], 1)
        self.assertEqual(comparison["counts"]["matched_duplicate_count_changed"], 1)
        self.assertEqual(comparison["counts"]["earlier_duplicate_source_rows"], 2)
        self.assertEqual(comparison["counts"]["current_duplicate_source_rows"], 0)
        self.assertEqual(sum(len(row[5]) for row in comparison["earlier"]["entries"]), 4)

    def test_recording_difference_counts_are_independent_and_may_overlap_primary_changes(self):
        old = [["Added pair", "", "", "A", "SW"], ["Replaced duplicate", "", "", "A", "SW"],
               ["Replaced duplicate", "", "", "A", "SW"], ["TEXT", "", "", "A", "SW"]]
        new = [["Added pair", "", "", "A", "SW"], ["Added pair", "", "", "A", "Creative"],
               ["Replaced duplicate", "", "", "A", "SW"], ["Replaced duplicate", "", "", "A", "Creative"],
               ["Text", "", "", "B", "SW"]]
        counts = compared(old, new)["comparison"]["counts"]
        self.assertEqual(counts["changed_matched"], 3)
        self.assertEqual(counts["matched_pairs_changed"], 3)
        self.assertEqual(counts["matched_variants_changed"], 1)
        self.assertEqual(counts["matched_source_row_count_changed"], 1)
        self.assertEqual(counts["matched_duplicate_count_changed"], 1)

    def test_comparison_does_not_carry_or_renew_current_historical_evidence(self):
        rows = [["Fictional Limited", "Cardiff", "", "A", "Skilled Worker"]]
        result = data(rows)
        builder.add_retained_evidence(result, packet_bytes(evidence_packet(result)))
        expected = copy.deepcopy(result)
        builder.add_register_comparison(result, csv_bytes(rows * 2), EARLIER_URL, EARLIER_DAY, EARLIER_OBSERVED)
        comparison = result.pop("comparison")
        self.assertEqual(result, expected)
        self.assertNotIn("evidence", comparison["earlier"])
        self.assertEqual(comparison["earlier"]["meta"]["coverage"]["retained_evidence_entries"], 0)
        self.assertEqual(result["meta"]["coverage"]["newly_verified_businesses"], 0)
        self.assertEqual(result["evidence"]["subjects"][result["entries"][0][0]]["prior_review_due_at"], "2026-10-27T12:00:00.000Z")

    def test_invalid_earlier_input_and_dates_leave_dataset_unchanged(self):
        rows = [["Example", "", "", "A", "SW"]]
        args = [(b"", EARLIER_URL, EARLIER_DAY, EARLIER_OBSERVED),
                (csv_bytes(rows, list(reversed(builder.HEADERS))), EARLIER_URL, EARLIER_DAY, EARLIER_OBSERVED),
                (csv_bytes(rows), URL, DAY, OBSERVED),
                (csv_bytes(rows), URL.replace(DAY, "2026-11-12"), "2026-11-12", "2026-11-12T12:00:00Z"),
                (csv_bytes(rows), EARLIER_URL, EARLIER_DAY, "2026-10-01T00:00:00Z"),
                (csv_bytes(rows), EARLIER_URL, EARLIER_DAY, "2026-10-04T00:00:00"),
                (csv_bytes(rows), EARLIER_URL.replace("https:", "http:"), EARLIER_DAY, EARLIER_OBSERVED)]
        for values in args:
            result = data(rows); original = copy.deepcopy(result)
            with self.subTest(values=values[1:]), self.assertRaises(ValueError):
                builder.add_register_comparison(result, *values)
            self.assertEqual(result, original)
        # Collection time is separate from source chronology: an older source
        # downloaded later must keep its actual supplied observation timestamp.
        result = data(rows)
        builder.add_register_comparison(result, csv_bytes(rows), EARLIER_URL, EARLIER_DAY, "2026-11-11T13:00:00Z")
        self.assertEqual(result["comparison"]["earlier"]["meta"]["observed_at"], "2026-11-11T13:00:00Z")
        original = copy.deepcopy(result)
        with self.assertRaises(ValueError):
            builder.add_register_comparison(result, csv_bytes(rows), EARLIER_URL, EARLIER_DAY, EARLIER_OBSERVED)
        self.assertEqual(result, original)

    def test_cross_snapshot_key_collision_fails_closed(self):
        with patch.object(builder, "sha256", return_value="a" * 64):
            result = data([["Different current name", "", "", "A", "SW"]]); original = copy.deepcopy(result)
            with self.assertRaisesRegex(ValueError, "collision"):
                builder.add_register_comparison(result, csv_bytes([["Earlier name", "", "", "A", "SW"]]), EARLIER_URL, EARLIER_DAY, EARLIER_OBSERVED)
            self.assertEqual(result, original)

    def test_optional_arguments_and_invalid_comparison_never_create_output(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); source = root / "source.csv"; earlier = root / "earlier.csv"; template = root / "template.html"
            source.write_bytes(csv_bytes([["Example", "", "", "A", "SW"]])); earlier.write_bytes(source.read_bytes())
            template.write_text(TEMPLATE, encoding="utf-8")
            values = dict(earlier_csv_path=earlier, earlier_source_url=EARLIER_URL, earlier_source_date=EARLIER_DAY, earlier_observed_at=EARLIER_OBSERVED)
            for mask in range(1, 15):
                partial = {key: value for index, (key, value) in enumerate(values.items()) if mask & (1 << index)}
                out = root / str(mask)
                with self.subTest(mask=mask), self.assertRaisesRegex(ValueError, "four"):
                    builder.build_pack(source, URL, DAY, OBSERVED, out, template, **partial)
                self.assertFalse(out.exists())
            earlier.write_bytes(b"bad header\n")
            with self.assertRaises(ValueError):
                builder.build_pack(source, URL, DAY, OBSERVED, root / "invalid", template, **values)
            self.assertFalse((root / "invalid").exists())

    def test_comparison_exports_safe_complete_data_hashes_and_refuses_replay(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); source = root / "source.csv"; earlier = root / "earlier.csv"; template = root / "template.html"; out = root / "pack"
            source.write_bytes(csv_bytes([["Current", "", "", "A", "SW"]]))
            name = '=TEST </script><img src=x onerror="alert(1)">'
            earlier.write_bytes(csv_bytes([[name, "@CITY", "", "A", "SW"]])); template.write_text(TEMPLATE, encoding="utf-8")
            values = dict(earlier_csv_path=earlier, earlier_source_url=EARLIER_URL, earlier_source_date=EARLIER_DAY, earlier_observed_at=EARLIER_OBSERVED)
            receipt = builder.build_pack(source, URL, DAY, OBSERVED, out, template, **values)
            self.assertEqual(receipt["comparison"]["business_evidence_carried_forward"], 0)
            self.assertEqual(receipt["comparison"]["counts"]["earlier_only"], 1)
            self.assertIn("register-comparison.csv", receipt["files"])
            for filename, expected in receipt["files"].items():
                raw = (out / filename).read_bytes()
                self.assertEqual(len(raw), expected["bytes"])
                self.assertEqual(hashlib.sha256(raw).hexdigest(), expected["sha256"])
            payload = json.loads((out / "data.json").read_text())
            self.assertEqual(payload["comparison"]["earlier"]["entries"][0][1], name)
            self.assertNotIn("<img", (out / "index.html").read_text())
            rows = list(csv.DictReader(io.StringIO((out / "register-comparison.csv").read_text())))
            old = next(row for row in rows if row["Snapshot presence"] == "earlier_only")
            self.assertEqual(old["Earlier register name"], "'" + name)
            self.assertEqual(old["Earlier town/city"], "'@CITY")
            self.assertEqual(json.loads(old["Earlier source CSV records (JSON)"]), [2])
            self.assertEqual(old["Current register name"], "")
            self.assertEqual(json.loads(old["Route/rating pairs only in earlier supplied record (JSON)"]), [["SW", "A"]])
            readme = (out / "README.md").read_text()
            self.assertIn("does not establish the reason", readme)
            self.assertIn("not added to the current register totals", readme)
            original = (out / "receipt.json").read_bytes()
            with self.assertRaises(ValueError):
                builder.build_pack(source, URL, DAY, OBSERVED, out, template, **values)
            self.assertEqual((out / "receipt.json").read_bytes(), original)


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


class RetainedReviewDateTests(unittest.TestCase):
    def baseline(self):
        return data([["Fictional Limited", "Cardiff", "", "A", "Skilled Worker"]])

    def reject(self, mutate):
        result = self.baseline(); original = copy.deepcopy(result); packet = review_packet(result)
        mutate(packet)
        with self.assertRaises(ValueError):
            builder.add_retained_evidence(result, packet_bytes(packet), validation_at="2026-11-11T16:00:00Z")
        self.assertEqual(result, original)

    def test_review_date_is_preserved_without_source_observation_time_or_approval(self):
        result = self.baseline(); baseline = copy.deepcopy(result); packet = review_packet(result); raw = packet_bytes(packet)
        builder.add_retained_evidence(result, raw, validation_at="2026-11-11T16:00:00Z")
        retained = result["evidence"]
        self.assertEqual(retained["schema_version"], 2)
        self.assertEqual(retained["packet_sha256"], hashlib.sha256(raw).hexdigest())
        self.assertEqual(retained["observations"], packet["observations"])
        self.assertIsNone(retained["observations"][0]["observed_at"])
        self.assertEqual(retained["observations"][0]["reviewed_on"], "2026-10-08")
        self.assertEqual(retained["subjects"][result["entries"][0][0]]["review_status"], "owner_review_required")
        self.assertEqual(result["entries"], baseline["entries"])
        self.assertEqual(result["meta"]["coverage"]["newly_verified_businesses"], 0)
        self.assertEqual(result["meta"]["coverage"]["jobs"], "not_collected")
        self.assertTrue(any("no source-observation time or timezone is inferred" in text for text in result["meta"]["limitations"]))
        unchanged = copy.deepcopy(result)
        with self.assertRaises(ValueError):
            builder.add_retained_evidence(result, raw)
        self.assertEqual(result, unchanged)

    def test_schema_two_timestamped_records_keep_schema_one_payload_and_date_rules(self):
        one, two = self.baseline(), self.baseline()
        packet_one = evidence_packet(one); packet_two = copy.deepcopy(packet_one); packet_two["schema_version"] = 2
        builder.add_retained_evidence(one, packet_bytes(packet_one))
        builder.add_retained_evidence(two, packet_bytes(packet_two))
        evidence_one, evidence_two = one.pop("evidence"), two.pop("evidence")
        self.assertEqual(one, two)
        self.assertEqual(evidence_one["schema_version"], 1)
        self.assertEqual(evidence_two["schema_version"], 2)
        for key in ["prepared_at", "subjects", "observations"]:
            self.assertEqual(evidence_one[key], evidence_two[key])
        for bad in [None, "2026-10-08", "2026-10-08T12:00:00", "2026-11-12T00:00:00Z"]:
            packet = copy.deepcopy(packet_two); packet["observations"][0]["observed_at"] = bad
            with self.subTest(observed_at=bad), self.assertRaises(ValueError):
                builder.add_retained_evidence(self.baseline(), packet_bytes(packet))

    def test_date_only_review_requires_schema_two_null_observation_and_exact_kind_fields(self):
        mutations = [lambda p: p.update(schema_version=1), lambda p: p.update(schema_version=True),
                     lambda p: p.update(schema_version=2.0), lambda p: p.update(schema_version=3),
                     lambda p: p["observations"][0].pop("reviewed_on"),
                     lambda p: p["observations"][0].pop("observed_at"),
                     lambda p: p["observations"][0].update(evidence_kind="retained_operator_observation"),
                     lambda p: p["observations"][0].update(evidence_kind="primary_source_quote")]
        for mutate in mutations:
            self.reject(mutate)
        for nonnull in ["2026-10-08T00:00:00Z", "2026-10-08", "", False, 0, [], {}]:
            with self.subTest(observed_at=nonnull):
                self.reject(lambda p: p["observations"][0].update(observed_at=nonnull))
        # A timestamped observation must not acquire a date-only review field,
        # even when its observed_at remains valid and the extra value is null.
        for version in [1, 2]:
            for reviewed_on in [None, "2026-10-08"]:
                packet = evidence_packet(self.baseline()); packet["schema_version"] = version
                packet["observations"][0]["reviewed_on"] = reviewed_on
                with self.assertRaises(ValueError):
                    builder.add_retained_evidence(self.baseline(), packet_bytes(packet))

    def test_review_dates_are_calendar_valid_and_never_later_than_preparation_date(self):
        for bad in [None, True, 20261008, "", "2026-2-08", "2026-10-8", "2026-02-29", "2026-02-30", "0000-01-01",
                    "2026-13-01", "2026-10-08T00:00:00Z", " 2026-10-08", "2026-10-08\n", "2026-11-12"]:
            with self.subTest(reviewed_on=bad):
                self.reject(lambda p: p["observations"][0].update(reviewed_on=bad))
        for valid in ["2024-02-29", "2026-11-11"]:
            result = self.baseline(); packet = review_packet(result); packet["observations"][0]["reviewed_on"] = valid
            packet["prepared_at"] = "2026-11-11T00:00:00Z"
            builder.add_retained_evidence(result, packet_bytes(packet), validation_at="2026-11-11T00:00:00Z")
            self.assertEqual(result["evidence"]["observations"][0]["reviewed_on"], valid)
            self.assertIsNone(result["evidence"]["observations"][0]["observed_at"])
        self.reject(lambda p: p.update(prepared_at="2026-11-12T16:00:00Z"))

    def test_mixed_review_and_observation_support_more_than_two_exact_subjects(self):
        rows = [[name, "Cardiff", "", "A", "SW"] for name in ["Fictional One", "Fictional Two", "Fictional Three"]]
        result = data(rows); packet = review_packet(result)
        precise = evidence_packet(result)["observations"][0]; precise["id"] = "precise_source"
        packet["observations"].append(precise)
        original_subject = packet["subjects"][0]
        for row in result["entries"][1:]:
            subject = copy.deepcopy(original_subject)
            subject.update(entry_key=row[0], name=row[1], city=row[2], county=row[3], source_rows=row[5])
            packet["subjects"].append(subject)
        packet["subjects"][1]["claims"][0]["observation_ids"].append("precise_source")
        packet["subjects"][2]["claims"][0]["observation_ids"] = ["precise_source"]
        builder.add_retained_evidence(result, packet_bytes(packet))
        self.assertEqual(result["evidence"]["observations"], packet["observations"])
        self.assertEqual(result["meta"]["coverage"]["retained_evidence_entries"], 3)
        self.assertEqual(result["meta"]["coverage"]["retained_evidence_claims"], 9)
        self.assertTrue(all(subject["review_status"] == "owner_review_required" for subject in result["evidence"]["subjects"].values()))

    def test_schema_two_keeps_duplicate_private_binding_url_and_size_guards(self):
        mutations = [lambda p: p["observations"][0].update(approval="approved"),
                     lambda p: p["observations"][0].update(source_observed_at="2026-10-08T00:00:00Z"),
                     lambda p: p["observations"][0].update(url="https://example.org/?token=secret"),
                     lambda p: p["observations"][0].update(receipt_reference="docs/../private.json"),
                     lambda p: p["observations"][0].update(summary="x" * 2001),
                     lambda p: p["subjects"][0].update(source_rows=[True]),
                     lambda p: p.update(register_sha256="b" * 64),
                     lambda p: p["observations"].append({**p["observations"][0], "id": "duplicate_new_id"}),
                     lambda p: p["subjects"][0]["claims"][0].update(observation_ids=["missing"])]
        for mutate in mutations:
            self.reject(mutate)
        result = self.baseline(); raw = packet_bytes(review_packet(result))
        repeated_date = raw.replace(b'"reviewed_on": "2026-10-08"', b'"reviewed_on": "2026-10-08", "reviewed_on": "2026-10-09"')
        with self.assertRaisesRegex(ValueError, "Duplicate JSON"):
            builder.add_retained_evidence(result, repeated_date)
        with patch.object(builder, "MAX_EVIDENCE_BYTES", len(raw) - 1), self.assertRaises(ValueError):
            builder.add_retained_evidence(result, raw)
        for constant in ["MAX_EVIDENCE_SUBJECTS", "MAX_EVIDENCE_OBSERVATIONS"]:
            with patch.object(builder, constant, 0), self.assertRaises(ValueError):
                builder.add_retained_evidence(result, raw)

    def test_review_dates_remain_distinct_historical_records_without_selected_winner(self):
        result = self.baseline(); packet = review_packet(result)
        other = {**packet["observations"][0], "id": "later_review", "reviewed_on": "2026-10-09"}
        packet["observations"].append(other)
        packet["subjects"][0]["claims"][0]["observation_ids"].append(other["id"])
        builder.add_retained_evidence(result, packet_bytes(packet))
        self.assertEqual(result["evidence"]["observations"], packet["observations"])
        self.assertEqual(result["evidence"]["subjects"][result["entries"][0][0]]["prior_review_due_at"], "2026-10-27T12:00:00.000Z")
        self.assertNotIn("selected", result["evidence"])

    def test_review_pack_preserves_null_and_date_and_invalid_date_leaves_output_absent(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); source = root / "source.csv"; template = root / "template.html"; evidence = root / "evidence.json"
            source.write_bytes(csv_bytes([["Fictional Limited", "Cardiff", "", "A", "Skilled Worker"]]))
            template.write_text(TEMPLATE, encoding="utf-8")
            packet = review_packet(self.baseline()); evidence.write_bytes(packet_bytes(packet))
            receipt = builder.build_pack(source, URL, DAY, OBSERVED, root / "valid", template, evidence)
            actual = json.loads((root / "valid/data.json").read_text())
            self.assertEqual(actual["evidence"]["schema_version"], 2)
            self.assertEqual(actual["evidence"]["observations"], packet["observations"])
            readme = (root / "valid/README.md").read_text()
            self.assertIn("recorded review date, not an original source-page observation date", readme)
            self.assertIn("no midnight or timezone is inferred", readme)
            self.assertEqual(receipt["newly_verified_businesses"], 0)
            for filename, integrity in receipt["files"].items():
                self.assertEqual(hashlib.sha256((root / "valid" / filename).read_bytes()).hexdigest(), integrity["sha256"])
            packet["observations"][0]["observed_at"] = "2026-10-08T00:00:00Z"
            evidence.write_bytes(packet_bytes(packet))
            with self.assertRaises(ValueError):
                builder.build_pack(source, URL, DAY, OBSERVED, root / "invalid", template, evidence)
            self.assertFalse((root / "invalid").exists())


if __name__ == "__main__":
    unittest.main()
