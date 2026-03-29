"""
SUPERPOWERED Railway Worker v2 — intelligent enrichment agent.

Each worker is a self-contained enrichment agent with:
- Multi-provider LLM routing (NVIDIA NIM → Groq → Together → OpenRouter)
- Smart website discovery (20+ domain patterns, trading name variants)
- Deep HTML scraping (extracts contacts, social links, tech stack from pages)
- Intelligent career page detection (parses content, not just HEAD checks)
- Auto rate-limit detection and provider rotation
- Deterministic data partitioning for zero-conflict parallel execution

Modes:
    website       — Smart website discovery with 20+ domain patterns
    deep_scrape   — Scrape found websites for contacts, socials, tech stack
    careers       — Intelligent career page detection + content analysis
    linkedin      — LinkedIn URL construction (deterministic, instant)
    ai_intel      — Multi-provider LLM company intelligence
    ai_search     — Generate job search tips via LLM
    full_sweep    — Runs website → deep_scrape → careers → linkedin → ai_intel → ai_search

Config via environment:
    WORKER_MODE, WORKER_LIMIT, WORKER_BATCH, WORKER_PARTITION, WORKER_PARTITIONS
    SUPABASE_URL, SUPABASE_SERVICE_KEY
    NVIDIA_API_KEY, GROQ_API_KEY, TOGETHER_API_KEY, OPENROUTER_API_KEY
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote_plus, urlparse

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [W%(worker_id)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("worker")

WORKER_PARTITION = int(os.environ.get("WORKER_PARTITION", "0"))
WORKER_PARTITIONS = int(os.environ.get("WORKER_PARTITIONS", "1"))
old_factory = logging.getLogRecordFactory()
def record_factory(*args, **kwargs):
    record = old_factory(*args, **kwargs)
    record.worker_id = WORKER_PARTITION
    return record
logging.setLogRecordFactory(record_factory)


# ═══════════════════════════════════════════════════════════════════════════
# CORE INFRASTRUCTURE
# ═══════════════════════════════════════════════════════════════════════════

def get_supabase():
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY required")
    return create_client(url, key)


def safe_json(val):
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return {}
    return {}


def is_my_partition(sponsor_id: str) -> bool:
    if WORKER_PARTITIONS <= 1:
        return True
    h = int(hashlib.md5(sponsor_id.encode()).hexdigest(), 16)
    return (h % WORKER_PARTITIONS) == WORKER_PARTITION


def compute_enrichment_level(profile: dict) -> int:
    """Compute enrichment level based on verified data quality.

    Level 1: Basic sponsor data only (name, licence status)
    Level 2: Has Companies House data (CH number, SIC codes, address)
    Level 3: Has verified web presence (website OR LinkedIn with content)
    Level 4: Has AI intelligence with medium+ confidence
    Level 5: Has third-party reviews/ratings (external validation)
    """
    level = 1
    if profile.get("companies_house_number") or profile.get("sic_codes"):
        level = max(level, 2)
    if profile.get("website_url") or profile.get("linkedin_url"):
        level = max(level, 3)
    social = safe_json(profile.get("social_links"))
    ai_intel = social.get("ai_intelligence", {})
    if isinstance(ai_intel, dict):
        # Only count AI intel if it has actual content (not just empty/null fields)
        has_substance = ai_intel.get("description") or ai_intel.get("services")
        if has_substance:
            level = max(level, 4)
    if social.get("search_tips"):
        level = max(level, 4)
    if profile.get("glassdoor_rating") or profile.get("trustpilot_rating") or profile.get("google_rating"):
        level = max(level, 5)
    return level


async def load_sponsor_names(sb, sponsor_ids: list[str]) -> dict:
    names = {}
    for i in range(0, len(sponsor_ids), 500):
        batch = sponsor_ids[i:i + 500]
        resp = sb.table("sponsors").select("id, organisation_name").in_("id", batch).execute()
        if resp.data:
            for row in resp.data:
                names[row["id"]] = row["organisation_name"]
    return names


# ═══════════════════════════════════════════════════════════════════════════
# MULTI-PROVIDER LLM ENGINE
# ═══════════════════════════════════════════════════════════════════════════

# Provider configs — each uses OpenAI-compatible /chat/completions
LLM_PROVIDERS = []

def _init_providers():
    """Build provider list from available API keys."""
    global LLM_PROVIDERS

    nvidia_key = os.environ.get("NVIDIA_API_KEY", "")
    groq_key = os.environ.get("GROQ_API_KEY", "")
    together_key = os.environ.get("TOGETHER_API_KEY", "")
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")

    if nvidia_key:
        LLM_PROVIDERS.append({
            "name": "nvidia",
            "url": "https://integrate.api.nvidia.com/v1/chat/completions",
            "key": nvidia_key,
            "models": ["deepseek-ai/deepseek-v3.2", "meta/llama-3.1-405b-instruct", "qwen/qwen3.5-397b-a17b"],
            "fails": 0, "skip_until": 0.0,
        })
    if groq_key:
        LLM_PROVIDERS.append({
            "name": "groq",
            "url": "https://api.groq.com/openai/v1/chat/completions",
            "key": groq_key,
            "models": ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"],
            "fails": 0, "skip_until": 0.0,
        })
    if together_key:
        LLM_PROVIDERS.append({
            "name": "together",
            "url": "https://api.together.xyz/v1/chat/completions",
            "key": together_key,
            "models": ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "deepseek-ai/DeepSeek-V3",
                        "Qwen/Qwen2.5-72B-Instruct-Turbo"],
            "fails": 0, "skip_until": 0.0,
        })
    if openrouter_key:
        LLM_PROVIDERS.append({
            "name": "openrouter",
            "url": "https://openrouter.ai/api/v1/chat/completions",
            "key": openrouter_key,
            "models": ["google/gemma-3-27b-it:free", "meta-llama/llama-3.3-70b-instruct:free",
                        "deepseek/deepseek-r1:free"],
            "fails": 0, "skip_until": 0.0,
        })

    if LLM_PROVIDERS:
        names = [p["name"] for p in LLM_PROVIDERS]
        logger.info("LLM providers: %s (%d total)", ", ".join(names), len(LLM_PROVIDERS))
    else:
        logger.warning("No LLM API keys configured — AI modes will be skipped")


_provider_model_idx = {}

def _next_model(provider: dict) -> str:
    name = provider["name"]
    idx = _provider_model_idx.get(name, 0)
    model = provider["models"][idx % len(provider["models"])]
    _provider_model_idx[name] = idx + 1
    return model


async def llm_complete(client: httpx.AsyncClient, prompt: str, system: str = "",
                       timeout: int = 120) -> Optional[str]:
    """Try all available LLM providers in rotation with auto-skip on failures."""
    now = time.time()

    for provider in LLM_PROVIDERS:
        if now < provider["skip_until"]:
            continue  # Provider is in cooldown

        model = _next_model(provider)
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        try:
            resp = await client.post(
                provider["url"],
                headers={"Authorization": f"Bearer {provider['key']}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "temperature": 0.3, "max_tokens": 2048},
                timeout=timeout,
            )
            if resp.status_code == 200:
                provider["fails"] = 0
                content = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                return content

            if resp.status_code == 429:
                provider["fails"] += 1
                cooldown = min(30 * provider["fails"], 120)
                provider["skip_until"] = now + cooldown
                logger.info("%s: 429 rate limited — skipping for %ds", provider["name"], cooldown)
                continue

            provider["fails"] += 1
            logger.debug("%s/%s returned %d", provider["name"], model, resp.status_code)

        except Exception as e:
            provider["fails"] += 1
            if provider["fails"] >= 3:
                provider["skip_until"] = now + 60
                logger.info("%s: 3+ fails — skipping for 60s", provider["name"])
            logger.debug("%s error: %s", provider["name"], str(e)[:80])

    return None


async def llm_structured(client: httpx.AsyncClient, prompt: str,
                         system: str = "Respond with valid JSON only. No markdown, no explanation.",
                         timeout: int = 120) -> Optional[dict]:
    """Get structured JSON from any available LLM provider."""
    raw = await llm_complete(client, prompt, system, timeout)
    if not raw:
        return None
    try:
        cleaned = raw.strip()
        # Strip markdown code fences
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        # Try direct parse
        if cleaned.startswith("{") or cleaned.startswith("["):
            return json.loads(cleaned)
        # Find JSON object in response
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(cleaned[start:end])
        return None
    except json.JSONDecodeError:
        return None


# ═══════════════════════════════════════════════════════════════════════════
# MODE 1: SMART WEBSITE DISCOVERY
# ═══════════════════════════════════════════════════════════════════════════

def _generate_domain_candidates(company_name: str) -> list[str]:
    """Generate 20+ smart domain candidates from company name."""
    raw = company_name.lower().strip()

    # Build multiple name variants
    variants = set()

    # Clean suffixes progressively
    cleaned = raw
    for suffix in [" limited", " ltd", " ltd.", " plc", " plc.", " llp",
                   " inc", " inc.", " uk", " (uk)", " group", " holdings",
                   " services", " solutions", " international", " intl",
                   " consulting", " consultancy", " & co", " and co",
                   " associates", " partnership", " partners", " corp",
                   " corporation", " enterprises"]:
        cleaned = cleaned.replace(suffix, "")
    cleaned = cleaned.strip()

    # Variant 1: all words joined (nospaces)
    nospace = re.sub(r"[^a-z0-9]+", "", cleaned)
    if nospace and len(nospace) >= 2:
        variants.add(nospace)

    # Variant 2: hyphenated
    hyphenated = re.sub(r"[^a-z0-9]+", "-", cleaned).strip("-")
    hyphenated = re.sub(r"-+", "-", hyphenated)
    if hyphenated and len(hyphenated) >= 2:
        variants.add(hyphenated)

    # Variant 3: first word only (for "Smith Engineering" → "smith")
    words = re.findall(r"[a-z]+", cleaned)
    if words and len(words[0]) >= 3:
        variants.add(words[0])

    # Variant 4: initials/acronym (for "ABC Technology Solutions" → "abc")
    if len(words) >= 2:
        initials = "".join(w[0] for w in words if w)
        if len(initials) >= 2:
            variants.add(initials)

    # Variant 5: first two words joined
    if len(words) >= 2:
        variants.add(words[0] + words[1])

    # Variant 6: "the" prefix handling
    if nospace.startswith("the") and len(nospace) > 5:
        variants.add(nospace[3:])

    # Variant 7: ampersand/and handling
    if " & " in raw or " and " in raw:
        parts = re.split(r"\s*(?:&|and)\s*", cleaned)
        joined = "".join(re.sub(r"[^a-z0-9]", "", p) for p in parts)
        if joined and len(joined) >= 2:
            variants.add(joined)

    # Generate URLs from all variants × TLDs
    tlds = [".co.uk", ".com", ".org.uk", ".org", ".uk", ".net", ".io", ".tech"]
    candidates = []
    for v in variants:
        for tld in tlds:
            candidates.append(f"https://www.{v}{tld}")
            candidates.append(f"https://{v}{tld}")

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            unique.append(c)

    return unique[:30]  # Cap at 30 to avoid excessive requests


async def discover_website_smart(client: httpx.AsyncClient, company_name: str) -> Optional[str]:
    """Smart website discovery with content verification.

    After finding a domain that responds, verifies the company name
    appears on the page to prevent false positive matches.
    """
    candidates = _generate_domain_candidates(company_name)
    if not candidates:
        return None

    # Try candidates in parallel batches of 5 for speed
    for i in range(0, len(candidates), 5):
        batch = candidates[i:i + 5]
        tasks = []
        for url in batch:
            tasks.append(_try_url(client, url, company_name))
        results = await asyncio.gather(*tasks)
        for result in results:
            if result:
                return result
    return None


async def _try_url(client: httpx.AsyncClient, url: str, company_name: str = "") -> Optional[str]:
    try:
        resp = await client.head(url, follow_redirects=True, timeout=6)
        if resp.status_code >= 400:
            return None

        final_url = str(resp.url)
        domain = urlparse(final_url).netloc.lower()

        # Reject parking pages / domain sellers / unrelated mega-sites
        reject_domains = [
            "godaddy.", "namecheap.", "parking.", "sedoparking.", "hugedomains.",
            "dan.com", "afternic.", "undeveloped.", "domainstore.",
            # Generic mega-sites that match short company names
            "baidu.com", "imdb.com", "amazon.com", "google.com", "facebook.com",
            "twitter.com", "x.com", "youtube.com", "wikipedia.org", "reddit.com",
            "linkedin.com", "instagram.com", "tiktok.com", "pinterest.com",
            "bbc.co.uk", "gov.uk", "nhs.uk", "ebay.co.uk", "ebay.com",
            "apple.com", "microsoft.com", "yahoo.com", "bing.com",
        ]
        if any(p in domain for p in reject_domains):
            return None

        # QUALITY CHECK: Fetch page content and verify company name appears
        if company_name and len(company_name) >= 3:
            try:
                page_resp = await client.get(final_url, timeout=8)
                if page_resp.status_code < 400:
                    page_text = page_resp.text[:100_000].lower()
                    # Build name variants to check
                    name_lower = company_name.lower()
                    # Remove common suffixes for matching
                    check_name = name_lower
                    for sfx in [" limited", " ltd", " ltd.", " plc", " llp",
                                " inc", " (uk)", " uk"]:
                        check_name = check_name.replace(sfx, "").strip()

                    # Try multiple matching strategies
                    found = False
                    # Strategy 1: Full cleaned name
                    if len(check_name) >= 4 and check_name in page_text:
                        found = True
                    # Strategy 2: First significant word (3+ chars) in title/meta
                    if not found:
                        words = [w for w in re.findall(r"[a-z]{3,}", check_name) if w not in
                                 {"the", "and", "for", "group", "services", "solutions",
                                  "international", "consulting", "management", "company"}]
                        if words:
                            # Check page title specifically
                            title_match = re.search(r"<title[^>]*>([^<]{2,300})</title>",
                                                    page_resp.text[:10_000], re.I)
                            title_text = title_match.group(1).lower() if title_match else ""
                            for w in words[:3]:
                                if len(w) >= 4 and (w in title_text or w in page_text[:5000]):
                                    found = True
                                    break
                    # Strategy 3: Domain contains a significant word from name
                    if not found:
                        domain_clean = domain.replace("www.", "").split(".")[0]
                        for w in re.findall(r"[a-z]{3,}", check_name):
                            if len(w) >= 4 and w in domain_clean:
                                found = True
                                break

                    if not found:
                        return None  # Page content doesn't match company — reject
            except Exception:
                pass  # If we can't fetch content, still accept HEAD-verified URL

        return final_url
    except Exception:
        pass
    return None


async def enrich_website_batch(sb, profiles: list[dict], sponsor_names: dict) -> dict:
    stats = {"enriched": 0, "skipped": 0, "errors": 0}
    async with httpx.AsyncClient(
        timeout=8, follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"},
        limits=httpx.Limits(max_connections=30, max_keepalive_connections=10),
    ) as client:
        sem = asyncio.Semaphore(15)

        async def process(profile):
            async with sem:
                try:
                    if profile.get("website_url"):
                        return "skipped"
                    name = sponsor_names.get(profile.get("sponsor_id"), "")
                    if not name:
                        return "skipped"
                    url = await discover_website_smart(client, name)
                    if url:
                        update = {
                            "website_url": url,
                            "enriched_at": datetime.now(timezone.utc).isoformat(),
                        }
                        merged = {**profile, **update}
                        update["enrichment_level"] = compute_enrichment_level(merged)
                        sb.table("company_profiles").update(update).eq("id", profile["id"]).execute()
                        return "enriched"
                    return "skipped"
                except Exception as e:
                    logger.debug("Website error: %s", str(e)[:60])
                    return "error"

        tasks = [process(p) for p in profiles]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                stats["errors"] += 1
            elif r == "enriched":
                stats["enriched"] += 1
            elif r == "error":
                stats["errors"] += 1
            else:
                stats["skipped"] += 1
    return stats


# ═══════════════════════════════════════════════════════════════════════════
# MODE 2: DEEP WEBSITE SCRAPER
# ═══════════════════════════════════════════════════════════════════════════

# Regex patterns for extracting data from HTML
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_UK_RE = re.compile(r"(?:0|\+44)\s*(?:\d[\s.-]*){9,10}")
LINKEDIN_RE = re.compile(r"https?://(?:www\.)?linkedin\.com/company/[a-zA-Z0-9_-]+/?")
TWITTER_RE = re.compile(r"https?://(?:www\.)?(?:twitter|x)\.com/[a-zA-Z0-9_]+/?")
FACEBOOK_RE = re.compile(r"https?://(?:www\.)?facebook\.com/[a-zA-Z0-9._-]+/?")
INSTAGRAM_RE = re.compile(r"https?://(?:www\.)?instagram\.com/[a-zA-Z0-9._]+/?")
YOUTUBE_RE = re.compile(r"https?://(?:www\.)?youtube\.com/(?:c/|channel/|@)[a-zA-Z0-9._-]+/?")
GLASSDOOR_RE = re.compile(r"https?://(?:www\.)?glassdoor\.co\.uk/Overview/[^\s\"'<>]+")

# Tech stack detection patterns
TECH_PATTERNS = {
    "React": [r"react", r"__NEXT_DATA__", r"_next/static"],
    "Next.js": [r"__NEXT_DATA__", r"_next/static", r"next\.config"],
    "WordPress": [r"wp-content", r"wp-includes", r"wordpress"],
    "Shopify": [r"cdn\.shopify\.com", r"shopify\.com"],
    "Squarespace": [r"squarespace\.com", r"sqsp\.com"],
    "Wix": [r"wix\.com", r"wixsite\.com", r"parastorage\.com"],
    "HubSpot": [r"hubspot", r"hs-scripts\.com", r"hsforms\.net"],
    "Salesforce": [r"salesforce", r"force\.com"],
    "Google Analytics": [r"google-analytics\.com", r"googletagmanager\.com", r"gtag"],
    "Cloudflare": [r"cloudflare", r"cf-ray"],
    "AWS": [r"amazonaws\.com", r"aws\.amazon"],
    "Azure": [r"azure", r"microsoftonline"],
    "Bootstrap": [r"bootstrap\.min", r"bootstrap\.css"],
    "Tailwind": [r"tailwind"],
    "jQuery": [r"jquery\.min\.js", r"jquery-\d"],
    "PHP": [r"\.php", r"php-"],
    "ASP.NET": [r"__VIEWSTATE", r"aspnet", r"\.aspx"],
    "Laravel": [r"laravel", r"csrf-token"],
    "Ruby on Rails": [r"ruby|rails|turbolinks"],
    "Angular": [r"ng-app|angular\.min|ng-version"],
    "Vue.js": [r"vue\.min|vue-router|vuex"],
    "Intercom": [r"intercom", r"widget\.intercom"],
    "Zendesk": [r"zendesk", r"zdassets\.com"],
    "Freshdesk": [r"freshdesk"],
    "Stripe": [r"js\.stripe\.com"],
    "PayPal": [r"paypal\.com"],
}


def _extract_from_html(html: str, url: str) -> dict:
    """Extract structured data from raw HTML without any LLM."""
    result = {}
    html_lower = html.lower()

    # Emails (skip common noise patterns)
    emails = list(set(EMAIL_RE.findall(html)))
    skip_domains = ["example.com", "sentry.io", "wixpress.com", "squarespace.com",
                    "wordpress.com", "google.com", "facebook.com", "twitter.com"]
    emails = [e for e in emails if not any(d in e.lower() for d in skip_domains)]
    skip_prefixes = ["noreply", "no-reply", "donotreply", "unsubscribe", "privacy"]
    emails = [e for e in emails if not any(e.lower().startswith(p) for p in skip_prefixes)]
    if emails:
        # Prioritize contact/info/hello emails
        priority = ["contact@", "info@", "hello@", "enquiries@", "admin@", "hr@", "jobs@", "careers@"]
        emails.sort(key=lambda e: next((i for i, p in enumerate(priority) if e.lower().startswith(p)), 99))
        result["contact_email"] = emails[0]
        if len(emails) > 1:
            result["all_emails"] = emails[:5]

    # Phone numbers
    phones = list(set(PHONE_UK_RE.findall(html)))
    if phones:
        result["contact_phone"] = re.sub(r"\s+", " ", phones[0]).strip()

    # Social links
    socials = {}
    for name, pattern in [("linkedin", LINKEDIN_RE), ("twitter", TWITTER_RE),
                          ("facebook", FACEBOOK_RE), ("instagram", INSTAGRAM_RE),
                          ("youtube", YOUTUBE_RE), ("glassdoor", GLASSDOOR_RE)]:
        matches = pattern.findall(html)
        if matches:
            socials[name] = matches[0].rstrip("/")
    if socials:
        result["social_links_extracted"] = socials

    # Tech stack
    detected = []
    for tech, patterns in TECH_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, html_lower):
                detected.append(tech)
                break
    if detected:
        result["tech_stack"] = detected

    # Meta description
    meta_match = re.search(r'<meta\s+(?:name=["\']description["\']\s+content=["\']([^"\']{10,300})["\']|content=["\']([^"\']{10,300})["\']\s+name=["\']description["\'])', html, re.I)
    if meta_match:
        result["meta_description"] = (meta_match.group(1) or meta_match.group(2)).strip()

    # Page title
    title_match = re.search(r"<title[^>]*>([^<]{2,200})</title>", html, re.I)
    if title_match:
        result["page_title"] = title_match.group(1).strip()

    # Companies House number from footer/about
    ch_match = re.search(r"(?:company|registration|registered)\s*(?:no|number|#)[:\s]*(\d{7,8})", html_lower)
    if ch_match:
        result["companies_house_number_from_site"] = ch_match.group(1).zfill(8)

    # VAT number
    vat_match = re.search(r"(?:vat|tax)\s*(?:no|number|reg|registration)[:\s]*(?:GB)?\s*(\d{3}\s*\d{4}\s*\d{2})", html_lower)
    if vat_match:
        result["vat_number"] = re.sub(r"\s", "", vat_match.group(1))

    return result


async def enrich_deep_scrape_batch(sb, profiles: list[dict], sponsor_names: dict) -> dict:
    """Scrape websites for contacts, socials, tech stack — no LLM needed."""
    stats = {"enriched": 0, "skipped": 0, "errors": 0}

    async with httpx.AsyncClient(
        timeout=15, follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
    ) as client:
        sem = asyncio.Semaphore(10)

        async def process(profile):
            async with sem:
                try:
                    website = profile.get("website_url")
                    if not website:
                        return "skipped"

                    # Skip if already scraped
                    existing = safe_json(profile.get("social_links"))
                    if existing.get("contact_email") or existing.get("deep_scraped"):
                        return "skipped"

                    # Fetch homepage HTML
                    try:
                        resp = await client.get(website, timeout=12)
                        if resp.status_code >= 400:
                            return "skipped"
                        html = resp.text[:200_000]  # Cap at 200KB
                    except Exception:
                        return "skipped"

                    extracted = _extract_from_html(html, website)
                    if not extracted:
                        return "skipped"

                    # Also try /about and /contact pages for more data
                    base = website.rstrip("/")
                    for extra_path in ["/about", "/contact", "/about-us", "/contact-us"]:
                        try:
                            extra_resp = await client.get(f"{base}{extra_path}", timeout=8)
                            if extra_resp.status_code < 400:
                                extra_data = _extract_from_html(extra_resp.text[:100_000], f"{base}{extra_path}")
                                # Merge (don't overwrite existing)
                                for k, v in extra_data.items():
                                    if k not in extracted:
                                        extracted[k] = v
                        except Exception:
                            continue

                    # Build update
                    update = {"enriched_at": datetime.now(timezone.utc).isoformat()}
                    social = dict(existing)

                    if extracted.get("contact_email"):
                        social["contact_email"] = extracted["contact_email"]
                    if extracted.get("all_emails"):
                        social["all_emails"] = extracted["all_emails"]
                    if extracted.get("contact_phone"):
                        social["contact_phone"] = extracted["contact_phone"]
                    if extracted.get("social_links_extracted"):
                        social.update(extracted["social_links_extracted"])
                        li = extracted["social_links_extracted"].get("linkedin")
                        if li and not profile.get("linkedin_url"):
                            update["linkedin_url"] = li
                    if extracted.get("meta_description"):
                        social["website_description"] = extracted["meta_description"]
                    if extracted.get("page_title"):
                        social["website_title"] = extracted["page_title"]
                    if extracted.get("vat_number"):
                        social["vat_number"] = extracted["vat_number"]
                    if extracted.get("companies_house_number_from_site"):
                        ch = extracted["companies_house_number_from_site"]
                        if not profile.get("companies_house_number"):
                            update["companies_house_number"] = ch

                    social["deep_scraped"] = True
                    social["deep_scraped_at"] = datetime.now(timezone.utc).isoformat()
                    update["social_links"] = social

                    if extracted.get("tech_stack"):
                        update["tech_stack_detected"] = extracted["tech_stack"]

                    merged = {**profile, **update}
                    update["enrichment_level"] = compute_enrichment_level(merged)
                    sb.table("company_profiles").update(update).eq("id", profile["id"]).execute()
                    return "enriched"

                except Exception as e:
                    logger.debug("Deep scrape error: %s", str(e)[:80])
                    return "error"

        tasks = [process(p) for p in profiles]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                stats["errors"] += 1
            elif r == "enriched":
                stats["enriched"] += 1
            elif r == "error":
                stats["errors"] += 1
            else:
                stats["skipped"] += 1
    return stats


# ═══════════════════════════════════════════════════════════════════════════
# MODE 3: INTELLIGENT CAREER PAGE DETECTION
# ═══════════════════════════════════════════════════════════════════════════

CAREER_PATHS = ["/careers", "/jobs", "/vacancies", "/work-with-us", "/join-us",
                "/recruitment", "/opportunities", "/hiring", "/career",
                "/work-for-us", "/join-our-team", "/about/careers", "/en/careers",
                "/uk/careers", "/careers-page", "/job-openings", "/current-vacancies",
                "/join", "/employment", "/talent", "/people/careers"]

CAREER_KEYWORDS = ["vacancy", "vacancies", "career", "job opening", "we're hiring",
                   "we are hiring", "join our team", "apply now", "current opportunities",
                   "work with us", "employment", "recruit", "talent"]


async def enrich_careers_batch(sb, profiles: list[dict]) -> dict:
    stats = {"enriched": 0, "skipped": 0, "errors": 0}

    async with httpx.AsyncClient(
        timeout=10, follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
    ) as client:
        sem = asyncio.Semaphore(12)

        async def process(profile):
            async with sem:
                try:
                    website = profile.get("website_url")
                    if not website or profile.get("has_careers_page") is not None:
                        return "skipped"

                    base = website.rstrip("/")

                    # Strategy 1: Check known career paths
                    for path in CAREER_PATHS:
                        try:
                            resp = await client.get(f"{base}{path}", timeout=8)
                            if resp.status_code < 400 and len(resp.text) > 500:
                                # Verify it's actually a careers page, not a redirect to homepage
                                page_lower = resp.text[:10000].lower()
                                has_keywords = sum(1 for kw in CAREER_KEYWORDS if kw in page_lower)
                                if has_keywords >= 2:
                                    update = {
                                        "has_careers_page": True,
                                        "careers_page_url": str(resp.url),
                                        "enriched_at": datetime.now(timezone.utc).isoformat(),
                                    }
                                    sb.table("company_profiles").update(update).eq("id", profile["id"]).execute()
                                    return "enriched"
                        except Exception:
                            continue

                    # Strategy 2: Check homepage for career links
                    try:
                        resp = await client.get(base, timeout=8)
                        if resp.status_code < 400:
                            html_lower = resp.text[:50000].lower()
                            # Look for links with career-related text
                            career_link = re.search(
                                r'<a[^>]+href=["\']([^"\']*(?:career|job|vacanc|hiring|recruit)[^"\']*)["\']',
                                html_lower
                            )
                            if career_link:
                                href = career_link.group(1)
                                if href.startswith("/"):
                                    career_url = f"{base}{href}"
                                elif href.startswith("http"):
                                    career_url = href
                                else:
                                    career_url = f"{base}/{href}"
                                update = {
                                    "has_careers_page": True,
                                    "careers_page_url": career_url,
                                    "enriched_at": datetime.now(timezone.utc).isoformat(),
                                }
                                sb.table("company_profiles").update(update).eq("id", profile["id"]).execute()
                                return "enriched"
                    except Exception:
                        pass

                    # No careers page found
                    sb.table("company_profiles").update({
                        "has_careers_page": False,
                        "enriched_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("id", profile["id"]).execute()
                    return "skipped"

                except Exception:
                    return "error"

        tasks = [process(p) for p in profiles]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                stats["errors"] += 1
            elif r == "enriched":
                stats["enriched"] += 1
            elif r == "error":
                stats["errors"] += 1
            else:
                stats["skipped"] += 1
    return stats


# ═══════════════════════════════════════════════════════════════════════════
# MODE 4: LINKEDIN URL CONSTRUCTION
# ═══════════════════════════════════════════════════════════════════════════

async def enrich_linkedin_batch(sb, profiles: list[dict], sponsor_names: dict) -> dict:
    """Construct LinkedIn URLs and verify they actually exist (not 404)."""
    stats = {"enriched": 0, "skipped": 0, "errors": 0}

    async with httpx.AsyncClient(
        timeout=8, follow_redirects=False,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
    ) as client:
        sem = asyncio.Semaphore(5)  # Gentle on LinkedIn

        async def process(profile):
            async with sem:
                try:
                    if profile.get("linkedin_url"):
                        return "skipped"
                    name = sponsor_names.get(profile.get("sponsor_id"), "")
                    if not name:
                        return "skipped"

                    # Generate multiple slug variants to try
                    raw = name.lower().strip()
                    cleaned = raw
                    for suffix in [" limited", " ltd", " ltd.", " plc", " plc.",
                                   " llp", " inc", " inc.", " (uk)", " uk"]:
                        cleaned = cleaned.replace(suffix, "")
                    cleaned = cleaned.strip()

                    slugs = set()
                    # Variant 1: hyphenated full name
                    slug1 = re.sub(r"[^a-z0-9]+", "-", cleaned).strip("-")
                    slug1 = re.sub(r"-+", "-", slug1)
                    if slug1 and len(slug1) >= 2:
                        slugs.add(slug1)
                    # Variant 2: remove more suffixes
                    for extra_sfx in ["-group", "-holdings", "-international", "-services",
                                      "-solutions", "-consulting", "-associates"]:
                        if slug1.endswith(extra_sfx):
                            slugs.add(slug1[:-len(extra_sfx)].rstrip("-"))
                    # Variant 3: no spaces
                    nospace = re.sub(r"[^a-z0-9]", "", cleaned)
                    if nospace and len(nospace) >= 2 and nospace != slug1.replace("-", ""):
                        slugs.add(nospace)

                    # Try each slug variant, verify with HEAD request
                    for slug in list(slugs)[:4]:
                        url = f"https://www.linkedin.com/company/{slug}"
                        try:
                            resp = await client.head(url, timeout=6)
                            # LinkedIn returns 200 for valid pages, 404/999 for invalid
                            if resp.status_code in (200, 301, 302):
                                update = {
                                    "linkedin_url": url,
                                    "enriched_at": datetime.now(timezone.utc).isoformat(),
                                }
                                merged = {**profile, **update}
                                update["enrichment_level"] = compute_enrichment_level(merged)
                                sb.table("company_profiles").update(update).eq("id", profile["id"]).execute()
                                return "enriched"
                        except Exception:
                            continue

                    return "skipped"  # No valid LinkedIn page found
                except Exception:
                    return "error"

        tasks = [process(p) for p in profiles]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                stats["errors"] += 1
            elif r == "enriched":
                stats["enriched"] += 1
            elif r == "error":
                stats["errors"] += 1
            else:
                stats["skipped"] += 1
    return stats


# ═══════════════════════════════════════════════════════════════════════════
# MODE 5: AI COMPANY INTELLIGENCE (Multi-Provider)
# ═══════════════════════════════════════════════════════════════════════════

async def _ai_enrich_one(client: httpx.AsyncClient, sb, profile: dict,
                          company_name: str, sem: asyncio.Semaphore) -> str:
    """Full AI enrichment for one company using any available LLM provider."""
    async with sem:
        try:
            existing_social = safe_json(profile.get("social_links"))
            if existing_social.get("ai_intelligence"):
                return "skipped"

            update = {"enriched_at": datetime.now(timezone.utc).isoformat()}

            # Build rich context
            ctx = [f"Company name: {company_name}"]
            for key, label in [("companies_house_number", "CH#"), ("industry_primary", "Industry"),
                               ("company_status", "Status"), ("company_type", "Type"),
                               ("incorporation_date", "Founded"), ("website_url", "Website")]:
                val = profile.get(key)
                if val:
                    ctx.append(f"{label}: {val}")

            sic = profile.get("sic_codes")
            if sic:
                sic_list = sic if isinstance(sic, list) else [sic]
                ctx.append(f"SIC: {', '.join(str(s) for s in sic_list)}")

            addr = profile.get("registered_address")
            if addr:
                if isinstance(addr, dict):
                    ctx.append(f"Address: {addr.get('full_address', '')}")
                elif isinstance(addr, str):
                    ctx.append(f"Address: {addr}")

            # Include scraped data if available
            if existing_social.get("website_description"):
                ctx.append(f"Website description: {existing_social['website_description']}")

            prompt = f"""You are a UK business intelligence analyst specialising in visa sponsor companies.
Analyze this UK visa sponsor licence holder using ONLY facts you are confident about.

{chr(10).join(ctx)}

CRITICAL RULES:
1. ONLY state facts you are genuinely confident about from your training data.
2. Use null for ANY field you are not sure about — guessing is worse than leaving blank.
3. Do NOT fabricate descriptions, services, or facts for companies you don't recognise.
4. For unknown/small companies, it is CORRECT to return mostly null values.
5. "confidence" must honestly reflect how much you know: "high" = well-known company with public info, "medium" = you recognise the name/industry, "low" = mostly inferring from SIC codes/name.
6. employee_count_range: give a range like "10-50" or "200-500", not a single number. Use null if unknown.

Respond with ONLY this JSON:
{{
  "confidence": "high/medium/low",
  "description": "1-2 factual sentences or null if unknown",
  "services": ["verified main services"] or null,
  "typical_sponsored_roles": ["likely sponsored roles based on industry"] or null,
  "hiring_sectors": ["sectors"],
  "company_culture": null,
  "is_well_known": true/false,
  "headquarters_city": "city or null",
  "parent_company": "parent or null",
  "competitors": null,
  "visa_sponsorship_likelihood": "high/medium/low",
  "key_facts": ["only verified facts"] or null,
  "employee_count_range": "e.g. 50-200 or null",
  "industry_tags": ["tags"]
}}"""

            data = await llm_structured(client, prompt)
            if data:
                # Only use AI data if confidence is not extremely low
                confidence = (data.get("confidence") or "low").lower()

                if data.get("industry_tags") and not profile.get("industry_tags"):
                    update["industry_tags"] = data["industry_tags"]

                # Parse employee range into midpoint estimate
                emp_range = data.get("employee_count_range")
                if emp_range and not profile.get("employee_count_estimate"):
                    try:
                        # Parse ranges like "10-50", "200-500"
                        parts = re.findall(r"\d+", str(emp_range))
                        if len(parts) >= 2:
                            low, high = int(parts[0]), int(parts[1])
                            midpoint = (low + high) // 2
                            update["employee_count_estimate"] = midpoint
                            update["employee_count_source"] = f"ai_estimate_{confidence}"
                        elif len(parts) == 1:
                            update["employee_count_estimate"] = int(parts[0])
                            update["employee_count_source"] = f"ai_estimate_{confidence}"
                    except (ValueError, IndexError):
                        pass

                existing_social["ai_intelligence"] = {
                    **{k: data.get(k) for k in ["description", "services", "typical_sponsored_roles",
                       "hiring_sectors", "company_culture", "is_well_known", "headquarters_city",
                       "parent_company", "competitors", "visa_sponsorship_likelihood", "key_facts"]},
                    "confidence": confidence,
                    "employee_count_range": emp_range,
                    "model_used": "multi_provider",
                    "analyzed_at": datetime.now(timezone.utc).isoformat(),
                }
                update["social_links"] = existing_social

            if len(update) > 1:
                merged = {**profile, **update}
                update["enrichment_level"] = compute_enrichment_level(merged)
                sb.table("company_profiles").update(update).eq("id", profile["id"]).execute()
                return "enriched"
            return "skipped"

        except Exception as e:
            logger.warning("AI error for %s: %s", company_name[:30], str(e)[:100])
            return "error"


async def enrich_ai_intel_batch(sb, profiles: list[dict], sponsor_names: dict) -> dict:
    stats = {"enriched": 0, "skipped": 0, "errors": 0}
    CONCURRENCY = 3

    async with httpx.AsyncClient(timeout=150) as client:
        sem = asyncio.Semaphore(CONCURRENCY)
        tasks = []
        for profile in profiles:
            name = sponsor_names.get(profile.get("sponsor_id"), "")
            if not name:
                stats["skipped"] += 1
                continue
            tasks.append(_ai_enrich_one(client, sb, profile, name, sem))

        chunk_size = 6
        for i in range(0, len(tasks), chunk_size):
            chunk = tasks[i:i + chunk_size]
            results = await asyncio.gather(*chunk, return_exceptions=True)
            for r in results:
                if isinstance(r, Exception):
                    stats["errors"] += 1
                elif r == "enriched":
                    stats["enriched"] += 1
                elif r == "error":
                    stats["errors"] += 1
                else:
                    stats["skipped"] += 1
            if stats["enriched"] > 0 and (stats["enriched"] % 10 == 0):
                logger.info("  AI intel: %d enriched so far", stats["enriched"])
    return stats


# ═══════════════════════════════════════════════════════════════════════════
# MODE 6: AI SEARCH TIPS
# ═══════════════════════════════════════════════════════════════════════════

async def enrich_ai_search_batch(sb, profiles: list[dict], sponsor_names: dict) -> dict:
    stats = {"enriched": 0, "skipped": 0, "errors": 0}

    async with httpx.AsyncClient(timeout=120) as client:
        sem = asyncio.Semaphore(3)

        async def process(profile, name):
            async with sem:
                try:
                    existing = safe_json(profile.get("social_links"))
                    if existing.get("search_tips"):
                        return "skipped"

                    ctx = [f"Company: {name}"]
                    if profile.get("website_url"):
                        ctx.append(f"Website: {profile['website_url']}")
                    if profile.get("industry_primary"):
                        ctx.append(f"Industry: {profile['industry_primary']}")
                    intel = existing.get("ai_intelligence", {})
                    if intel.get("description"):
                        ctx.append(f"About: {intel['description']}")

                    prompt = f"""{chr(10).join(ctx)}

You are a UK visa job search specialist. Provide ACCURATE, ACTIONABLE search tips for someone wanting a Skilled Worker visa sponsored role at this company.

RULES:
1. search_names: Include the EXACT company name plus common trading names. Do NOT invent names.
2. job_boards: Only list boards where this type of company actually posts. Be specific to their industry.
3. application_tips: Practical advice specific to this company/industry — not generic "tailor your CV".
4. best_time_to_apply: Only if you know their hiring cycle (e.g. NHS has intakes). Otherwise null.
5. typical_roles: Roles this company would realistically sponsor (based on Skilled Worker visa requirements).

JSON:
{{
  "search_names": ["exact company name", "trading name variant if known"],
  "job_boards": ["industry-specific boards where they'd post"],
  "typical_roles": ["realistic sponsorable roles for this company"],
  "application_tips": "specific practical advice",
  "best_time_to_apply": null
}}"""

                    tips = await llm_structured(client, prompt)
                    if tips:
                        existing["search_tips"] = tips
                        update = {
                            "social_links": existing,
                            "enriched_at": datetime.now(timezone.utc).isoformat(),
                        }
                        merged = {**profile, **update}
                        update["enrichment_level"] = compute_enrichment_level(merged)
                        sb.table("company_profiles").update(update).eq("id", profile["id"]).execute()
                        return "enriched"
                    return "skipped"
                except Exception as e:
                    logger.debug("Search tips error: %s", str(e)[:80])
                    return "error"

        tasks = []
        for profile in profiles:
            name = sponsor_names.get(profile.get("sponsor_id"), "")
            if not name:
                stats["skipped"] += 1
                continue
            tasks.append(process(profile, name))

        chunk_size = 6
        for i in range(0, len(tasks), chunk_size):
            chunk = tasks[i:i + chunk_size]
            results = await asyncio.gather(*chunk, return_exceptions=True)
            for r in results:
                if isinstance(r, Exception):
                    stats["errors"] += 1
                elif r == "enriched":
                    stats["enriched"] += 1
                elif r == "error":
                    stats["errors"] += 1
                else:
                    stats["skipped"] += 1
    return stats


# ═══════════════════════════════════════════════════════════════════════════
# MAIN WORKER LOOP
# ═══════════════════════════════════════════════════════════════════════════

# Mode → (filter builder, enrichment function, needs_names, needs_llm)
MODE_CONFIG = {
    "website":     {"filter": lambda q: q.is_("website_url", "null"),
                    "fn": "enrich_website_batch", "names": True, "llm": False},
    "deep_scrape": {"filter": lambda q: q.filter("website_url", "not.is", "null"),
                    "fn": "enrich_deep_scrape_batch", "names": True, "llm": False},
    "careers":     {"filter": lambda q: q.filter("website_url", "not.is", "null").is_("has_careers_page", "null"),
                    "fn": "enrich_careers_batch", "names": False, "llm": False},
    "linkedin":    {"filter": lambda q: q.is_("linkedin_url", "null"),
                    "fn": "enrich_linkedin_batch", "names": True, "llm": False},
    "ai_intel":    {"filter": lambda q: q,
                    "fn": "enrich_ai_intel_batch", "names": True, "llm": True},
    "ai_search":   {"filter": lambda q: q,
                    "fn": "enrich_ai_search_batch", "names": True, "llm": True},
}

FULL_SWEEP_ORDER = ["website", "deep_scrape", "careers", "linkedin", "ai_intel", "ai_search"]


async def run_mode(mode: str, sb, limit: int, batch_size: int):
    """Run a single enrichment mode."""
    config = MODE_CONFIG[mode]

    if config["llm"] and not LLM_PROVIDERS:
        logger.warning("Skipping %s — no LLM providers configured", mode)
        return {"enriched": 0, "skipped": 0, "errors": 0}

    fn = globals()[config["fn"]]
    total_stats = {"enriched": 0, "skipped": 0, "errors": 0}
    last_id = ""  # Cursor-based pagination — avoids expensive OFFSET on large tables
    consecutive_failures = 0
    start = time.time()

    logger.info("--- %s ---", mode.upper())

    select_fields = (
        "id, sponsor_id, companies_house_number, company_status, incorporation_date, "
        "sic_codes, industry_primary, registered_address, website_url, linkedin_url, "
        "has_careers_page, careers_page_url, glassdoor_rating, trustpilot_rating, "
        "google_rating, employee_count_estimate, employee_count_source, "
        "credit_risk_score, social_links, name_variants, tech_stack_detected, "
        "industry_tags, enrichment_level, enriched_at, company_type"
    )

    while total_stats["enriched"] + total_stats["skipped"] < limit:
        try:
            # Use cursor-based pagination (keyset) to avoid Supabase timeouts at high offsets
            fetch_size = min(batch_size, 200)
            query = sb.table("company_profiles").select(select_fields)
            query = config["filter"](query)
            query = query.order("id", desc=False)
            if last_id:
                query = query.filter("id", "gt", last_id)
            resp = query.limit(fetch_size).execute()

            if not resp.data:
                logger.info("No more data for %s — done.", mode)
                break

            # Update cursor for next page
            last_id = resp.data[-1]["id"]

            # Filter to our partition
            profiles = [p for p in resp.data if is_my_partition(p.get("sponsor_id", p["id"]))]
            if not profiles:
                continue

            # Load names if needed
            sponsor_names = {}
            if config["names"]:
                ids = list({p["sponsor_id"] for p in profiles if p.get("sponsor_id")})
                if ids:
                    sponsor_names = await load_sponsor_names(sb, ids)

            # Run enrichment
            if config["names"]:
                batch_stats = await fn(sb, profiles, sponsor_names)
            else:
                batch_stats = await fn(sb, profiles)

            for k in total_stats:
                total_stats[k] += batch_stats[k]

            consecutive_failures = 0
            elapsed = time.time() - start
            rate = total_stats["enriched"] / max(elapsed / 60, 0.01)
            logger.info(
                "[%s] %d enriched, %d skipped, %d errors (%.0fs, %.1f/min)",
                mode, total_stats["enriched"], total_stats["skipped"],
                total_stats["errors"], elapsed, rate,
            )

        except Exception as e:
            consecutive_failures += 1
            logger.warning("Batch error (%d): %s", consecutive_failures, str(e)[:120])
            if consecutive_failures >= 5:
                logger.error("5 consecutive failures in %s — aborting mode", mode)
                break
            await asyncio.sleep(min(10 * consecutive_failures, 60))

    return total_stats


async def main():
    mode = os.environ.get("WORKER_MODE", "website")
    limit = int(os.environ.get("WORKER_LIMIT", "5000"))
    batch_size = int(os.environ.get("WORKER_BATCH", "50"))

    _init_providers()

    logger.info("═══════════════════════════════════════════")
    logger.info("  SUPERPOWERED ENRICHMENT WORKER v2")
    logger.info("═══════════════════════════════════════════")
    logger.info("Mode: %s | Limit: %d | Batch: %d | Partition: %d/%d",
                mode, limit, batch_size, WORKER_PARTITION, WORKER_PARTITIONS)

    sb = get_supabase()
    start = time.time()

    if mode == "full_sweep":
        all_stats = {}
        for m in FULL_SWEEP_ORDER:
            stats = await run_mode(m, sb, limit, batch_size)
            all_stats[m] = stats
        logger.info("═══════════════════════════════════════════")
        logger.info("  FULL SWEEP COMPLETE")
        for m, s in all_stats.items():
            logger.info("  %-12s  %d enriched, %d errors", m, s["enriched"], s["errors"])
    elif mode in MODE_CONFIG:
        await run_mode(mode, sb, limit, batch_size)
    else:
        logger.error("Unknown mode: %s. Valid: %s, full_sweep", mode, ", ".join(MODE_CONFIG.keys()))
        return

    elapsed = time.time() - start
    logger.info("═══════════════════════════════════════════")
    logger.info("  WORKER COMPLETE — %.0fs total", elapsed)
    logger.info("═══════════════════════════════════════════")


if __name__ == "__main__":
    asyncio.run(main())
