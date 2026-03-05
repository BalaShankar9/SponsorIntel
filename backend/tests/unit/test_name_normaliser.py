"""
Tests for the company name normaliser utility.
"""

from app.utils.name_normaliser import normalise_company_name


class TestNormaliseCompanyName:
    def test_strips_ltd(self):
        assert normalise_company_name("Acme Ltd") == "acme"

    def test_strips_limited(self):
        assert normalise_company_name("Acme Limited") == "acme"

    def test_strips_plc(self):
        assert normalise_company_name("Barclays PLC") == "barclays"

    def test_strips_llp(self):
        assert normalise_company_name("Deloitte LLP") == "deloitte"

    def test_strips_inc(self):
        assert normalise_company_name("Google Inc") == "google"

    def test_strips_corp(self):
        assert normalise_company_name("Microsoft Corp") == "microsoft"

    def test_strips_group(self):
        assert normalise_company_name("Tesco Group") == "tesco"

    def test_strips_holdings(self):
        assert normalise_company_name("HSBC Holdings") == "hsbc"

    def test_strips_uk(self):
        assert normalise_company_name("Amazon UK") == "amazon"

    def test_strips_trading_as(self):
        result = normalise_company_name("Acme Trading As WidgetCo Ltd")
        assert "trading" not in result
        assert "widgetco" in result

    def test_strips_t_a(self):
        result = normalise_company_name("Acme T/A WidgetCo")
        assert "t/a" not in result.lower()
        assert "widgetco" in result

    def test_handles_quoted_names(self):
        result = normalise_company_name('"K" Line Energy')
        assert "k" in result
        assert "line" in result
        assert "energy" in result

    def test_handles_double_quotes(self):
        result = normalise_company_name('"Some Company Ltd"')
        assert result == "some company"

    def test_handles_ampersand(self):
        result = normalise_company_name("Smith & Jones Ltd")
        assert "smith" in result
        assert "and" in result
        assert "jones" in result

    def test_handles_apostrophe(self):
        result = normalise_company_name("McDonald's Ltd")
        assert "mcdonalds" in result

    def test_handles_punctuation(self):
        result = normalise_company_name("Company (UK) Ltd.")
        assert "company" in result

    def test_collapses_whitespace(self):
        result = normalise_company_name("  Acme   Widget   Co  ")
        assert "  " not in result
        assert result.startswith("acme")

    def test_empty_string(self):
        assert normalise_company_name("") == ""

    def test_whitespace_only(self):
        assert normalise_company_name("   ") == ""

    def test_none_like_empty(self):
        # Edge case for empty after stripping
        assert normalise_company_name("Ltd") == ""

    def test_multiple_suffixes(self):
        result = normalise_company_name("Acme Holdings Group Ltd")
        assert result == "acme"

    def test_lowercase(self):
        result = normalise_company_name("ACME WIDGETS LTD")
        assert result == "acme widgets"
