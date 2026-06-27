# India Financial Reasoning Engine

The intelligence layer ("the brain") beneath the [Cockpit](../cockpit/). Full design
in [ARCHITECTURE.md](./ARCHITECTURE.md). All parts read from one canonical engine, so
there's no logic drift.

## Files
| File | Role |
| --- | --- |
| `engine.py` | Canonical graph (~80 nodes) + causal propagation + structured `analyze()`. |
| `propagate.py` | CLI over the engine — explainable 8-question report. |
| `service.py` | Flask + CORS reasoning **API** (`:6061`). The cockpit calls this. |
| `graph_store.py` | Graph store abstraction — `MemoryStore` (default) + `Neo4jStore` (opt-in). |
| `ingest.py` | **Ingestion** — text → extract (Claude or rules) → merge into the store with provenance. |

## Run

```bash
# CLI reasoning (no deps):
python propagate.py ev_push          # also: crude repo inr infra_boom defence_push stagflation

# Reasoning API (uses the project venv; the cockpit fetches from it):
uv run python service.py             # http://127.0.0.1:6061/reasoning/scenarios

# Ingestion — grow the graph from sample announcements:
python ingest.py                     # rule-based (offline). Set ANTHROPIC_API_KEY for the LLM path.
```

## Ingestion: rule vs LLM
- **No key** → deterministic gazetteer + trigger-phrase extractor. Real, but low recall and
  naive on edge *direction* (e.g. it may invert a supplier relationship). Good enough to prove
  the merge + provenance loop end-to-end.
- **`ANTHROPIC_API_KEY` set** → Claude returns structured `{entities, events, relationships}`
  via a JSON-schema prompt (`INGEST_MODEL`, default Haiku). Higher recall, correct direction,
  richer typing. This is the production path.

## Neo4j (Phase 3 scale)
The store defaults to in-process memory. To use Neo4j:

```bash
# 1. run a Neo4j (Docker):
docker run -p7474:7474 -p7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:5
# 2. install the driver + point the env at it:
uv add neo4j
export NEO4J_URI=bolt://localhost:7687 NEO4J_USER=neo4j NEO4J_PASSWORD=password
python ingest.py                     # now writes to Neo4j (idempotent MERGE upserts)
```

`Neo4jStore` uses a single `:REL {type:…}` relationship so no APOC is required, and a
uniqueness constraint on `:Entity(id)`.

## Status & next
- ✅ Phases 1–2: graph + causal propagation + world-sim scenarios + API, wired into the cockpit.
- ✅ Phase 3 framework: provenance-aware store (memory + Neo4j), ingestion pipeline (LLM + rule),
  proven to grow the graph from text.
- ⏭ Next: real LLM extraction at volume; live feeds (NSE/BSE announcements, news RSS) on a
  schedule; **wire the engine to reason over the live store** (so an ingested "solar PLI" event
  surfaces Adani Green / Waaree automatically); then Phase 4 (memory + calibration).
