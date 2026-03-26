"""Reinforcement learning loop for agent strategy optimization.

Agents learn which enrichment strategies produce the best results
for different company types using Q-learning.
"""

import logging
import random
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Reward signals
REWARDS = {
    "sponsorship_confirmed": 10.0,
    "job_discovered": 5.0,
    "useful_enrichment": 2.0,
    "stale_data": -3.0,
    "api_error": -5.0,
    "false_positive": -10.0,
}


class AgentLearner:
    """Q-learning agent for strategy optimization."""

    def __init__(self, agent_id: str, supabase=None, epsilon: float = 0.1, alpha: float = 0.1, gamma: float = 0.9):
        self.agent_id = agent_id
        self.supabase = supabase
        self.epsilon = epsilon  # Exploration rate
        self.alpha = alpha      # Learning rate
        self.gamma = gamma      # Discount factor
        self._q_cache: dict[str, dict[str, float]] = {}

    def encode_state(self, sector: str = "", size: str = "", region: str = "", rating: str = "") -> str:
        """Encode company attributes into a state key."""
        return f"{sector}|{size}|{region}|{rating}"

    async def choose_action(self, state_key: str, available_actions: list[str]) -> str:
        """Choose an action using epsilon-greedy strategy."""
        if not available_actions:
            return ""

        # Explore with probability epsilon
        if random.random() < self.epsilon:
            return random.choice(available_actions)

        # Exploit: choose best known action
        q_values = await self._get_q_values(state_key)
        best_action = max(available_actions, key=lambda a: q_values.get(a, 0.0))
        return best_action

    async def update(self, state_key: str, action: str, reward: float, next_state_key: str = ""):
        """Update Q-value for a state-action pair."""
        if not self.supabase:
            return

        q_values = await self._get_q_values(state_key)
        old_q = q_values.get(action, 0.0)

        # Q-learning update
        next_q_values = await self._get_q_values(next_state_key) if next_state_key else {}
        max_next_q = max(next_q_values.values()) if next_q_values else 0.0
        new_q = old_q + self.alpha * (reward + self.gamma * max_next_q - old_q)

        # Persist to Supabase
        try:
            self.supabase.table("agent_learning").upsert({
                "agent_id": self.agent_id,
                "state_key": state_key,
                "action": action,
                "q_value": new_q,
                "visit_count": (await self._get_visit_count(state_key, action)) + 1,
                "avg_reward": reward,  # Simplified: just latest reward
                "last_updated_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="agent_id,state_key,action").execute()

            # Update cache
            if state_key not in self._q_cache:
                self._q_cache[state_key] = {}
            self._q_cache[state_key][action] = new_q

        except Exception as e:
            logger.debug(f"[{self.agent_id}] Learning update failed: {e}")

    async def get_skill_level(self, state_key: str) -> dict:
        """Get agent's skill level for a given state."""
        q_values = await self._get_q_values(state_key)
        if not q_values:
            return {"level": "novice", "best_action": None, "confidence": 0.0}

        best_action = max(q_values, key=q_values.get)
        max_q = q_values[best_action]

        if max_q > 5.0:
            level = "expert"
        elif max_q > 2.0:
            level = "proficient"
        elif max_q > 0.0:
            level = "learning"
        else:
            level = "novice"

        return {"level": level, "best_action": best_action, "confidence": max_q, "actions": q_values}

    async def _get_q_values(self, state_key: str) -> dict[str, float]:
        """Get Q-values for a state from cache or DB."""
        if state_key in self._q_cache:
            return self._q_cache[state_key]

        if not self.supabase:
            return {}

        try:
            result = self.supabase.table("agent_learning").select(
                "action, q_value"
            ).eq("agent_id", self.agent_id).eq("state_key", state_key).execute()

            q_values = {row["action"]: row["q_value"] for row in (result.data or [])}
            self._q_cache[state_key] = q_values
            return q_values
        except Exception:
            return {}

    async def _get_visit_count(self, state_key: str, action: str) -> int:
        """Get visit count for a state-action pair."""
        if not self.supabase:
            return 0
        try:
            result = self.supabase.table("agent_learning").select(
                "visit_count"
            ).eq("agent_id", self.agent_id).eq("state_key", state_key).eq("action", action).limit(1).execute()
            if result.data:
                return result.data[0]["visit_count"]
        except Exception:
            pass
        return 0
