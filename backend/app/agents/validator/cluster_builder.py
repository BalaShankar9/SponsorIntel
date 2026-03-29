"""Yusuf Diallo — Cluster Analysis Specialist (Validation department)."""

from __future__ import annotations

import logging
import time
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

DEFAULT_THRESHOLD = 85


class _UnionFind:
    """Disjoint-set / union-find data structure."""

    def __init__(self, n: int) -> None:
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]  # path compression
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1


class ClusterBuilder(BaseSubAgent):
    """Build deduplication clusters from pairwise similarity scores using union-find."""

    name = "cluster_builder"
    persona = "Yusuf Diallo"
    title = "Cluster Analysis Specialist"
    agent_type = "DET"
    description = (
        "Groups duplicate/near-duplicate jobs into clusters using union-find "
        "on similarity scores above a configurable threshold (default 85)."
    )

    # ------------------------------------------------------------------
    async def run(self, **kwargs: Any) -> SubAgentResult:
        start = time.perf_counter()
        scores: list[dict] = kwargs.get("scores", [])
        num_jobs: int = kwargs.get("num_jobs", 0)
        threshold: float = kwargs.get("threshold", DEFAULT_THRESHOLD)

        try:
            uf = _UnionFind(num_jobs)

            for pair in scores:
                if pair["score"] >= threshold:
                    uf.union(pair["i"], pair["j"])

            # Build clusters: root -> [indices]
            clusters: dict[int, list[int]] = {}
            for idx in range(num_jobs):
                root = uf.find(idx)
                clusters.setdefault(root, []).append(idx)

            # Only keep clusters with duplicates (size > 1)
            dedup_clusters = {
                root: members for root, members in clusters.items() if len(members) > 1
            }

            duration = (time.perf_counter() - start) * 1000
            logger.info(
                "ClusterBuilder found %d dedup clusters from %d jobs in %.1fms",
                len(dedup_clusters),
                num_jobs,
                duration,
            )
            return SubAgentResult(
                success=True,
                data={"clusters": dedup_clusters, "num_duplicates": sum(len(m) - 1 for m in dedup_clusters.values())},
                duration_ms=duration,
                llm_calls=0,
            )

        except Exception as exc:
            duration = (time.perf_counter() - start) * 1000
            logger.exception("ClusterBuilder failed: %s", exc)
            return SubAgentResult(
                success=False, data={"clusters": {}, "num_duplicates": 0}, error=str(exc), duration_ms=duration, llm_calls=0
            )
