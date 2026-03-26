"""Prometheus metrics for the SponsorIntel agent army.

Exports key operational metrics at /metrics endpoint.
"""

from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST

# Counters
MISSIONS_TOTAL = Counter(
    "sponsorintel_missions_total",
    "Total agent missions executed",
    ["division", "status"],
)

JOBS_DISCOVERED = Counter(
    "sponsorintel_jobs_discovered_total",
    "Total jobs discovered",
    ["source"],
)

SIGNALS_EMITTED = Counter(
    "sponsorintel_signals_emitted_total",
    "Total signals emitted via SignalBus",
    ["channel"],
)

NOTIFICATIONS_SENT = Counter(
    "sponsorintel_notifications_sent_total",
    "Total notifications dispatched",
    ["channel"],
)

# Gauges
SPONSORS_ACTIVE = Gauge(
    "sponsorintel_sponsors_active",
    "Current number of active sponsors",
)

AGENTS_HEALTHY = Gauge(
    "sponsorintel_agents_healthy",
    "Number of healthy agents (heartbeat within 120s)",
)

LLM_DAILY_SPEND = Gauge(
    "sponsorintel_llm_daily_spend_usd",
    "LLM spend today in USD",
)

# Histograms
ENRICHMENT_DURATION = Histogram(
    "sponsorintel_enrichment_duration_seconds",
    "Enrichment pipeline duration",
    ["agent"],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30, 60],
)

LLM_CALL_DURATION = Histogram(
    "sponsorintel_llm_call_duration_seconds",
    "LLM API call duration",
    ["tier", "provider"],
    buckets=[0.1, 0.5, 1, 2, 5, 10],
)


def get_metrics() -> bytes:
    """Return Prometheus metrics in text format."""
    return generate_latest()


def get_content_type() -> str:
    """Return the Prometheus content type header."""
    return CONTENT_TYPE_LATEST
