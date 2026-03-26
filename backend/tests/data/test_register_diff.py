"""Tests for enhanced register diffing."""
import pytest

class TestRegisterDiff:
    def test_diff_detects_new_sponsor(self):
        from app.scripts.data_foundation.register_diff import compute_diff
        csv_records = [
            {"organisation_name": "TechCorp Ltd", "town_city": "London", "rating": "A", "routes": ["Skilled Worker"]},
            {"organisation_name": "NewCo Ltd", "town_city": "Manchester", "rating": "A", "routes": ["Skilled Worker"]},
        ]
        db_sponsors = {
            "TECHCORP LTD": {"id": "123", "organisation_name": "TechCorp Ltd", "rating": "A", "routes": ["Skilled Worker"]},
        }
        diff = compute_diff(csv_records, db_sponsors)
        assert len(diff["added"]) == 1
        assert diff["added"][0]["organisation_name"] == "NewCo Ltd"

    def test_diff_detects_removed_sponsor(self):
        from app.scripts.data_foundation.register_diff import compute_diff
        csv_records = [{"organisation_name": "TechCorp Ltd", "town_city": "London", "rating": "A", "routes": ["Skilled Worker"]}]
        db_sponsors = {
            "TECHCORP LTD": {"id": "123", "organisation_name": "TechCorp Ltd", "rating": "A", "routes": ["Skilled Worker"]},
            "OLDCO LTD": {"id": "456", "organisation_name": "OldCo Ltd", "rating": "B", "routes": ["Skilled Worker"]},
        }
        diff = compute_diff(csv_records, db_sponsors)
        assert len(diff["removed"]) == 1

    def test_diff_detects_rating_change(self):
        from app.scripts.data_foundation.register_diff import compute_diff
        csv_records = [{"organisation_name": "TechCorp Ltd", "town_city": "London", "rating": "B", "routes": ["Skilled Worker"]}]
        db_sponsors = {"TECHCORP LTD": {"id": "123", "organisation_name": "TechCorp Ltd", "rating": "A", "routes": ["Skilled Worker"]}}
        diff = compute_diff(csv_records, db_sponsors)
        assert len(diff["rating_changes"]) == 1
        assert diff["rating_changes"][0]["old_rating"] == "A"
        assert diff["rating_changes"][0]["new_rating"] == "B"

    def test_diff_empty_inputs(self):
        from app.scripts.data_foundation.register_diff import compute_diff
        diff = compute_diff([], {})
        assert diff == {"added": [], "removed": [], "rating_changes": [], "route_changes": []}
