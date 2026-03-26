"""Tests for reinforcement learning loop."""

import pytest
from unittest.mock import MagicMock, AsyncMock


class TestAgentLearner:
    def test_encode_state(self):
        from app.agents.learning import AgentLearner
        learner = AgentLearner(agent_id="test")
        state = learner.encode_state(sector="fintech", size="medium", region="london", rating="A")
        assert state == "fintech|medium|london|A"

    @pytest.mark.asyncio
    async def test_choose_action_explores(self):
        from app.agents.learning import AgentLearner
        import random
        random.seed(42)
        learner = AgentLearner(agent_id="test", epsilon=1.0)  # Always explore
        action = await learner.choose_action("state1", ["scrape_linkedin", "scrape_glassdoor", "scrape_ch"])
        assert action in ["scrape_linkedin", "scrape_glassdoor", "scrape_ch"]

    @pytest.mark.asyncio
    async def test_choose_action_exploits(self):
        from app.agents.learning import AgentLearner
        learner = AgentLearner(agent_id="test", epsilon=0.0)  # Always exploit
        learner._q_cache["state1"] = {"action_a": 5.0, "action_b": 2.0, "action_c": 8.0}
        action = await learner.choose_action("state1", ["action_a", "action_b", "action_c"])
        assert action == "action_c"  # Highest Q-value

    @pytest.mark.asyncio
    async def test_update_q_value(self):
        from app.agents.learning import AgentLearner
        sb = MagicMock()
        sb.table.return_value.upsert.return_value.execute.return_value = None
        sb.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])

        learner = AgentLearner(agent_id="test", supabase=sb)
        await learner.update("state1", "action_a", reward=10.0)
        sb.table.assert_any_call("agent_learning")

    @pytest.mark.asyncio
    async def test_get_skill_level_novice(self):
        from app.agents.learning import AgentLearner
        learner = AgentLearner(agent_id="test")
        skill = await learner.get_skill_level("unknown_state")
        assert skill["level"] == "novice"

    @pytest.mark.asyncio
    async def test_get_skill_level_expert(self):
        from app.agents.learning import AgentLearner
        learner = AgentLearner(agent_id="test")
        learner._q_cache["known_state"] = {"best_action": 7.5, "other": 2.0}
        skill = await learner.get_skill_level("known_state")
        assert skill["level"] == "expert"
        assert skill["best_action"] == "best_action"

    def test_rewards_defined(self):
        from app.agents.learning import REWARDS
        assert REWARDS["sponsorship_confirmed"] == 10.0
        assert REWARDS["false_positive"] == -10.0
