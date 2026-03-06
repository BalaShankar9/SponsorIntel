"""
Unit tests for scraping infrastructure, sponsorship detection, and job deduplication.
"""

import asyncio
import time
from unittest.mock import MagicMock, patch

import pytest

from app.scrapers.anti_detection import (
    USER_AGENTS,
    get_random_headers,
    get_random_referer,
    random_delay,
)
from app.scrapers.rate_limiter import RateLimiter
from app.services.sponsorship_detector import (
    NEGATIVE_SIGNALS,
    POSITIVE_SIGNALS,
    detect_sponsorship,
    extract_sponsorship_context,
)


# ---------------------------------------------------------------------------
# RateLimiter tests
# ---------------------------------------------------------------------------


class TestRateLimiter:
    def test_rate_limiter_initialisation(self):
        limiter = RateLimiter(requests_per_minute=10)
        assert limiter.requests_per_minute == 10

    def test_rate_limiter_acquire_under_limit(self):
        """Should acquire immediately when under the rate limit."""
        limiter = RateLimiter(requests_per_minute=100)
        loop = asyncio.new_event_loop()
        start = time.monotonic()
        loop.run_until_complete(limiter.acquire())
        elapsed = time.monotonic() - start
        loop.close()
        # Should be very fast (no waiting)
        assert elapsed < 1.0

    def test_rate_limiter_custom_rpm(self):
        limiter = RateLimiter(requests_per_minute=5)
        assert limiter.requests_per_minute == 5


# ---------------------------------------------------------------------------
# Anti-detection tests
# ---------------------------------------------------------------------------


class TestAntiDetection:
    def test_user_agents_count(self):
        """Should have at least 30 user agents."""
        assert len(USER_AGENTS) >= 30

    def test_get_random_headers_returns_dict(self):
        headers = get_random_headers()
        assert isinstance(headers, dict)

    def test_get_random_headers_has_user_agent(self):
        headers = get_random_headers()
        assert "User-Agent" in headers
        assert len(headers["User-Agent"]) > 20

    def test_get_random_headers_has_accept(self):
        headers = get_random_headers()
        assert "Accept" in headers
        assert "Accept-Language" in headers
        assert "Accept-Encoding" in headers

    def test_get_random_headers_varies(self):
        """Headers should vary between calls (randomised UA)."""
        all_uas = set()
        for _ in range(20):
            headers = get_random_headers()
            all_uas.add(headers["User-Agent"])
        # With 30+ UAs, 20 samples should produce at least 2 unique
        assert len(all_uas) >= 2

    def test_random_delay_within_bounds(self):
        """Random delay should be within specified bounds."""
        loop = asyncio.new_event_loop()
        start = time.monotonic()
        loop.run_until_complete(random_delay(min_s=0.01, max_s=0.05))
        elapsed = time.monotonic() - start
        loop.close()
        assert elapsed >= 0.01
        assert elapsed < 0.5  # generous upper bound

    def test_get_random_referer_returns_string(self):
        referer = get_random_referer("example.com")
        assert isinstance(referer, str)

    def test_get_random_referer_contains_domain(self):
        """Non-empty referers should reference the domain or Google."""
        referers = set()
        for _ in range(50):
            referers.add(get_random_referer("example.com"))
        non_empty = [r for r in referers if r]
        assert len(non_empty) > 0
        for ref in non_empty:
            assert "example.com" in ref or "google" in ref


# ---------------------------------------------------------------------------
# Sponsorship Detector tests
# ---------------------------------------------------------------------------


class TestSponsorshipDetector:
    def test_positive_detection_strong(self):
        """Strong positive signal should give high likelihood."""
        text = "We are happy to offer visa sponsorship available for the right candidate."
        likelihood, signals = detect_sponsorship(text)
        assert likelihood >= 80
        assert any("visa sponsorship" in s for s in signals)

    def test_positive_detection_certificate(self):
        """Certificate of sponsorship mention should score high."""
        text = "We will provide a certificate of sponsorship for overseas applicants."
        likelihood, signals = detect_sponsorship(text)
        assert likelihood >= 80

    def test_negative_detection_strong(self):
        """Strong negative signal should give low likelihood."""
        text = "Please note: no sponsorship is available for this role."
        likelihood, signals = detect_sponsorship(text)
        assert likelihood <= 20

    def test_negative_detection_cannot_sponsor(self):
        text = "Unfortunately we cannot sponsor visas at this time."
        likelihood, signals = detect_sponsorship(text)
        assert likelihood <= 20

    def test_empty_description(self):
        """Empty description should give low default score."""
        likelihood, signals = detect_sponsorship("")
        assert likelihood <= 15

    def test_empty_with_known_sponsor(self):
        """Empty description but known sponsor should boost score."""
        likelihood, signals = detect_sponsorship("", is_known_sponsor=True)
        assert likelihood >= 25

    def test_no_signals_found(self):
        """Description with no signals should give moderate-low score."""
        text = "We are looking for a Python developer to join our team."
        likelihood, signals = detect_sponsorship(text)
        assert 10 <= likelihood <= 40

    def test_known_sponsor_boost(self):
        """Known sponsor status should boost likelihood."""
        text = "Skilled worker visa support for international candidates."
        likelihood_without, _ = detect_sponsorship(text, is_known_sponsor=False)
        likelihood_with, _ = detect_sponsorship(text, is_known_sponsor=True)
        assert likelihood_with >= likelihood_without

    def test_shortage_occupation_boost(self):
        """Shortage occupation should boost likelihood."""
        text = "Join us as a software engineer."
        likelihood_without, _ = detect_sponsorship(text, is_shortage_occupation=False)
        likelihood_with, _ = detect_sponsorship(text, is_shortage_occupation=True)
        assert likelihood_with >= likelihood_without

    def test_mixed_signals(self):
        """Mixed positive and negative should lean toward stronger signal."""
        text = (
            "We offer visa sponsorship for international candidates. "
            "However, you must have right to work in the UK initially."
        )
        likelihood, signals = detect_sponsorship(text)
        # Positive signal is stronger, so should lean positive
        assert likelihood >= 30

    def test_confidence_scores_range(self):
        """All signal scores should be in valid ranges."""
        for signal, score in POSITIVE_SIGNALS.items():
            assert 0.0 < score <= 1.0, f"Positive signal '{signal}' has invalid score {score}"

        for signal, score in NEGATIVE_SIGNALS.items():
            assert -1.0 <= score < 0.0, f"Negative signal '{signal}' has invalid score {score}"

    def test_signals_are_lowercase(self):
        """All signal keys should be lowercase for matching."""
        for signal in POSITIVE_SIGNALS:
            assert signal == signal.lower()
        for signal in NEGATIVE_SIGNALS:
            assert signal == signal.lower()


class TestSponsorshipContext:
    def test_extract_context_empty(self):
        assert extract_sponsorship_context("") == []

    def test_extract_context_with_visa_mention(self):
        text = "We welcome international applicants and offer visa sponsorship for the right candidate."
        contexts = extract_sponsorship_context(text, window=30)
        assert len(contexts) > 0
        assert any("visa" in c.lower() or "sponsor" in c.lower() for c in contexts)

    def test_extract_context_limit(self):
        """Should return at most 5 snippets."""
        text = (
            "visa sponsor visa sponsor visa sponsor "
            "visa sponsor visa sponsor visa sponsor "
            "visa sponsor visa sponsor"
        )
        contexts = extract_sponsorship_context(text, window=10)
        assert len(contexts) <= 5


# ---------------------------------------------------------------------------
# Job Deduplication tests
# ---------------------------------------------------------------------------


class TestJobDedup:
    def test_are_jobs_similar_exact_match(self):
        from app.services.job_dedup import are_jobs_similar

        assert are_jobs_similar(
            "Software Engineer", "Acme Corp", "London",
            "Software Engineer", "Acme Corp", "London",
        ) is True

    def test_are_jobs_similar_slight_variation(self):
        from app.services.job_dedup import are_jobs_similar

        assert are_jobs_similar(
            "Senior Software Engineer", "Acme Corporation", "London",
            "Senior Software Engineer", "Acme Corp", "London",
        ) is True

    def test_are_jobs_different_title(self):
        from app.services.job_dedup import are_jobs_similar

        assert are_jobs_similar(
            "Junior Data Analyst", "Tech Ltd", "Manchester",
            "Senior Software Engineer", "Tech Ltd", "Manchester",
        ) is False

    def test_are_jobs_different_company(self):
        from app.services.job_dedup import are_jobs_similar

        assert are_jobs_similar(
            "Software Engineer", "Acme Corp", "London",
            "Software Engineer", "Zenith Inc", "London",
        ) is False

    def test_are_jobs_different_city(self):
        from app.services.job_dedup import are_jobs_similar

        assert are_jobs_similar(
            "Software Engineer", "Acme Corp", "London",
            "Software Engineer", "Acme Corp", "Manchester",
        ) is False

    def test_are_jobs_no_city(self):
        from app.services.job_dedup import are_jobs_similar

        # Both without city should still match
        assert are_jobs_similar(
            "Software Engineer", "Acme Corp", None,
            "Software Engineer", "Acme Corp", None,
        ) is True

    def test_are_jobs_empty_strings(self):
        from app.services.job_dedup import are_jobs_similar

        assert are_jobs_similar("", "", None, "", "", None) is False

    def test_pick_canonical_prefers_description(self):
        from app.services.job_dedup import _pick_canonical

        job_a = MagicMock()
        job_a.id = "a"
        job_a.description_full = "A short description."
        job_a.salary_min = None
        job_a.scraped_at = MagicMock()
        job_a.scraped_at.__gt__ = lambda self, other: False
        job_a.scraped_at.__lt__ = lambda self, other: True

        job_b = MagicMock()
        job_b.id = "b"
        job_b.description_full = "A much longer and more detailed job description with many requirements and benefits."
        job_b.salary_min = 50000.0
        job_b.scraped_at = MagicMock()
        job_b.scraped_at.__gt__ = lambda self, other: True
        job_b.scraped_at.__lt__ = lambda self, other: False

        canonical = _pick_canonical(job_a, job_b)
        assert canonical.id == "b"
