"""
Intel scanner: Reddit r/ukvisa and r/iwantout.

Uses Reddit OAuth2 (script-type app) to fetch new posts.
Requires REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET env vars.
"""

import logging
from datetime import datetime

import httpx

from app.scanners.intel_gov import is_immigration_relevant

logger = logging.getLogger(__name__)

REDDIT_AUTH_URL = "https://www.reddit.com/api/v1/access_token"
REDDIT_API_BASE = "https://oauth.reddit.com"
USER_AGENT = "SponsorIntel/1.0 (by /u/sponsorintel)"

SUBREDDITS = {
    "ukvisa": {"subreddit": "ukvisa", "filter_uk": False},
    "iwantout": {"subreddit": "IWantOut", "filter_uk": True},
}


async def get_reddit_token(client_id: str, client_secret: str) -> str | None:
    """Get Reddit OAuth2 bearer token using client_credentials grant."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                REDDIT_AUTH_URL,
                auth=(client_id, client_secret),
                data={"grant_type": "client_credentials"},
                headers={"User-Agent": USER_AGENT},
                timeout=15,
            )
            response.raise_for_status()
            return response.json()["access_token"]
    except Exception as e:
        logger.error(f"Reddit auth failed: {e}")
        return None


async def fetch_subreddit_new(
    token: str, subreddit: str, limit: int = 50
) -> list[dict]:
    """Fetch new posts from a subreddit."""
    headers = {"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT}
    params = {"limit": limit, "sort": "new"}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{REDDIT_API_BASE}/r/{subreddit}/new",
                headers=headers, params=params, timeout=15,
            )
            response.raise_for_status()
            data = response.json()
    except Exception as e:
        logger.error(f"Reddit fetch failed for r/{subreddit}: {e}")
        return []

    posts = []
    for child in data.get("data", {}).get("children", []):
        post = child.get("data", {})
        posts.append({
            "title": post.get("title", ""),
            "source_url": f"https://reddit.com{post.get('permalink', '')}",
            "published_at": datetime.utcfromtimestamp(
                post.get("created_utc", 0)
            ).isoformat(),
            "content_text": post.get("selftext", "")[:5000],
            "content_snippet": post.get("selftext", "")[:500],
            "source_name": f"Reddit r/{subreddit}",
            "source_category": "community",
        })
    return posts


async def scan_social_sources(supabase_client, reddit_client_id: str, reddit_client_secret: str) -> dict:
    """Scan Reddit subreddits for immigration-related posts."""
    import time
    stats = {"items_fetched": 0, "items_new": 0, "items_filtered": 0}
    start = time.time()

    if not reddit_client_id or not reddit_client_secret:
        logger.warning("Reddit credentials not configured, skipping social scan")
        return stats

    token = await get_reddit_token(reddit_client_id, reddit_client_secret)
    if not token:
        return stats

    for key, config in SUBREDDITS.items():
        try:
            posts = await fetch_subreddit_new(token, config["subreddit"])
            stats["items_fetched"] += len(posts)

            for post in posts:
                # For r/iwantout, filter to UK-relevant posts only
                if config["filter_uk"]:
                    uk_keywords = ["uk", "united kingdom", "britain", "england", "scotland", "wales"]
                    text = (post["title"] + " " + (post.get("content_snippet") or "")).lower()
                    if not any(kw in text for kw in uk_keywords):
                        stats["items_filtered"] += 1
                        continue

                existing = supabase_client.table("intel_items").select("id").eq(
                    "source_url", post["source_url"]
                ).limit(1).execute()
                if existing.data:
                    continue

                supabase_client.table("intel_items").insert({
                    "title": post["title"],
                    "source_name": post["source_name"],
                    "source_url": post["source_url"],
                    "source_category": post["source_category"],
                    "published_at": post.get("published_at"),
                    "content_text": post.get("content_text"),
                    "content_snippet": post.get("content_snippet"),
                    "status": "raw",
                    "scanner_agent": "intel_scan_social",
                }).execute()
                stats["items_new"] += 1

        except Exception as e:
            logger.error(f"Failed scanning Reddit {key}: {e}")

    stats["duration_ms"] = int((time.time() - start) * 1000)
    return stats
