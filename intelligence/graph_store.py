#!/usr/bin/env python3
"""Graph store abstraction — the seam between in-process now and Neo4j later.

Two backends behind one interface so the rest of the system never cares which is
running:
  • MemoryStore  — dict-backed, zero deps (default; what the engine uses today).
  • Neo4jStore   — idempotent Cypher MERGE upserts (opt-in via env, for scale).

Every node and edge is provenance-aware: each observation records its source,
method (seed / llm / rule), confidence and timestamp, so any fact in the graph is
traceable — which is what lets calibration (Pillar 4) score and trust edges later.

Choose a backend with env:
    NEO4J_URI=bolt://localhost:7687 NEO4J_USER=neo4j NEO4J_PASSWORD=...  -> Neo4jStore
    (unset)                                                              -> MemoryStore
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class Provenance:
    source: str            # e.g. "NSE announcement", "seed graph", "Moneycontrol"
    method: str            # "seed" | "llm" | "rule"
    confidence: float
    observed_at: str = field(default_factory=_now)
    url: str | None = None

    def as_dict(self):
        return {"source": self.source, "method": self.method,
                "confidence": self.confidence, "observed_at": self.observed_at, "url": self.url}


class GraphStore:
    """Interface. Both backends are idempotent: re-observing merges, never duplicates."""

    def upsert_node(self, nid, name, ntype, coverage=None, prov: Provenance | None = None): ...
    def upsert_edge(self, src, dst, etype, sign, strength, confidence, lag, rationale,
                    prov: Provenance | None = None): ...
    def stats(self) -> dict: ...


# --------------------------------------------------------------------------- #
class MemoryStore(GraphStore):
    def __init__(self):
        self.nodes: dict[str, dict] = {}
        self.edges: dict[tuple, dict] = {}

    def upsert_node(self, nid, name, ntype, coverage=None, prov=None):
        n = self.nodes.get(nid)
        if n is None:
            n = self.nodes[nid] = {"id": nid, "name": name, "type": ntype,
                                   "coverage": coverage if coverage is not None else 0.5, "prov": []}
        else:
            if name:
                n["name"] = name
            if coverage is not None:
                n["coverage"] = coverage
        if prov:
            n["prov"].append(prov.as_dict())
        return n

    def upsert_edge(self, src, dst, etype, sign, strength, confidence, lag, rationale, prov=None):
        key = (src, dst, etype)
        e = self.edges.get(key)
        if e is None:
            e = self.edges[key] = {"src": src, "dst": dst, "type": etype, "sign": sign,
                                   "strength": strength, "confidence": confidence, "lag": lag,
                                   "rationale": rationale, "prov": []}
        else:
            # re-observation reinforces confidence (simple bump; calibration refines later)
            e["confidence"] = min(0.99, e["confidence"] + (1 - e["confidence"]) * 0.25)
        if prov:
            e["prov"].append(prov.as_dict())
        return e

    def stats(self):
        return {"backend": "memory", "nodes": len(self.nodes), "edges": len(self.edges)}


# --------------------------------------------------------------------------- #
class Neo4jStore(GraphStore):
    """Cypher backend. Dynamic relationship semantics live on a `type` property of a
    single :REL type, so no APOC is required. Run a Neo4j instance, then set env."""

    def __init__(self, uri, user, password):
        try:
            from neo4j import GraphDatabase
        except ModuleNotFoundError as e:
            raise RuntimeError("Neo4jStore needs the driver: `uv add neo4j`") from e
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        with self.driver.session() as s:
            s.run("CREATE CONSTRAINT entity_id IF NOT EXISTS "
                  "FOR (n:Entity) REQUIRE n.id IS UNIQUE")

    def upsert_node(self, nid, name, ntype, coverage=None, prov=None):
        with self.driver.session() as s:
            s.run(
                "MERGE (n:Entity {id:$id}) "
                "SET n.name=coalesce($name,n.name), n.type=coalesce($type,n.type), "
                "    n.coverage=coalesce($coverage,n.coverage) "
                "FOREACH (_ IN CASE WHEN $prov IS NULL THEN [] ELSE [1] END | "
                "  MERGE (so:Source {key:$psource}) "
                "  MERGE (n)-[r:SOURCED {method:$pmethod, at:$pat}]->(so) "
                "  SET r.confidence=$pconf, r.url=$purl)",
                id=nid, name=name, type=ntype, coverage=coverage,
                prov=(prov.as_dict() if prov else None),
                psource=(prov.source if prov else None), pmethod=(prov.method if prov else None),
                pconf=(prov.confidence if prov else None), pat=(prov.observed_at if prov else None),
                purl=(prov.url if prov else None))

    def upsert_edge(self, src, dst, etype, sign, strength, confidence, lag, rationale, prov=None):
        with self.driver.session() as s:
            s.run(
                "MERGE (a:Entity {id:$src}) MERGE (b:Entity {id:$dst}) "
                "MERGE (a)-[r:REL {type:$etype}]->(b) "
                "SET r.sign=$sign, r.strength=$strength, "
                "    r.confidence=coalesce(r.confidence,0)+ (1-coalesce(r.confidence,0))*0 + $confidence*0, "
                "    r.confidence=$confidence, r.lag=$lag, r.rationale=$rationale, "
                "    r.source=coalesce($psource,r.source), r.method=coalesce($pmethod,r.method)",
                src=src, dst=dst, etype=etype, sign=sign, strength=strength,
                confidence=confidence, lag=lag, rationale=rationale,
                psource=(prov.source if prov else None), pmethod=(prov.method if prov else None))

    def stats(self):
        with self.driver.session() as s:
            n = s.run("MATCH (n:Entity) RETURN count(n) AS c").single()["c"]
            e = s.run("MATCH ()-[r:REL]->() RETURN count(r) AS c").single()["c"]
        return {"backend": "neo4j", "nodes": n, "edges": e}


def get_store() -> GraphStore:
    uri = os.getenv("NEO4J_URI")
    if uri:
        return Neo4jStore(uri, os.getenv("NEO4J_USER", "neo4j"), os.getenv("NEO4J_PASSWORD", ""))
    return MemoryStore()
