"""Daniel Mensah — Corporate Intelligence Officer (Compliance department)."""

import logging
from datetime import datetime, timezone
from typing import Any

from app.agents.base import BaseAgent, SubAgentResult
from app.agents.registry import register_agent
from app.scrapers.companies_house import CompaniesHouseAPI

from .filing_checker import FilingCheckerAgent
from .status_monitor import StatusMonitorAgent
from .officer_tracker import OfficerTrackerAgent
from .financial_health import FinancialHealthAgent

logger = logging.getLogger(__name__)


@register_agent("companies_house_watcher")
class CompaniesHouseWatcherAgent(BaseAgent):
    persona = "Daniel Mensah"
    title = "Corporate Intelligence Officer"
    department = "Compliance"
    name = "companies_house_watcher"
    description = (
        "Monitors Companies House for every sponsor — new filings, status changes, "
        "officer moves, financial health signals, and early warning signs of licence risk."
    )

    def _register_sub_agents(self) -> None:
        self.register(FilingCheckerAgent())
        self.register(StatusMonitorAgent())
        self.register(OfficerTrackerAgent())
        self.register(FinancialHealthAgent())

    async def run_pipeline(
        self,
        supabase: Any,
        batch_size: int = 100,
    ) -> dict[str, Any]:
        """Execute the Companies House watcher pipeline.

        Steps:
            1. Fetch batch of company_profiles with companies_house_number populated
            2. For each, run all sub-agents against the Companies House API
            3. Compare against stored data, detect changes
            4. Write changes to company_news as events
            5. Update company_profile with latest data
            6. Return change summary
        """
        from app.core.config import get_settings

        settings = get_settings()
        api_key = settings.companies_house_api_key
        if not api_key:
            logger.error("[CHWatcher] No COMPANIES_HOUSE_API_KEY configured")
            return {"error": "No API key configured", "companies_checked": 0}

        ch_api = CompaniesHouseAPI(api_key)

        # Step 1: Fetch companies that need checking, ordered by oldest enriched_at
        profiles = self._fetch_company_batch(supabase, batch_size)

        if not profiles:
            logger.info("[CHWatcher] No companies to check")
            return {"companies_checked": 0, "changes_detected": 0}

        logger.info("[CHWatcher] Checking %d companies", len(profiles))

        total_changes = 0
        companies_checked = 0
        change_summary: list[dict] = []

        for profile in profiles:
            company_number = profile.get("companies_house_number")
            profile_id = profile.get("id")

            if not company_number or not profile_id:
                continue

            try:
                result = await self._check_company(
                    ch_api=ch_api,
                    supabase=supabase,
                    profile=profile,
                )
                companies_checked += 1

                if result["changes_detected"] > 0:
                    total_changes += result["changes_detected"]
                    change_summary.append({
                        "profile_id": profile_id,
                        "company_number": company_number,
                        "changes": result["changes_detected"],
                    })

            except Exception as e:
                logger.error(
                    "[CHWatcher] Error checking %s: %s",
                    company_number, str(e)[:200],
                )
                # Update failure count
                try:
                    failure_count = (profile.get("failure_count") or 0) + 1
                    supabase.table("company_profiles").update({
                        "failure_count": failure_count,
                        "last_error": str(e)[:500],
                    }).eq("id", profile_id).execute()
                except Exception:
                    pass

        logger.info(
            "[CHWatcher] Pipeline complete: %d checked, %d changes detected",
            companies_checked, total_changes,
        )

        return {
            "companies_checked": companies_checked,
            "changes_detected": total_changes,
            "change_summary": change_summary,
        }

    def _fetch_company_batch(self, supabase: Any, batch_size: int) -> list[dict]:
        """Fetch batch of company profiles prioritised by oldest check date."""
        # Prioritise companies that haven't been checked recently:
        # 1. next_enrichment_due in the past (overdue)
        # 2. enriched_at oldest first (least recently checked)
        result = (
            supabase.table("company_profiles")
            .select(
                "id, sponsor_id, companies_house_number, company_status, "
                "last_accounts_date, charge_count, has_charges, "
                "has_insolvency_history, accounts_overdue, "
                "confirmation_statement_overdue, credit_risk_score, "
                "enriched_at, failure_count"
            )
            .not_.is_("companies_house_number", "null")
            .neq("companies_house_number", "")
            .order("enriched_at", desc=False, nulls_first=True)
            .limit(batch_size)
            .execute()
        )
        return result.data or []

    async def _check_company(
        self,
        ch_api: CompaniesHouseAPI,
        supabase: Any,
        profile: dict,
    ) -> dict:
        """Run all sub-agents for a single company and process results."""
        company_number = profile["companies_house_number"]
        profile_id = profile["id"]
        now = datetime.now(timezone.utc)

        last_check = profile.get("enriched_at")
        changes_detected = 0
        news_events: list[dict] = []

        # --- Filing Checker ---
        filing_checker = self.get_sub_agent("filing_checker")
        filing_result: SubAgentResult = await filing_checker.execute(
            ch_api=ch_api,
            company_number=company_number,
            stored_last_accounts_date=profile.get("last_accounts_date"),
        )
        if filing_result.success and filing_result.data:
            new_filings = filing_result.data.get("new_filings", [])
            if new_filings:
                changes_detected += len(new_filings)
                for filing in new_filings:
                    news_events.append({
                        "profile_id": profile_id,
                        "headline": (
                            f"New filing: {filing.get('category', 'unknown')} "
                            f"- {filing.get('description', 'No description')}"
                        ),
                        "source": "companies_house",
                        "published_at": filing.get("date"),
                        "sentiment": "neutral",
                        "is_risk_signal": False,
                        "keywords": ["filing", filing.get("category", "")],
                        "created_at": now.isoformat(),
                    })

        # --- Status Monitor ---
        status_monitor = self.get_sub_agent("status_monitor")
        status_result: SubAgentResult = await status_monitor.execute(
            ch_api=ch_api,
            company_number=company_number,
            stored_status=profile.get("company_status"),
        )
        status_data = {}
        if status_result.success and status_result.data:
            status_data = status_result.data
            if status_data.get("changed"):
                changes_detected += 1
                risk_level = status_data.get("risk_level", "medium")
                sentiment = "negative" if risk_level in ("high", "critical") else "neutral"
                news_events.append({
                    "profile_id": profile_id,
                    "headline": (
                        f"Company status changed: "
                        f"{status_data.get('previous_status', 'unknown')} → "
                        f"{status_data.get('status', 'unknown')}"
                    ),
                    "source": "companies_house",
                    "published_at": now.isoformat(),
                    "sentiment": sentiment,
                    "is_risk_signal": risk_level in ("high", "critical"),
                    "keywords": ["status_change", status_data.get("status", "")],
                    "created_at": now.isoformat(),
                })

        # --- Officer Tracker ---
        officer_tracker = self.get_sub_agent("officer_tracker")
        officer_result: SubAgentResult = await officer_tracker.execute(
            ch_api=ch_api,
            company_number=company_number,
            last_check_date=last_check,
        )
        if officer_result.success and officer_result.data:
            officer_changes = officer_result.data.get("changes", [])
            if officer_changes:
                changes_detected += len(officer_changes)
                for change in officer_changes:
                    is_resignation = change.get("type") == "resignation"
                    news_events.append({
                        "profile_id": profile_id,
                        "headline": (
                            f"Officer {change.get('type', 'change')}: "
                            f"{change.get('name', 'Unknown')} "
                            f"({change.get('role', 'unknown')})"
                        ),
                        "source": "companies_house",
                        "published_at": change.get("date"),
                        "sentiment": "negative" if is_resignation else "neutral",
                        "is_risk_signal": is_resignation,
                        "keywords": ["officer", change.get("type", "change")],
                        "created_at": now.isoformat(),
                    })

        # --- Financial Health ---
        financial_health = self.get_sub_agent("financial_health")
        health_result: SubAgentResult = await financial_health.execute(
            ch_api=ch_api,
            company_number=company_number,
            stored_charge_count=profile.get("charge_count"),
            company_status=status_data.get("status") or profile.get("company_status"),
        )
        health_data = {}
        if health_result.success and health_result.data:
            health_data = health_result.data
            if health_data.get("has_new_charges"):
                changes_detected += 1
                news_events.append({
                    "profile_id": profile_id,
                    "headline": (
                        f"New charges registered "
                        f"(total: {health_data.get('charge_count', 0)})"
                    ),
                    "source": "companies_house",
                    "published_at": now.isoformat(),
                    "sentiment": "negative",
                    "is_risk_signal": True,
                    "keywords": ["charges", "financial"],
                    "created_at": now.isoformat(),
                })

        # Step 4: Write change events to company_news
        if news_events:
            try:
                supabase.table("company_news").insert(news_events).execute()
            except Exception as e:
                logger.error(
                    "[CHWatcher] Failed to insert news events for %s: %s",
                    company_number, str(e)[:200],
                )

        # Step 5: Update company_profile with latest data
        update_data: dict[str, Any] = {
            "enriched_at": now.isoformat(),
            "failure_count": 0,
            "last_error": None,
        }

        if status_data.get("status"):
            update_data["company_status"] = status_data["status"]
        if status_data.get("has_charges") is not None:
            update_data["has_charges"] = status_data["has_charges"]
        if status_data.get("has_insolvency_history") is not None:
            update_data["has_insolvency_history"] = status_data["has_insolvency_history"]
        if status_data.get("accounts_overdue") is not None:
            update_data["accounts_overdue"] = status_data["accounts_overdue"]
        if status_data.get("confirmation_statement_overdue") is not None:
            update_data["confirmation_statement_overdue"] = status_data[
                "confirmation_statement_overdue"
            ]
        if status_data.get("last_accounts_date"):
            update_data["last_accounts_date"] = status_data["last_accounts_date"]

        if health_data.get("credit_risk_score") is not None:
            update_data["credit_risk_score"] = health_data["credit_risk_score"]
        if health_data.get("charge_count") is not None:
            update_data["charge_count"] = health_data["charge_count"]

        try:
            supabase.table("company_profiles").update(
                update_data
            ).eq("id", profile_id).execute()
        except Exception as e:
            logger.error(
                "[CHWatcher] Failed to update profile %s: %s",
                profile_id, str(e)[:200],
            )

        return {"changes_detected": changes_detected}
