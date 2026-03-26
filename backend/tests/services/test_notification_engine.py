"""Tests for notification engine."""

import pytest
from unittest.mock import MagicMock, AsyncMock


class TestMatchesSubscription:
    def test_matches_high_impact_event(self):
        from app.services.notification_engine import matches_subscription
        event = {"topic": "rule_change", "impact_level": "critical", "visa_routes": ["Skilled Worker"]}
        sub = {"filter_min_impact": "medium", "filter_topics": [], "filter_visa_routes": [], "filter_industries": []}
        assert matches_subscription(event, sub) is True

    def test_rejects_low_impact_event(self):
        from app.services.notification_engine import matches_subscription
        event = {"topic": "news", "impact_level": "low", "visa_routes": []}
        sub = {"filter_min_impact": "medium"}
        assert matches_subscription(event, sub) is False

    def test_filters_by_topic(self):
        from app.services.notification_engine import matches_subscription
        event = {"topic": "statistics", "impact_level": "high", "visa_routes": []}
        sub = {"filter_min_impact": "medium", "filter_topics": ["rule_change", "policy_update"]}
        assert matches_subscription(event, sub) is False

    def test_filters_by_visa_route(self):
        from app.services.notification_engine import matches_subscription
        event = {"topic": "rule_change", "impact_level": "high", "visa_routes": ["Graduate"]}
        sub = {"filter_min_impact": "low", "filter_topics": [], "filter_visa_routes": ["Skilled Worker"]}
        assert matches_subscription(event, sub) is False

    def test_matches_overlapping_routes(self):
        from app.services.notification_engine import matches_subscription
        event = {"topic": "rule_change", "impact_level": "high", "visa_routes": ["Skilled Worker", "Graduate"]}
        sub = {"filter_min_impact": "low", "filter_topics": [], "filter_visa_routes": ["Skilled Worker"], "filter_industries": []}
        assert matches_subscription(event, sub) is True

    def test_no_filters_matches_all_above_impact(self):
        from app.services.notification_engine import matches_subscription
        event = {"topic": "news", "impact_level": "high", "visa_routes": ["Global Talent"]}
        sub = {"filter_min_impact": "medium", "filter_topics": [], "filter_visa_routes": [], "filter_industries": []}
        assert matches_subscription(event, sub) is True


class TestDispatchNotification:
    @pytest.mark.asyncio
    async def test_in_app_notification(self):
        from app.services.notification_engine import dispatch_notification
        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        await dispatch_notification(sb, "user1", "sub1", "item1", "Test Alert", "Body", "in_app")
        sb.table.assert_called_with("intel_notifications")


class TestProcessIntelEvent:
    @pytest.mark.asyncio
    async def test_sends_matching_notifications(self):
        from app.services.notification_engine import process_intel_event
        sb = MagicMock()
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[
            {"id": "sub1", "user_id": "user1", "filter_min_impact": "medium",
             "filter_topics": [], "filter_visa_routes": [], "filter_industries": [],
             "channel": "in_app", "is_active": True},
        ])
        sb.table.return_value.insert.return_value.execute.return_value = None

        event = {"id": "item1", "title": "Salary Threshold Change", "impact_level": "critical",
                 "topic": "rule_change", "visa_routes": ["Skilled Worker"]}
        sent = await process_intel_event(sb, event)
        assert sent == 1
