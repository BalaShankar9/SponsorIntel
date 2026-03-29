"""
Mega Company Enrichment Pipeline.

Multi-source enrichment engine that fills every data point for sponsor companies:

1. Companies House API — directors, SIC codes, accounts, charges, addresses
2. LinkedIn URL construction — deterministic from company name + domain
3. Website discovery — HTTP HEAD on common domain patterns
4. Career page detection — check /careers, /jobs, /vacancies etc.
5. Ollama LLM intelligence — extract structured data from web pages,
   generate descriptions, classify companies beyond SIC codes

Processes companies in batches, prioritizing least-enriched first.
Designed to be run repeatedly — each run fills in more data.

Usage:
    python -m app.scripts.enrich_companies [--limit 500] [--batch-size 50]
    python -m app.scripts.enrich_companies --mode website --limit 1000
    python -m app.scripts.enrich_companies --mode linkedin --limit 5000
    python -m app.scripts.enrich_companies --mode careers --limit 500
    python -m app.scripts.enrich_companies --mode ollama --limit 200
    python -m app.scripts.enrich_companies --mode all --limit 500
"""

import argparse
import asyncio
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
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("enrichment")


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

async def get_supabase():
    """Get Supabase client with service role key (required for writes)."""
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)


# ---------------------------------------------------------------------------
# Companies House API
# ---------------------------------------------------------------------------

CH_BASE = "https://api.company-information.service.gov.uk"

SIC_MAP = {
    "01": "Agriculture", "02": "Forestry", "03": "Fishing",
    "05": "Mining", "06": "Oil & Gas", "07": "Metal Ores", "08": "Quarrying",
    "10": "Food Manufacturing", "11": "Beverages", "13": "Textiles",
    "14": "Clothing", "15": "Leather", "16": "Wood Products",
    "17": "Paper", "18": "Printing", "19": "Petroleum",
    "20": "Chemicals", "21": "Pharmaceuticals", "22": "Rubber & Plastics",
    "23": "Non-metallic Minerals", "24": "Metals", "25": "Metal Products",
    "26": "Electronics", "27": "Electrical Equipment", "28": "Machinery",
    "29": "Motor Vehicles", "30": "Transport Equipment",
    "31": "Furniture", "32": "Other Manufacturing", "33": "Repair & Installation",
    "35": "Energy & Utilities", "36": "Water Supply", "37": "Sewerage",
    "38": "Waste Management", "39": "Remediation",
    "41": "Construction", "42": "Civil Engineering", "43": "Specialist Construction",
    "45": "Motor Trade", "46": "Wholesale", "47": "Retail",
    "49": "Land Transport", "50": "Water Transport", "51": "Air Transport",
    "52": "Warehousing & Logistics", "53": "Postal & Courier",
    "55": "Accommodation", "56": "Food & Drink Services",
    "58": "Publishing", "59": "Film & TV", "60": "Broadcasting",
    "61": "Telecommunications", "62": "IT & Software", "63": "Data & Information",
    "64": "Financial Services", "65": "Insurance", "66": "Financial Support",
    "68": "Real Estate",
    "69": "Legal & Accounting", "70": "Management Consultancy",
    "71": "Architecture & Engineering", "72": "Scientific R&D",
    "73": "Advertising & Market Research", "74": "Professional Services",
    "75": "Veterinary", "77": "Rental & Leasing",
    "78": "Recruitment", "79": "Travel & Tourism",
    "80": "Security", "81": "Facilities Management", "82": "Office Support",
    "84": "Public Administration", "85": "Education",
    "86": "Healthcare", "87": "Residential Care", "88": "Social Work",
    "90": "Arts & Entertainment", "91": "Libraries & Museums",
    "92": "Gambling", "93": "Sports & Recreation",
    "94": "Membership Organisations", "95": "Repair Services",
    "96": "Personal Services", "97": "Domestic Employment",
    "99": "International Organisations",
}


def classify_sic(sic_codes: list[str]) -> Optional[str]:
    if not sic_codes:
        return None
    for code in sic_codes:
        if not code or code == "None Supplied":
            continue
        prefix = code[:2]
        if prefix in SIC_MAP:
            return SIC_MAP[prefix]
    return None


def extract_address(addr: dict) -> Optional[str]:
    if not addr:
        return None
    parts = []
    for key in ["premises", "address_line_1", "address_line_2", "locality", "region", "postal_code", "country"]:
        val = addr.get(key)
        if val and val.strip():
            parts.append(val.strip())
    return ", ".join(parts) if parts else None


async def ch_get(client: httpx.AsyncClient, path: str, api_key: str) -> Optional[dict]:
    try:
        resp = await client.get(
            f"{CH_BASE}{path}",
            auth=(api_key, ""),
            timeout=15,
        )
        if resp.status_code == 200:
            return resp.json()
        if resp.status_code == 429:
            logger.warning("CH rate limited, sleeping 5s...")
            await asyncio.sleep(5)
        return None
    except Exception as e:
        logger.debug("CH API error for %s: %s", path, str(e)[:60])
        return None


async def enrich_from_ch(client: httpx.AsyncClient, ch_number: str, api_key: str) -> dict:
    """Fetch all available data from Companies House for a company number."""
    result = {}

    profile = await ch_get(client, f"/company/{ch_number}", api_key)
    if not profile:
        return result

    result["company_status"] = profile.get("company_status", "").replace("-", " ").title() or None
    result["company_type"] = profile.get("type", "").replace("-", " ").title() or None
    result["incorporation_date"] = profile.get("date_of_creation")

    sic_codes = profile.get("sic_codes") or []
    if sic_codes:
        result["sic_codes"] = sic_codes
        result["industry_primary"] = classify_sic(sic_codes)

    reg_addr = profile.get("registered_office_address")
    if reg_addr:
        result["registered_address"] = {
            "full_address": extract_address(reg_addr),
            "postcode": reg_addr.get("postal_code"),
            "locality": reg_addr.get("locality"),
            "region": reg_addr.get("region"),
            "country": reg_addr.get("country"),
        }

    accounts = profile.get("accounts") or {}
    last_acct = accounts.get("last_accounts") or {}
    result["last_accounts_date"] = last_acct.get("made_up_to")
    result["next_accounts_due"] = accounts.get("next_due")
    result["accounts_overdue"] = accounts.get("overdue", False)

    conf = profile.get("confirmation_statement") or {}
    result["confirmation_statement_overdue"] = conf.get("overdue", False)

    result["has_charges"] = profile.get("has_charges", False)
    result["has_insolvency_history"] = profile.get("has_insolvency_history", False)

    # Officers (directors)
    await asyncio.sleep(0.2)
    officers = await ch_get(client, f"/company/{ch_number}/officers?items_per_page=50", api_key)
    if officers and officers.get("items"):
        directors = []
        for officer in officers["items"][:20]:
            if officer.get("resigned_on"):
                continue
            directors.append({
                "name": officer.get("name", ""),
                "role": officer.get("officer_role", "").replace("-", " ").title(),
                "appointed_on": officer.get("appointed_on"),
                "nationality": officer.get("nationality"),
                "occupation": officer.get("occupation"),
            })
        if directors:
            result["directors"] = directors

    # Charges count
    if result.get("has_charges"):
        await asyncio.sleep(0.2)
        charges = await ch_get(client, f"/company/{ch_number}/charges", api_key)
        if charges:
            result["charge_count"] = charges.get("total_count", 0)

    return result


# ---------------------------------------------------------------------------
# LinkedIn URL construction
# ---------------------------------------------------------------------------

def normalize_for_linkedin(name: str) -> str:
    """Convert company name to LinkedIn slug format."""
    n = name.lower().strip()
    # Remove trading-as and everything after
    n = re.split(r'\s+t/a\s+|\s+trading as\s+', n, flags=re.IGNORECASE)[0]
    # Remove legal suffixes
    for suffix in [" limited", " ltd", " ltd.", " plc", " llp", " lp", " inc",
                   " inc.", " llc", " corporation", " corp", " corp.",
                   " co.", " co", " cic", " c.i.c", " c.i.c.",
                   " uk", " (uk)", " group", " holdings", " international"]:
        if n.endswith(suffix):
            n = n[:-len(suffix)]
    # LinkedIn slug: lowercase, hyphens for spaces, remove special chars
    n = re.sub(r'[^a-z0-9\s]', '', n)
    n = re.sub(r'\s+', '-', n.strip())
    return n


def construct_linkedin_url(company_name: str, domain: Optional[str] = None) -> str:
    """Construct likely LinkedIn company URL from name."""
    slug = normalize_for_linkedin(company_name)
    if not slug:
        return ""
    return f"https://www.linkedin.com/company/{slug}"


async def verify_linkedin_url(client: httpx.AsyncClient, url: str) -> bool:
    """Verify LinkedIn URL exists with a HEAD request."""
    if not url:
        return False
    try:
        resp = await client.head(
            url,
            follow_redirects=True,
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0 (compatible; SponsorIntel/1.0)"},
        )
        # LinkedIn returns 200 for valid company pages, 404/999 for invalid
        return resp.status_code == 200
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Website discovery
# ---------------------------------------------------------------------------

def generate_domain_candidates(company_name: str) -> list[str]:
    """Generate candidate domain names from company name."""
    n = company_name.lower().strip()
    # Remove trading-as
    n = re.split(r'\s+t/a\s+|\s+trading as\s+', n, flags=re.IGNORECASE)[0]
    # Remove legal suffixes
    for suffix in [" limited", " ltd", " ltd.", " plc", " llp", " lp", " inc",
                   " inc.", " llc", " corporation", " corp", " corp.",
                   " co.", " co", " cic", " c.i.c", " c.i.c.",
                   " uk", " (uk)", " group", " holdings", " international"]:
        if n.endswith(suffix):
            n = n[:-len(suffix)]
    # Clean for domain
    clean = re.sub(r'[^a-z0-9\s]', '', n).strip()
    words = clean.split()

    candidates = []
    if not words:
        return candidates

    # Full name joined
    joined = "".join(words)
    hyphenated = "-".join(words)

    # Try various TLDs with both joined and hyphenated
    for name in [joined, hyphenated]:
        for tld in [".co.uk", ".com", ".org.uk", ".org", ".uk", ".net"]:
            candidates.append(f"https://www.{name}{tld}")
            candidates.append(f"https://{name}{tld}")

    # Also try first word only if multi-word (e.g., "Barclays" from "Barclays Bank")
    if len(words) > 1:
        first = words[0]
        if len(first) >= 4:  # Avoid too-short matches
            for tld in [".co.uk", ".com"]:
                candidates.append(f"https://www.{first}{tld}")

    # Try acronym for long names (e.g., "BAE" from "British Aerospace Engineering")
    if len(words) >= 3:
        acronym = "".join(w[0] for w in words if w)
        if len(acronym) >= 3:
            for tld in [".co.uk", ".com"]:
                candidates.append(f"https://www.{acronym}{tld}")

    return candidates


async def discover_website(client: httpx.AsyncClient, company_name: str) -> Optional[str]:
    """Try to discover company website via HTTP HEAD on candidate domains."""
    candidates = generate_domain_candidates(company_name)

    for url in candidates[:12]:  # Limit attempts
        try:
            resp = await client.head(
                url,
                follow_redirects=True,
                timeout=8,
                headers={"User-Agent": "Mozilla/5.0 (compatible; SponsorIntel/1.0)"},
            )
            if resp.status_code == 200:
                # Return the final URL after redirects
                final_url = str(resp.url)
                logger.debug("Found website for %s: %s", company_name, final_url)
                return final_url
        except Exception:
            continue

    return None


def extract_domain(url: str) -> Optional[str]:
    """Extract clean domain from URL."""
    if not url:
        return None
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        d = parsed.hostname
        if d and d.startswith("www."):
            d = d[4:]
        return d or None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Career page detection
# ---------------------------------------------------------------------------

CAREER_PATHS = [
    "/careers", "/jobs", "/vacancies", "/work-with-us", "/join-us",
    "/opportunities", "/recruitment", "/career", "/job",
    "/work-for-us", "/join-our-team", "/hiring",
    "/about/careers", "/about/jobs", "/en/careers", "/en/jobs",
    "/careers/", "/jobs/",
]


async def detect_career_page(client: httpx.AsyncClient, website_url: str) -> dict:
    """Check if company website has a careers page."""
    if not website_url:
        return {"has_careers_page": False}

    # Normalize base URL
    base = website_url.rstrip("/")
    if not base.startswith("http"):
        base = f"https://{base}"

    result = {"has_careers_page": False, "careers_page_url": None}

    for path in CAREER_PATHS:
        url = f"{base}{path}"
        try:
            resp = await client.get(
                url,
                follow_redirects=True,
                timeout=8,
                headers={"User-Agent": "Mozilla/5.0 (compatible; SponsorIntel/1.0)"},
            )
            if resp.status_code == 200:
                body = resp.text[:5000].lower()
                # Verify it's actually a careers page (not a 200 soft-404)
                career_keywords = ["career", "job", "vacanc", "apply", "opportunit",
                                   "hiring", "recruit", "position", "join us", "work with"]
                hits = sum(1 for kw in career_keywords if kw in body)
                if hits >= 2:
                    result["has_careers_page"] = True
                    result["careers_page_url"] = str(resp.url)
                    return result
        except Exception:
            continue

    # Also check the homepage for career links
    try:
        resp = await client.get(
            base,
            follow_redirects=True,
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0 (compatible; SponsorIntel/1.0)"},
        )
        if resp.status_code == 200:
            body = resp.text[:20000].lower()
            # Look for career links in HTML
            career_link = re.search(
                r'href=["\']([^"\']*(?:career|jobs|vacanc|recruit|hiring|work-with-us)[^"\']*)["\']',
                body, re.IGNORECASE,
            )
            if career_link:
                href = career_link.group(1)
                if href.startswith("/"):
                    href = f"{base}{href}"
                elif not href.startswith("http"):
                    href = f"{base}/{href}"
                result["has_careers_page"] = True
                result["careers_page_url"] = href
    except Exception:
        pass

    return result


# ---------------------------------------------------------------------------
# Ollama LLM enrichment
# ---------------------------------------------------------------------------

OLLAMA_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "deepseek-v3.1:671b-cloud")

# Model rotation for distributing load and getting diverse perspectives
AI_MODELS = [
    "deepseek-v3.1:671b-cloud",   # Primary — most capable, best analysis
    "qwen3-coder:480b-cloud",     # Strong structured extraction
    "minimax-m2:cloud",           # Self-learning, creative insights
    "glm-4.6:cloud",              # Strong general knowledge
    "gpt-oss:120b-cloud",         # Fast, good for bulk
    "qwen3-vl:235b-cloud",        # Vision-language, good general
]
_model_idx = 0


def next_model() -> str:
    """Rotate through available models for load distribution."""
    global _model_idx
    model = AI_MODELS[_model_idx % len(AI_MODELS)]
    _model_idx += 1
    return model


async def ollama_complete(client: httpx.AsyncClient, prompt: str, system: str = "",
                          timeout: int = 90, model: str = None) -> Optional[str]:
    """Call Ollama API for completion with model fallback."""
    models_to_try = [model or OLLAMA_MODEL]
    # Add a fallback model if the primary isn't deepseek
    if models_to_try[0] != "deepseek-v3.1:671b-cloud":
        models_to_try.append("deepseek-v3.1:671b-cloud")

    for m in models_to_try:
        try:
            body = {
                "model": m,
                "prompt": prompt,
                "system": system,
                "stream": False,
            }
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json=body,
                timeout=timeout,
            )
            if resp.status_code == 200:
                return resp.json().get("response", "")
            logger.debug("Ollama model %s returned %d", m, resp.status_code)
        except Exception as e:
            logger.debug("Ollama error with %s: %s", m, str(e)[:80])
    return None


async def ollama_structured(client: httpx.AsyncClient, prompt: str,
                            system: str = "Respond with valid JSON only. No markdown, no explanation.",
                            timeout: int = 90, model: str = None) -> Optional[dict]:
    """Get structured JSON from Ollama with cleanup."""
    raw = await ollama_complete(client, prompt, system, timeout, model)
    if not raw:
        return None
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        # Also handle cases where model wraps in ```json ... ```
        if cleaned.startswith("{") or cleaned.startswith("["):
            return json.loads(cleaned)
        # Try to find JSON object in the response
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(cleaned[start:end])
        return None
    except json.JSONDecodeError:
        logger.debug("Failed to parse Ollama JSON: %s", raw[:200])
        return None


# ---------------------------------------------------------------------------
# NVIDIA NIM — cloud LLM fallback via OpenAI-compatible API
# ---------------------------------------------------------------------------

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
NVIDIA_MODELS = [
    "deepseek-ai/deepseek-v3.2",
    "meta/llama-3.1-405b-instruct",
    "qwen/qwen3.5-397b-a17b",
]
_nvidia_model_idx = 0


def next_nvidia_model() -> str:
    """Rotate through available NVIDIA models."""
    global _nvidia_model_idx
    model = NVIDIA_MODELS[_nvidia_model_idx % len(NVIDIA_MODELS)]
    _nvidia_model_idx += 1
    return model


async def nvidia_complete(client: httpx.AsyncClient, prompt: str, system: str = "",
                          timeout: int = 120, model: str = None) -> Optional[str]:
    """Call NVIDIA NIM API (OpenAI-compatible) for completion."""
    if not NVIDIA_API_KEY:
        return None

    use_model = model or next_nvidia_model()
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    try:
        resp = await client.post(
            f"{NVIDIA_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": use_model,
                "messages": messages,
                "temperature": 0.3,
                "max_tokens": 2048,
            },
            timeout=timeout,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "")
        logger.debug("NVIDIA model %s returned %d: %s", use_model, resp.status_code, resp.text[:200])
    except Exception as e:
        logger.debug("NVIDIA error with %s: %s", use_model, str(e)[:80])
    return None


async def nvidia_structured(client: httpx.AsyncClient, prompt: str,
                            system: str = "Respond with valid JSON only. No markdown, no explanation.",
                            timeout: int = 120, model: str = None) -> Optional[dict]:
    """Get structured JSON from NVIDIA NIM with cleanup."""
    raw = await nvidia_complete(client, prompt, system, timeout, model)
    if not raw:
        return None
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        if cleaned.startswith("{") or cleaned.startswith("["):
            return json.loads(cleaned)
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(cleaned[start:end])
        return None
    except json.JSONDecodeError:
        logger.debug("Failed to parse NVIDIA JSON: %s", raw[:200])
        return None


# ---------------------------------------------------------------------------
# Unified LLM routing — tries Ollama first, falls back to NVIDIA
# ---------------------------------------------------------------------------

_ollama_consecutive_fails = 0
_ollama_skip_until = 0.0  # time.time() threshold — skip Ollama if before this


async def llm_complete(client: httpx.AsyncClient, prompt: str, system: str = "",
                       timeout: int = 90, model: str = None) -> Optional[str]:
    """Try Ollama first, fall back to NVIDIA NIM if Ollama fails.

    Auto-skips Ollama for 60s after 3 consecutive failures (avoids wasting
    time on 429s when the proxy is saturated).
    """
    global _ollama_consecutive_fails, _ollama_skip_until

    if time.time() < _ollama_skip_until:
        # Ollama is known-down — go straight to NVIDIA
        result = await nvidia_complete(client, prompt, system, timeout=120)
        if result:
            return result
    else:
        result = await ollama_complete(client, prompt, system, timeout, model)
        if result:
            _ollama_consecutive_fails = 0
            return result
        # Ollama failed
        _ollama_consecutive_fails += 1
        if _ollama_consecutive_fails >= 3:
            _ollama_skip_until = time.time() + 60  # skip Ollama for 60s
            logger.info("Ollama: 3+ fails — routing to NVIDIA for 60s")
        result = await nvidia_complete(client, prompt, system, timeout=120)
        if result:
            return result

    # Both failed
    return None


async def llm_structured(client: httpx.AsyncClient, prompt: str,
                         system: str = "Respond with valid JSON only. No markdown, no explanation.",
                         timeout: int = 90, model: str = None) -> Optional[dict]:
    """Try Ollama first, fall back to NVIDIA NIM if Ollama fails."""
    global _ollama_consecutive_fails, _ollama_skip_until

    if time.time() < _ollama_skip_until:
        result = await nvidia_structured(client, prompt, system, timeout=120)
        if result:
            return result
    else:
        result = await ollama_structured(client, prompt, system, timeout, model)
        if result:
            _ollama_consecutive_fails = 0
            return result
        _ollama_consecutive_fails += 1
        if _ollama_consecutive_fails >= 3:
            _ollama_skip_until = time.time() + 60
            logger.info("Ollama: 3+ fails — routing to NVIDIA for 60s")
        result = await nvidia_structured(client, prompt, system, timeout=120)
        if result:
            return result

    return None


# ---------------------------------------------------------------------------
# AI Supercharger — deep intelligence without requiring a website
# ---------------------------------------------------------------------------

async def ai_analyze_company(client: httpx.AsyncClient, company_name: str,
                              profile: dict, model: str = None) -> dict:
    """Use LLM world knowledge to generate deep intelligence about a company.

    Works on ANY company — doesn't need a website. Uses the company name,
    CH data, SIC codes, and address to prompt the LLM for everything it knows.
    """
    result = {}
    use_model = model or next_model()

    # Build context from what we already know
    context_parts = [f"Company name: {company_name}"]

    ch_number = profile.get("companies_house_number")
    if ch_number:
        context_parts.append(f"Companies House number: {ch_number}")

    sic = profile.get("sic_codes")
    if sic:
        sic_list = sic if isinstance(sic, list) else [sic]
        context_parts.append(f"SIC codes: {', '.join(str(s) for s in sic_list)}")

    industry = profile.get("industry_primary")
    if industry:
        context_parts.append(f"Industry: {industry}")

    addr = profile.get("registered_address")
    if addr:
        if isinstance(addr, dict):
            full = addr.get("full_address", "")
            context_parts.append(f"Registered address: {full}")
        elif isinstance(addr, str):
            context_parts.append(f"Registered address: {addr}")

    status = profile.get("company_status")
    if status:
        context_parts.append(f"Status: {status}")

    comp_type = profile.get("company_type")
    if comp_type:
        context_parts.append(f"Company type: {comp_type}")

    incorp = profile.get("incorporation_date")
    if incorp:
        context_parts.append(f"Incorporated: {incorp}")

    nv = safe_json(profile.get("name_variants"))
    trading = nv.get("trading_name") or nv.get("trading_names")
    if trading:
        if isinstance(trading, list):
            context_parts.append(f"Trading names: {', '.join(trading)}")
        else:
            context_parts.append(f"Trading name: {trading}")

    website = profile.get("website_url")
    if website:
        context_parts.append(f"Website: {website}")

    linkedin = profile.get("linkedin_url")
    if linkedin:
        context_parts.append(f"LinkedIn: {linkedin}")

    context = "\n".join(context_parts)

    prompt = f"""You are a UK business intelligence analyst. Analyze this UK company that holds a sponsor licence (can sponsor skilled worker visas).

{context}

IMPORTANT RULES:
- Only state facts you are confident about. Use null for anything you don't know.
- DO NOT guess or fabricate specific details like ratings, founding years, or client names.
- For well-known companies, provide rich detail. For unknown small businesses, keep it factual based on name/SIC/type clues.
- Clearly distinguish between facts and reasonable inferences based on industry/type.
- "description" should be based on what the company actually does (from SIC codes, name, type), not imagined.

Provide a JSON analysis:
{{
  "description": "2-3 sentence factual description. Base on SIC codes, company name, and type. Say 'appears to be' for inferences.",
  "services": ["list of likely services based on SIC codes and company name"],
  "industry_tags": ["specific industry tags from SIC codes and name analysis"],
  "employee_size_estimate": "micro (<10) | small (10-49) | medium (50-249) | large (250-999) | enterprise (1000+) | null if unknown",
  "typical_sponsored_roles": ["types of roles companies in this industry typically sponsor"],
  "hiring_sectors": ["which sectors/departments typically hire in this industry"],
  "company_culture": null if unknown — only describe if you genuinely know this company,
  "is_well_known": true/false,
  "headquarters_city": "city from registered address or null",
  "parent_company": "only if you are certain this is a subsidiary, otherwise null",
  "competitors": ["only list if you genuinely know competitors, otherwise empty array"],
  "visa_sponsorship_likelihood": "high | medium | low — based on industry hiring patterns",
  "glassdoor_rating_estimate": null — only provide if you have seen actual data,
  "key_facts": ["only verifiable facts you are confident about, empty array if none"]
}}

Respond with valid JSON only."""

    data = await llm_structured(client, prompt, model=use_model)
    if data:
        result["ai_intelligence"] = data
    return result


async def ai_generate_search_tips(client: httpx.AsyncClient, company_name: str,
                                   profile: dict, model: str = None) -> Optional[dict]:
    """Generate job search tips for this specific company."""
    use_model = model or "qwen3-coder:480b-cloud"

    industry = profile.get("industry_primary") or "Unknown"
    sic = profile.get("sic_codes") or []
    nv = safe_json(profile.get("name_variants"))
    trading = nv.get("trading_name")

    prompt = f"""For a job seeker targeting this UK visa sponsor company, provide factual search tips as JSON.
Only recommend job boards that are real and commonly used for this industry. Do not invent tips.

Company: {company_name}
{f'Trading as: {trading}' if trading else ''}
Industry: {industry}
SIC codes: {', '.join(str(s) for s in sic) if sic else 'N/A'}

{{
  "search_names": ["all name variations to search for jobs (include trading name, abbreviations)"],
  "job_boards": ["real UK job boards likely to list jobs for this industry"],
  "application_tips": "one practical, factual tip for applying to companies in this industry",
  "best_time_to_apply": "typical hiring patterns for this industry, or 'rolling' if unknown"
}}

Valid JSON only."""

    return await llm_structured(client, prompt, model=use_model)


async def ai_enrich_with_website(client: httpx.AsyncClient, website_url: str,
                                  company_name: str, model: str = None) -> dict:
    """Enhanced website analysis — extracts MORE data than the basic ollama mode."""
    result = {}
    use_model = model or "deepseek-v3.1:671b-cloud"

    try:
        resp = await client.get(
            website_url, follow_redirects=True, timeout=15,
            headers={"User-Agent": "Mozilla/5.0 (compatible; SponsorIntel/1.0)"},
        )
        if resp.status_code != 200:
            return result
        html = resp.text[:12000]
    except Exception:
        return result

    # Deterministic extractions (no LLM needed)
    # Social links
    social = {}
    for platform, pattern in [
        ("twitter", r'href=["\']?(https?://(?:www\.)?(?:twitter|x)\.com/[^"\'>\s]+)'),
        ("facebook", r'href=["\']?(https?://(?:www\.)?facebook\.com/[^"\'>\s]+)'),
        ("instagram", r'href=["\']?(https?://(?:www\.)?instagram\.com/[^"\'>\s]+)'),
        ("youtube", r'href=["\']?(https?://(?:www\.)?youtube\.com/[^"\'>\s]+)'),
        ("linkedin", r'href=["\']?(https?://(?:www\.)?linkedin\.com/company/[^"\'>\s]+)'),
        ("github", r'href=["\']?(https?://(?:www\.)?github\.com/[^"\'>\s]+)'),
        ("glassdoor", r'href=["\']?(https?://(?:www\.)?glassdoor\.co\.uk/[^"\'>\s]+)'),
        ("trustpilot", r'href=["\']?(https?://(?:www\.)?(?:uk\.)?trustpilot\.com/[^"\'>\s]+)'),
    ]:
        match = re.search(pattern, html, re.I)
        if match:
            social[platform] = match.group(1)
    if social:
        result["social_links_extracted"] = social

    # Contact info
    email = re.search(r'(?:mailto:)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', html, re.I)
    if email:
        addr = email.group(1).lower()
        if not any(x in addr for x in ["example.com", "placeholder", "noreply", "no-reply", "wix.com"]):
            result["contact_email"] = addr
    phone = re.search(r'(?:tel:|phone:|call|Tel|Phone)\s*:?\s*([+0][\d\s()-]{8,20})', html, re.I)
    if phone:
        result["contact_phone"] = phone.group(1).strip()

    # Tech stack
    tech = []
    for name, pattern in {
        "React": r'react|__next', "Next.js": r'_next/|__NEXT_DATA__',
        "WordPress": r'wp-content|wordpress', "Shopify": r'shopify|cdn\.shopify',
        "Drupal": r'drupal|sites/default', "Angular": r'ng-app|angular',
        "Vue.js": r'vue\.js|vuejs|__vue', "Laravel": r'laravel',
        "ASP.NET": r'__VIEWSTATE|aspnet', "Wix": r'wix\.com|wixstatic',
        "Squarespace": r'squarespace', "HubSpot": r'hubspot',
        "Salesforce": r'salesforce|force\.com',
        "Google Analytics": r'google-analytics|gtag|UA-\d+',
        "Cloudflare": r'cloudflare|cf-ray',
        "Bootstrap": r'bootstrap', "Tailwind": r'tailwindcss',
        "jQuery": r'jquery', "Ruby on Rails": r'csrf-token.*authenticity',
    }.items():
        if re.search(pattern, html, re.IGNORECASE):
            tech.append(name)
    if tech:
        result["tech_stack_detected"] = tech

    # Strip HTML for LLM
    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()[:5000]

    # Deep LLM analysis of website content
    prompt = f"""Analyze this UK company's website text. Extract ONLY information that is actually present in the text below.
Do NOT invent or assume anything not stated. Use null for missing data.

Company: {company_name}
Website text:
{text}

Respond with JSON (only include what you can find in the text above):
{{
  "description": "2-3 sentence description based on what the website says",
  "services": ["services/products actually mentioned on the website"],
  "industry_tags": ["industry tags based on what the website describes"],
  "employee_size_hint": "micro/small/medium/large/enterprise — only if mentioned or strongly implied, otherwise null",
  "headquarters_city": "city if mentioned, otherwise null",
  "founded_year": "year if mentioned, otherwise null",
  "is_recruiting": "true if careers/jobs mentioned, false if not, null if unclear",
  "benefits_mentioned": ["employee benefits actually listed on the site"],
  "clients_mentioned": ["clients or sectors actually named on the site"],
  "certifications": ["certifications actually displayed, e.g. ISO, B-Corp"],
  "offices_locations": ["locations actually mentioned"],
  "diversity_commitment": "true only if explicitly mentioned",
  "remote_work_policy": "only if mentioned, otherwise null",
  "values": ["company values actually stated on the site"]
}}"""

    llm_data = await llm_structured(client, prompt, model=use_model)
    if llm_data:
        result["llm_analysis"] = llm_data

    return result


async def ollama_analyze_website(client: httpx.AsyncClient, url: str,
                                 company_name: str) -> dict:
    """Use Ollama to analyze a company website and extract structured data."""
    result = {}

    # Fetch the homepage
    try:
        resp = await client.get(
            url,
            follow_redirects=True,
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0 (compatible; SponsorIntel/1.0)"},
        )
        if resp.status_code != 200:
            return result
        html = resp.text[:8000]  # First 8K chars
    except Exception:
        return result

    # Strip HTML tags for cleaner input
    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()[:4000]

    # Extract social links from raw HTML (deterministic, no LLM needed)
    social = {}
    twitter = re.search(r'href=["\']?(https?://(?:www\.)?(?:twitter|x)\.com/[^"\'>\s]+)', html, re.I)
    if twitter:
        social["twitter"] = twitter.group(1)
    facebook = re.search(r'href=["\']?(https?://(?:www\.)?facebook\.com/[^"\'>\s]+)', html, re.I)
    if facebook:
        social["facebook"] = facebook.group(1)
    instagram = re.search(r'href=["\']?(https?://(?:www\.)?instagram\.com/[^"\'>\s]+)', html, re.I)
    if instagram:
        social["instagram"] = instagram.group(1)
    youtube = re.search(r'href=["\']?(https?://(?:www\.)?youtube\.com/[^"\'>\s]+)', html, re.I)
    if youtube:
        social["youtube"] = youtube.group(1)
    linkedin = re.search(r'href=["\']?(https?://(?:www\.)?linkedin\.com/company/[^"\'>\s]+)', html, re.I)
    if linkedin:
        social["linkedin_from_website"] = linkedin.group(1)
    if social:
        result["social_links_extracted"] = social

    # Extract email/phone from HTML (deterministic)
    email = re.search(r'(?:mailto:)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', html, re.I)
    if email:
        addr = email.group(1).lower()
        if not any(x in addr for x in ["example.com", "placeholder", "noreply", "no-reply"]):
            result["contact_email"] = addr
    phone = re.search(r'(?:tel:|phone:|call)\s*:?\s*([+0][\d\s()-]{8,20})', html, re.I)
    if phone:
        result["contact_phone"] = phone.group(1).strip()

    # Detect tech stack from HTML (deterministic)
    tech = []
    tech_patterns = {
        "React": r'react|__next',
        "Next.js": r'_next/|__NEXT_DATA__',
        "WordPress": r'wp-content|wordpress',
        "Shopify": r'shopify|cdn\.shopify',
        "Drupal": r'drupal|sites/default',
        "Angular": r'ng-app|angular',
        "Vue.js": r'vue\.js|vuejs|__vue',
        "Laravel": r'laravel',
        "Ruby on Rails": r'csrf-token.*authenticity|ruby',
        "ASP.NET": r'__VIEWSTATE|aspnet',
        "jQuery": r'jquery',
        "Bootstrap": r'bootstrap',
        "Tailwind": r'tailwindcss|tw-',
        "Wix": r'wix\.com|wixstatic',
        "Squarespace": r'squarespace',
        "HubSpot": r'hubspot',
        "Salesforce": r'salesforce|force\.com',
        "Google Analytics": r'google-analytics|gtag|UA-\d+',
        "Google Tag Manager": r'googletagmanager|GTM-',
        "Cloudflare": r'cloudflare|cf-ray',
    }
    for name, pattern in tech_patterns.items():
        if re.search(pattern, html, re.IGNORECASE):
            tech.append(name)
    if tech:
        result["tech_stack_detected"] = tech

    # Use Ollama for deeper analysis
    prompt = f"""Analyze this company website text and extract structured data.
Company name: {company_name}
Website text (first 3000 chars):
{text[:3000]}

Extract the following as JSON:
{{
  "description": "2-3 sentence company description",
  "services": ["list", "of", "main", "services"],
  "industry_tags": ["specific", "industry", "tags"],
  "employee_size_hint": "small/medium/large/enterprise or null",
  "headquarters_city": "city name or null",
  "founded_year": year or null,
  "is_recruiting": true/false
}}"""

    llm_data = await llm_structured(client, prompt)
    if llm_data:
        result["llm_analysis"] = llm_data

    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def safe_json(val) -> dict:
    """Safely parse a JSONB field that might come back as str or dict."""
    if val is None:
        return {}
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}
    return {}


# ---------------------------------------------------------------------------
# Enrichment level computation
# ---------------------------------------------------------------------------

def compute_enrichment_level(profile: dict) -> int:
    """Compute enrichment level as 0-5 (matches Postgres enum).

    0 = no data, 1 = basic (CH number only), 2 = partial (address/SIC),
    3 = moderate (website/LinkedIn), 4 = good (careers/directors/reviews),
    5 = fully enriched (all major fields filled)
    """
    filled = 0
    check_fields = [
        "companies_house_number", "company_status", "incorporation_date",
        "sic_codes", "industry_primary", "registered_address",
        "website_url", "linkedin_url", "has_careers_page",
        "glassdoor_rating", "trustpilot_rating", "google_rating",
        "employee_count_estimate", "credit_risk_score",
        "name_variants", "tech_stack_detected", "industry_tags",
        "company_type", "has_charges", "last_accounts_date",
    ]
    for field in check_fields:
        val = profile.get(field)
        if val is not None and val != "" and val != [] and val != {}:
            filled += 1

    # Check social_links for directors/contact/AI intelligence
    social = safe_json(profile.get("social_links"))
    if social.get("directors"):
        filled += 1
    if social.get("contact_email") or social.get("contact_phone"):
        filled += 1
    if social.get("ai_intelligence"):
        filled += 1
    if social.get("search_tips"):
        filled += 1

    # Map field count to level 0-5
    if filled == 0:
        return 0
    elif filled <= 3:
        return 1
    elif filled <= 7:
        return 2
    elif filled <= 12:
        return 3
    elif filled <= 17:
        return 4
    else:
        return 5


# ---------------------------------------------------------------------------
# Batch enrichment modes
# ---------------------------------------------------------------------------

async def enrich_ch_batch(sb, profiles: list[dict], api_key: str) -> dict:
    """Enrich batch with Companies House data."""
    stats = {"enriched": 0, "skipped": 0, "errors": 0}

    async with httpx.AsyncClient() as client:
        for profile in profiles:
            ch_number = profile.get("companies_house_number")
            if not ch_number:
                stats["skipped"] += 1
                continue

            try:
                ch_data = await enrich_from_ch(client, ch_number, api_key)
                if not ch_data:
                    stats["skipped"] += 1
                    continue

                update = {}
                for key, val in ch_data.items():
                    if val is not None:
                        if key == "directors":
                            existing_social = safe_json(profile.get("social_links"))
                            existing_social["directors"] = val
                            update["social_links"] = existing_social
                        else:
                            update[key] = val

                if update:
                    merged = {**profile, **update}
                    update["enrichment_level"] = compute_enrichment_level(merged)
                    update["enriched_at"] = datetime.now(timezone.utc).isoformat()

                    sb.table("company_profiles").update(update).eq(
                        "id", profile["id"]
                    ).execute()
                    stats["enriched"] += 1

                await asyncio.sleep(0.5)  # CH rate limiting

            except Exception as e:
                stats["errors"] += 1
                if stats["errors"] <= 5:
                    logger.warning("CH error for %s: %s", ch_number, str(e)[:80])

    return stats


async def enrich_linkedin_batch(sb, profiles: list[dict], sponsor_names: dict) -> dict:
    """Construct LinkedIn URLs for companies that don't have them."""
    stats = {"enriched": 0, "skipped": 0, "errors": 0}

    for profile in profiles:
        if profile.get("linkedin_url"):
            stats["skipped"] += 1
            continue

        try:
            # Get company name from sponsor
            sponsor_id = profile.get("sponsor_id")
            company_name = sponsor_names.get(sponsor_id, "")
            if not company_name:
                stats["skipped"] += 1
                continue

            # Also check if website has LinkedIn link
            social = safe_json(profile.get("social_links"))
            linkedin_from_site = social.get("linkedin_from_website")

            linkedin_url = linkedin_from_site or construct_linkedin_url(company_name)
            if not linkedin_url:
                stats["skipped"] += 1
                continue

            update = {
                "linkedin_url": linkedin_url,
                "enriched_at": datetime.now(timezone.utc).isoformat(),
            }
            merged = {**profile, **update}
            update["enrichment_level"] = compute_enrichment_level(merged)

            sb.table("company_profiles").update(update).eq(
                "id", profile["id"]
            ).execute()
            stats["enriched"] += 1

        except Exception as e:
            stats["errors"] += 1
            if stats["errors"] <= 5:
                logger.warning("LinkedIn error: %s", str(e)[:80])

    return stats


async def enrich_website_batch(sb, profiles: list[dict], sponsor_names: dict) -> dict:
    """Discover websites for companies that don't have them."""
    stats = {"enriched": 0, "skipped": 0, "errors": 0}

    async with httpx.AsyncClient() as client:
        for profile in profiles:
            if profile.get("website_url"):
                stats["skipped"] += 1
                continue

            try:
                sponsor_id = profile.get("sponsor_id")
                company_name = sponsor_names.get(sponsor_id, "")
                if not company_name:
                    stats["skipped"] += 1
                    continue

                # Also check trading name from name_variants
                variants = safe_json(profile.get("name_variants"))
                trading_name = variants.get("trading_name")

                # Try trading name first (more likely to be the website name)
                website = None
                if trading_name:
                    website = await discover_website(client, trading_name)
                if not website:
                    website = await discover_website(client, company_name)

                if not website:
                    stats["skipped"] += 1
                    continue

                domain = extract_domain(website)
                update = {
                    "website_url": website,
                    "enriched_at": datetime.now(timezone.utc).isoformat(),
                }

                # Update name_variants with domain
                if domain:
                    nv = safe_json(profile.get("name_variants"))
                    nv["domain"] = domain
                    update["name_variants"] = nv

                merged = {**profile, **update}
                update["enrichment_level"] = compute_enrichment_level(merged)

                sb.table("company_profiles").update(update).eq(
                    "id", profile["id"]
                ).execute()
                stats["enriched"] += 1
                logger.debug("Found website for %s: %s", company_name[:40], website)

                await asyncio.sleep(0.3)  # Be polite

            except Exception as e:
                stats["errors"] += 1
                if stats["errors"] <= 5:
                    logger.warning("Website error: %s", str(e)[:80])

    return stats


async def enrich_careers_batch(sb, profiles: list[dict]) -> dict:
    """Detect career pages on company websites."""
    stats = {"enriched": 0, "skipped": 0, "errors": 0}

    async with httpx.AsyncClient() as client:
        for profile in profiles:
            website = profile.get("website_url")
            if not website:
                stats["skipped"] += 1
                continue
            if profile.get("has_careers_page") is not None:
                stats["skipped"] += 1
                continue

            try:
                career_data = await detect_career_page(client, website)
                update = {
                    "has_careers_page": career_data["has_careers_page"],
                    "enriched_at": datetime.now(timezone.utc).isoformat(),
                }
                if career_data.get("careers_page_url"):
                    update["careers_page_url"] = career_data["careers_page_url"]

                merged = {**profile, **update}
                update["enrichment_level"] = compute_enrichment_level(merged)

                sb.table("company_profiles").update(update).eq(
                    "id", profile["id"]
                ).execute()
                stats["enriched"] += 1

                await asyncio.sleep(0.5)  # Be polite

            except Exception as e:
                stats["errors"] += 1
                if stats["errors"] <= 5:
                    logger.warning("Career page error: %s", str(e)[:80])

    return stats


async def enrich_ollama_batch(sb, profiles: list[dict], sponsor_names: dict) -> dict:
    """Use Ollama LLM to deeply analyze company websites."""
    stats = {"enriched": 0, "skipped": 0, "errors": 0}

    async with httpx.AsyncClient(timeout=90) as client:
        # Check Ollama availability
        try:
            health = await client.get(f"{OLLAMA_URL}/api/tags", timeout=5)
            if health.status_code != 200:
                logger.error("Ollama not available at %s", OLLAMA_URL)
                return stats
            models = health.json().get("models", [])
            model_names = [m.get("name", "") for m in models]
            logger.info("Ollama available. Models: %s", ", ".join(model_names[:5]))
        except Exception as e:
            logger.error("Ollama not reachable at %s: %s", OLLAMA_URL, str(e)[:60])
            return stats

        for profile in profiles:
            website = profile.get("website_url")
            if not website:
                stats["skipped"] += 1
                continue

            try:
                sponsor_id = profile.get("sponsor_id")
                company_name = sponsor_names.get(sponsor_id, "Unknown")

                analysis = await ollama_analyze_website(client, website, company_name)
                if not analysis:
                    stats["skipped"] += 1
                    continue

                update = {"enriched_at": datetime.now(timezone.utc).isoformat()}

                # Apply extracted social links
                if analysis.get("social_links_extracted"):
                    existing_social = safe_json(profile.get("social_links"))
                    existing_social.update(analysis["social_links_extracted"])
                    li = analysis["social_links_extracted"].get("linkedin_from_website")
                    if li and not profile.get("linkedin_url"):
                        update["linkedin_url"] = li
                    update["social_links"] = existing_social

                # Apply tech stack
                if analysis.get("tech_stack_detected"):
                    update["tech_stack_detected"] = analysis["tech_stack_detected"]

                # Apply contact info
                if analysis.get("contact_email"):
                    existing_social = update.get("social_links") or safe_json(profile.get("social_links"))
                    existing_social["contact_email"] = analysis["contact_email"]
                    update["social_links"] = existing_social
                if analysis.get("contact_phone"):
                    existing_social = update.get("social_links") or safe_json(profile.get("social_links"))
                    existing_social["contact_phone"] = analysis["contact_phone"]
                    update["social_links"] = existing_social

                # Apply LLM analysis
                if analysis.get("llm_analysis"):
                    llm = analysis["llm_analysis"]
                    if llm.get("industry_tags"):
                        update["industry_tags"] = llm["industry_tags"]
                    if llm.get("employee_size_hint"):
                        size_map = {
                            "small": 25, "medium": 150, "large": 1000, "enterprise": 5000,
                        }
                        est = size_map.get(llm["employee_size_hint"].lower())
                        if est and not profile.get("employee_count_estimate"):
                            update["employee_count_estimate"] = est
                            update["employee_count_source"] = "llm_estimate"

                    existing_social = update.get("social_links") or safe_json(profile.get("social_links"))
                    existing_social["llm_analysis"] = {
                        "description": llm.get("description"),
                        "services": llm.get("services"),
                        "headquarters_city": llm.get("headquarters_city"),
                        "founded_year": llm.get("founded_year"),
                        "is_recruiting": llm.get("is_recruiting"),
                        "analyzed_at": datetime.now(timezone.utc).isoformat(),
                    }
                    update["social_links"] = existing_social

                if len(update) > 1:
                    merged = {**profile, **update}
                    update["enrichment_level"] = compute_enrichment_level(merged)
                    sb.table("company_profiles").update(update).eq(
                        "id", profile["id"]
                    ).execute()
                    stats["enriched"] += 1
                else:
                    stats["skipped"] += 1

                await asyncio.sleep(1)

            except Exception as e:
                stats["errors"] += 1
                if stats["errors"] <= 5:
                    logger.warning("Ollama error: %s", str(e)[:80])

    return stats


async def _ai_enrich_one(client: httpx.AsyncClient, sb, profile: dict,
                          company_name: str, sem: asyncio.Semaphore) -> str:
    """Enrich a single company with AI intelligence. Returns 'enriched'/'skipped'/'error'."""
    async with sem:
        try:
            existing_social = safe_json(profile.get("social_links"))
            if existing_social.get("ai_intelligence"):
                return "skipped"

            update = {"enriched_at": datetime.now(timezone.utc).isoformat()}
            model = next_model()

            # Step 1: AI world-knowledge analysis
            ai_data = await ai_analyze_company(client, company_name, profile, model=model)

            if ai_data.get("ai_intelligence"):
                intel = ai_data["ai_intelligence"]

                if intel.get("industry_tags") and not profile.get("industry_tags"):
                    update["industry_tags"] = intel["industry_tags"]

                size_map = {
                    "micro": 5, "small": 25, "medium": 150,
                    "large": 500, "enterprise": 5000,
                }
                size_hint = (intel.get("employee_size_estimate") or "").split("(")[0].strip().lower()
                est = size_map.get(size_hint)
                if est and not profile.get("employee_count_estimate"):
                    update["employee_count_estimate"] = est
                    update["employee_count_source"] = "ai_intelligence"

                existing_social["ai_intelligence"] = {
                    "description": intel.get("description"),
                    "services": intel.get("services"),
                    "typical_sponsored_roles": intel.get("typical_sponsored_roles"),
                    "hiring_sectors": intel.get("hiring_sectors"),
                    "company_culture": intel.get("company_culture"),
                    "is_well_known": intel.get("is_well_known"),
                    "headquarters_city": intel.get("headquarters_city"),
                    "parent_company": intel.get("parent_company"),
                    "competitors": intel.get("competitors"),
                    "visa_sponsorship_likelihood": intel.get("visa_sponsorship_likelihood"),
                    "key_facts": intel.get("key_facts"),
                    "model_used": model,
                    "analyzed_at": datetime.now(timezone.utc).isoformat(),
                }
                update["social_links"] = existing_social

            # Step 2: Deep website analysis if URL exists
            website = profile.get("website_url")
            if website:
                web_data = await ai_enrich_with_website(client, website, company_name)

                if web_data.get("social_links_extracted"):
                    existing_social = update.get("social_links") or safe_json(profile.get("social_links"))
                    existing_social.update(web_data["social_links_extracted"])
                    li = web_data["social_links_extracted"].get("linkedin")
                    if li and not profile.get("linkedin_url"):
                        update["linkedin_url"] = li
                    update["social_links"] = existing_social

                if web_data.get("tech_stack_detected"):
                    update["tech_stack_detected"] = web_data["tech_stack_detected"]

                if web_data.get("contact_email"):
                    existing_social = update.get("social_links") or safe_json(profile.get("social_links"))
                    existing_social["contact_email"] = web_data["contact_email"]
                    update["social_links"] = existing_social
                if web_data.get("contact_phone"):
                    existing_social = update.get("social_links") or safe_json(profile.get("social_links"))
                    existing_social["contact_phone"] = web_data["contact_phone"]
                    update["social_links"] = existing_social

                if web_data.get("llm_analysis"):
                    llm = web_data["llm_analysis"]
                    existing_social = update.get("social_links") or safe_json(profile.get("social_links"))
                    existing_social["website_analysis"] = {
                        **llm,
                        "analyzed_at": datetime.now(timezone.utc).isoformat(),
                    }
                    update["social_links"] = existing_social

                    if llm.get("industry_tags"):
                        update["industry_tags"] = llm["industry_tags"]

            # Step 3: Generate job search tips
            search_tips = await ai_generate_search_tips(client, company_name, profile)
            if search_tips:
                existing_social = update.get("social_links") or safe_json(profile.get("social_links"))
                existing_social["search_tips"] = search_tips
                update["social_links"] = existing_social

            if len(update) > 1:
                merged = {**profile, **update}
                update["enrichment_level"] = compute_enrichment_level(merged)
                sb.table("company_profiles").update(update).eq(
                    "id", profile["id"]
                ).execute()
                return "enriched"
            return "skipped"

        except Exception as e:
            logger.warning("AI error for %s: %s", company_name[:30], str(e)[:100])
            return "error"


async def enrich_ai_batch(sb, profiles: list[dict], sponsor_names: dict) -> dict:
    """AI Supercharger — deep intelligence for ALL companies using LLM world knowledge.

    Processes up to 3 companies concurrently for ~3x throughput. Each company
    gets its own model from the rotation pool to distribute load.
    """
    stats = {"enriched": 0, "skipped": 0, "errors": 0}
    CONCURRENCY = 3  # Parallel AI enrichments

    async with httpx.AsyncClient(timeout=120) as client:
        # Check Ollama availability and list models
        try:
            health = await client.get(f"{OLLAMA_URL}/api/tags", timeout=5)
            if health.status_code != 200:
                logger.error("Ollama not available at %s", OLLAMA_URL)
                return stats
            models = health.json().get("models", [])
            model_names = [m.get("name", "") for m in models]
            cloud_models = [n for n in model_names if "cloud" in n]
            logger.info("AI Supercharger: %d cloud models available: %s",
                        len(cloud_models), ", ".join(cloud_models[:6]))
        except Exception as e:
            logger.error("Ollama not reachable: %s", str(e)[:60])
            return stats

        sem = asyncio.Semaphore(CONCURRENCY)

        # Filter to eligible profiles and build tasks
        tasks = []
        for profile in profiles:
            sponsor_id = profile.get("sponsor_id")
            company_name = sponsor_names.get(sponsor_id, "")
            if not company_name:
                stats["skipped"] += 1
                continue
            tasks.append(_ai_enrich_one(client, sb, profile, company_name, sem))

        # Process in chunks to report progress
        chunk_size = 10
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
            if stats["enriched"] > 0 and stats["enriched"] % 10 == 0:
                logger.info("  AI enriched %d companies (concurrent x%d)",
                            stats["enriched"], CONCURRENCY)

    return stats


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

async def load_sponsor_names(sb, sponsor_ids: list[str]) -> dict:
    """Load sponsor organisation names by ID."""
    names = {}
    batch_size = 500
    for i in range(0, len(sponsor_ids), batch_size):
        batch = sponsor_ids[i:i + batch_size]
        resp = sb.table("sponsors").select(
            "id, organisation_name"
        ).in_("id", batch).execute()
        if resp.data:
            for row in resp.data:
                names[row["id"]] = row["organisation_name"]
    return names


async def main():
    parser = argparse.ArgumentParser(description="Mega company enrichment pipeline")
    parser.add_argument("--limit", type=int, default=500, help="Max companies to process")
    parser.add_argument("--batch-size", type=int, default=50, help="Batch size")
    parser.add_argument(
        "--mode", type=str, default="all",
        choices=["ch", "linkedin", "website", "careers", "ollama", "ai", "all"],
        help="Enrichment mode: ch, linkedin, website, careers, ollama (website only), ai (all companies), or all",
    )
    parser.add_argument("--ollama-url", type=str, default=None, help="Ollama API URL")
    parser.add_argument("--ollama-model", type=str, default=None, help="Ollama model name")
    args = parser.parse_args()

    # Override Ollama config from args
    global OLLAMA_URL, OLLAMA_MODEL
    if args.ollama_url:
        OLLAMA_URL = args.ollama_url
    if args.ollama_model:
        OLLAMA_MODEL = args.ollama_model

    ch_api_key = os.environ.get("COMPANIES_HOUSE_API_KEY")
    modes = []
    if args.mode == "all":
        modes = ["linkedin", "website", "careers"]
        if ch_api_key:
            modes.insert(0, "ch")
        # Add AI mode if Ollama available (replaces basic ollama mode)
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                r = await c.get(f"{OLLAMA_URL}/api/tags")
                if r.status_code == 200:
                    modes.append("ai")
        except Exception:
            pass
    else:
        modes = [args.mode]

    if "ch" in modes and not ch_api_key:
        logger.warning("COMPANIES_HOUSE_API_KEY not set — skipping CH enrichment")
        logger.info("Get a free key at https://developer.company-information.service.gov.uk/")
        modes.remove("ch")

    if not modes:
        logger.error("No enrichment modes available. Set API keys or run Ollama.")
        return

    logger.info("=== MEGA ENRICHMENT PIPELINE ===")
    logger.info("Modes: %s | Limit: %d | Batch: %d", ", ".join(modes), args.limit, args.batch_size)
    if "ollama" in modes or "ai" in modes:
        logger.info("Ollama: %s (primary: %s, %d models in rotation)",
                     OLLAMA_URL, OLLAMA_MODEL, len(AI_MODELS))

    sb = await get_supabase()
    start = time.time()

    for mode in modes:
        mode_start = time.time()
        logger.info("\n--- %s enrichment ---", mode.upper())
        total_stats = {"enriched": 0, "skipped": 0, "errors": 0}
        offset = 0

        consecutive_failures = 0
        while total_stats["enriched"] + total_stats["skipped"] < args.limit:
            try:
                # Build query based on mode
                select_fields = (
                    "id, sponsor_id, companies_house_number, company_status, incorporation_date, "
                    "sic_codes, industry_primary, registered_address, website_url, linkedin_url, "
                    "has_careers_page, careers_page_url, glassdoor_rating, trustpilot_rating, "
                    "google_rating, employee_count_estimate, employee_count_source, "
                    "credit_risk_score, social_links, name_variants, tech_stack_detected, "
                    "industry_tags, enrichment_level, enriched_at, company_type, "
                    "has_charges, has_insolvency_history, last_accounts_date"
                )

                query = sb.table("company_profiles").select(select_fields)

                if mode == "ch":
                    query = query.filter("companies_house_number", "not.is", "null")
                elif mode == "linkedin":
                    query = query.is_("linkedin_url", "null")
                elif mode == "website":
                    query = query.is_("website_url", "null")
                elif mode == "careers":
                    query = query.filter("website_url", "not.is", "null").is_("has_careers_page", "null")
                elif mode == "ollama":
                    query = query.filter("website_url", "not.is", "null")
                elif mode == "ai":
                    pass  # Process ALL companies — no filter

                query = query.order("enrichment_level", desc=False)
                resp = query.range(offset, offset + args.batch_size - 1).execute()

                if not resp.data:
                    break

                # Load sponsor names if needed
                sponsor_names = {}
                if mode in ("linkedin", "website", "ollama", "ai"):
                    ids = list({p["sponsor_id"] for p in resp.data if p.get("sponsor_id")})
                    if ids:
                        sponsor_names = await load_sponsor_names(sb, ids)

                # Run the enrichment
                if mode == "ch":
                    batch_stats = await enrich_ch_batch(sb, resp.data, ch_api_key)
                elif mode == "linkedin":
                    batch_stats = await enrich_linkedin_batch(sb, resp.data, sponsor_names)
                elif mode == "website":
                    batch_stats = await enrich_website_batch(sb, resp.data, sponsor_names)
                elif mode == "careers":
                    batch_stats = await enrich_careers_batch(sb, resp.data)
                elif mode == "ollama":
                    batch_stats = await enrich_ollama_batch(sb, resp.data, sponsor_names)
                elif mode == "ai":
                    batch_stats = await enrich_ai_batch(sb, resp.data, sponsor_names)
                else:
                    break

                for k in total_stats:
                    total_stats[k] += batch_stats[k]

                offset += args.batch_size
                consecutive_failures = 0
                elapsed = time.time() - mode_start
                logger.info(
                    "[%s] %d enriched, %d skipped, %d errors (%.1fs)",
                    mode, total_stats["enriched"], total_stats["skipped"],
                    total_stats["errors"], elapsed,
                )

            except Exception as e:
                consecutive_failures += 1
                logger.warning("[%s] Batch error (%d): %s", mode, consecutive_failures, str(e)[:120])
                if consecutive_failures >= 5:
                    logger.error("[%s] 5 consecutive batch failures — aborting mode", mode)
                    break
                await asyncio.sleep(min(10 * consecutive_failures, 60))

        mode_elapsed = time.time() - mode_start
        logger.info(
            "[%s] DONE: %d enriched, %d skipped, %d errors (%.1fs)",
            mode, total_stats["enriched"], total_stats["skipped"],
            total_stats["errors"], mode_elapsed,
        )

    total_elapsed = time.time() - start
    logger.info("\n=== ENRICHMENT COMPLETE (%.1fs) ===", total_elapsed)


if __name__ == "__main__":
    asyncio.run(main())
