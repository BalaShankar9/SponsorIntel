"""
Webhook notifications for critical agent events.

Sends alerts to Discord (or any webhook) when:
- A source has been down for 1+ hours
- Zero jobs scraped in 24 hours
- Hard timeout on a task
- Circuit breaker pauses a source
- Improvement agent discovers something significant
"""

import json
import logging
from datetime import datetime, timezone

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _get_webhook_url() -> str | None:
    """Get Discord webhook URL from settings."""
    settings = get_settings()
    return getattr(settings, "discord_webhook_url", None) or None


async def send_notification(
    title: str,
    message: str,
    severity: str = "warning",
    fields: dict | None = None,
):
    """Send a notification to Discord webhook.

    severity: 'info' (blue), 'warning' (amber), 'critical' (red), 'success' (green)
    """
    webhook_url = _get_webhook_url()
    if not webhook_url:
        logger.debug(f"[NOTIFY] No webhook URL configured. Skipping: {title}")
        return

    color_map = {
        "info": 0x3498DB,
        "warning": 0xF39C12,
        "critical": 0xE74C3C,
        "success": 0x2ECC71,
    }

    embed = {
        "title": f"{'🔴' if severity == 'critical' else '🟡' if severity == 'warning' else '🟢' if severity == 'success' else '🔵'} {title}",
        "description": message,
        "color": color_map.get(severity, 0xF39C12),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "footer": {"text": "SponsorIntel Agent Swarm"},
    }

    if fields:
        embed["fields"] = [
            {"name": k, "value": str(v), "inline": True}
            for k, v in fields.items()
        ]

    payload = {"embeds": [embed]}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code not in (200, 204):
                logger.warning(f"[NOTIFY] Discord webhook returned {resp.status_code}")
    except Exception as e:
        logger.warning(f"[NOTIFY] Failed to send notification: {e}")


def send_notification_sync(
    title: str,
    message: str,
    severity: str = "warning",
    fields: dict | None = None,
):
    """Synchronous version for use in Celery tasks."""
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(send_notification(title, message, severity, fields))
    finally:
        loop.close()


# Convenience functions for common alerts

def notify_source_paused(source: str, error: str):
    send_notification_sync(
        title=f"Source Paused: {source}",
        message=f"Circuit breaker triggered after 3 consecutive failures.",
        severity="critical",
        fields={"Source": source, "Last Error": error[:200]},
    )


def notify_zero_jobs(hours: int = 24):
    send_notification_sync(
        title="Zero Jobs Alert",
        message=f"No new jobs scraped in the last {hours} hours.",
        severity="critical",
        fields={"Hours": str(hours)},
    )


def notify_task_timeout(task_name: str, duration_secs: int):
    send_notification_sync(
        title=f"Task Timeout: {task_name}",
        message=f"Task hit hard time limit after {duration_secs}s.",
        severity="warning",
        fields={"Task": task_name, "Duration": f"{duration_secs}s"},
    )


def notify_pipeline_complete(pipeline: str, stats: dict):
    send_notification_sync(
        title=f"Pipeline Complete: {pipeline}",
        message=f"Pipeline finished successfully.",
        severity="success",
        fields=stats,
    )
