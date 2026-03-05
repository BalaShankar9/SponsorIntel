"""
Tests for the entity resolution engine.
"""

from app.services.entity_resolution import normalise_for_matching


class TestNormaliseForMatching:
    def test_basic_normalisation(self):
        result = normalise_for_matching("Acme Ltd.")
        assert result == "acme"

    def test_removes_all_non_alphanumeric(self):
        result = normalise_for_matching("Smith & Jones (UK) Ltd")
        # normalise_company_name turns & into "and", strips Ltd, UK
        # then normalise_for_matching removes remaining non-alphanumeric
        assert "smith" in result
        assert "jones" in result
        assert "&" not in result
        assert "(" not in result

    def test_empty_string(self):
        assert normalise_for_matching("") == ""

    def test_whitespace_only(self):
        assert normalise_for_matching("   ") == ""

    def test_preserves_numbers(self):
        result = normalise_for_matching("3M Company Ltd")
        assert "3m" in result
        assert "company" in result

    def test_collapses_whitespace(self):
        result = normalise_for_matching("  Foo   Bar   Baz  ")
        assert "  " not in result
        assert result == "foo bar baz"

    def test_strips_legal_suffixes(self):
        result = normalise_for_matching("Deloitte LLP")
        assert result == "deloitte"

    def test_quoted_name(self):
        result = normalise_for_matching('"K" Line Energy Ltd')
        assert "k" in result
        assert "line" in result
        assert "energy" in result
