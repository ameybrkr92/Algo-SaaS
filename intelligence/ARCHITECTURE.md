# India Financial Reasoning Engine — Architecture

The intelligence layer beneath the [Cockpit](../cockpit/DESIGN_SYSTEM.md). The cockpit
is the *cockpit*; this is the *brain*. Goal is **discovery and explanation**, not price
prediction: understand the Indian financial system as a connected, causal, time-evolving
graph and reason over it.

> **Working prototype already runs:** [`propagate.py`](./propagate.py) — a hand-seeded
> India graph + a causal event-propagation engine that answers the 8 questions for a
> macro/commodity shock (try `python propagate.py crude`). It proves Pillars 1-3.

---

## 0. The core idea — nine pillars, one substrate

All nine pillars are layers over **one substrate**: a *causal knowledge graph* + a
*temporal memory store*. The "engines" are algorithms over that substrate; an LLM
(Claude) is the orchestrator that turns a question into graph queries + explainable chains.

```
              ┌──────────────── ORCHESTRATOR (Claude, tool-use) ───────────────┐
              │   answers: what happened · why · what next · who benefits ·     │
              │   who's hurt · which assumptions · which opportunities · gaps   │
              └───────────────────────────────┬────────────────────────────────┘
   ENGINES   causal · propagation · hypothesis · counterfactual · simulator · alpha
              └───────────────────────────────┼────────────────────────────────┘
   SUBSTRATE         KNOWLEDGE GRAPH  +  MARKET MEMORY (events, predictions, outcomes)
              └───────────────────────────────┼────────────────────────────────┘
   INGESTION            LLM extraction: entities · relationships · events (with provenance)
              └───────────────────────────────┼────────────────────────────────┘
   SOURCES        NSE/prices · RBI/macro · SEBI/filings · announcements · financials · news
```

| Pillar | Is really… | Status |
| --- | --- | --- |
| 1 Knowledge Graph | the substrate (nodes + typed, weighted, confidence-scored edges) | prototype ✓ |
| 2 Causal Reasoning | directed causal edges (sign + lag + strength) + chain traversal | prototype ✓ |
| 3 Event Propagation | impulse → weighted path traversal with decay → impact report | prototype ✓ |
| 4 Market Memory | temporal store + outcome tracking + confidence calibration | design |
| 5 Opportunity Discovery | graph scans: high-impact × low-coverage, structural shifts | prototype (seed) ✓ |
| 6 Hypothesis Lab | event-conditioned historical analogs + evidence/confidence | design |
| 7 Counterfactual | perturb a node/edge → re-propagate → alternate future | design (engine reusable) |
| 8 World Simulator | macro shock → system-wide effects (system-dynamics) | design |
| 9 Alpha Discovery | continuous weak-signal / leading-indicator scans | design |

## 1. Data model

**Node** — `id, name, type, sector, attrs, coverage`. Types: `company, sector,
commodity, macro (rate/CPI/INR/GDP), institution (RBI/SEBI/Govt), person, theme
(EV/defence/infra), product, geography, event`. `coverage` ∈ [0,1] = analyst/news
attention (low coverage + high impact = mispriced → opportunity signal).

**Edge** — a typed, directed relationship carrying everything reasoning needs:
| Field | Meaning |
| --- | --- |
| `type` | supplies_to · customer_of · competes_with · subsidiary_of · exposed_to · regulated_by · member_of · **causes** · correlated_with · benefits_from / hurt_by |
| `sign` | for causal edges, sign of d(dst)/d(src): +1 or −1 |
| `strength` | 0-1 magnitude of the effect |
| `confidence` | 0-1 how sure we are the edge is real |
| `lag` | typical time for the effect to show (days) |
| `provenance` | source + extraction method + date (every edge is traceable) |
| `valid_from/to` | temporal — relationships change; the graph is time-aware |

Causal edges are kept distinct from correlational ones — **never reason on correlation alone**.

## 2. The engines

- **Causal (P2)** — maintains the causal sub-graph; traverses explainable chains with
  sign/strength/lag/confidence. (`propagate.py` does this today.)
- **Propagation (P3)** — injects an event impulse on seed nodes; DFS over simple causal
  paths with per-hop decay; accumulates signed impact + path confidence + horizon per
  node; ranks beneficiaries vs hurt; surfaces the dominant chain for each. *Done.*
- **Memory & calibration (P4)** — logs every event/prediction/scenario with a horizon;
  when the horizon elapses, compares predicted direction/magnitude vs realised (price /
  earnings); scores it (hit-rate, Brier); **Bayesian-updates edge confidence** so the
  graph gets more accurate every year. This is the institutional memory.
- **Hypothesis Lab (P6)** — "what historically happens after RBI rate cuts?" → finds
  analog events in memory, computes conditional outcome stats + evidence + confidence.
- **Counterfactual (P7)** — perturb a node/edge ("what if crude → $40", "what if RBI
  hadn't hiked") and re-run propagation → an alternate future with its own chains.
- **World Simulator (P8)** — macro shocks (rate/inflation/currency/trade-war/supply-chain)
  as multi-variable system-dynamics over the graph, not price charts.
- **Opportunity / Alpha (P5, P9)** — continuous scans: high-impact × low-coverage nodes,
  newly-formed or strengthening edges, leading indicators, structural shifts.

## 3. The 8 questions → which engine answers

| Question | Engine |
| --- | --- |
| What happened? | Event ingestion |
| Why did it happen? | Causal chain (P2) |
| What happens next? | Propagation + horizons (P3) |
| Who benefits? / Who's hurt? | Propagation ranking (P3) |
| Which assumptions changed? | Highest-leverage edges + calibration (P2/P4) |
| Which opportunities emerge? | Opportunity scan (P5) |
| What is the market missing? | High-impact × low-coverage (P5/P9) |

## 4. Orchestration (the AI copilot's brain)

Claude is given **tools**, not free rein to invent facts:
`graph_query(cypher)`, `run_propagation(event)`, `historical_analogs(event_type)`,
`counterfactual(perturbation)`, `calibration(edge)`. Given a question it queries the
graph, runs the engines, and composes an explainable answer **grounded in graph facts
with provenance** — so the reasoning is auditable, not hallucinated. This is the
"Claude-later" brain for the cockpit copilot.

## 5. How it surfaces in the Cockpit

New modules join the 11: **Graph** (interactive entity/relationship explorer), **Reasoning**
(event → impact chains, the 8 questions), **Scenarios** (counterfactual + world simulator
sliders), **Opportunities** (alpha feed). And the copilot's insights everywhere become
graph-grounded: "Oil India is an under-covered beneficiary of the crude move (+0.55, 35%
coverage)" instead of a vibe.

## 6. Tech stack

| Concern | MVP | Production |
| --- | --- | --- |
| Graph | start in-process (Python dicts → `networkx`) | **Neo4j** (Cypher, multi-hop, viz) or Postgres + Apache AGE |
| Temporal / memory | DuckDB / Postgres | Postgres (events, predictions, outcomes, calibration) |
| Docs + embeddings | Chroma / `pgvector` | pgvector — news/filings retrieval + entity linking |
| Time series | DuckDB | Postgres / Timescale (prices, macro) |
| Ingestion | Python ETL + Claude extraction | + schedulers (the platform already runs APScheduler) |
| Reasoning service | FastAPI/Flask exposing the engines | same, scaled; jobs for scans |
| Prices / NSE 500 | the OpenAlgo engine (your live broker) | same |

## 7. Data sources (India MVP) — and the honest reality

MVP scope = India, top 500 NSE, RBI, SEBI, announcements, financials, macro, news,
supply-chain. Sources: prices/constituents via the OpenAlgo engine; **RBI DBIE**
(rates, macro); **MoSPI** (CPI/IIP); **NSE/BSE corporate announcements** + **SEBI**
filings; annual reports (PDF); news RSS (Moneycontrol/ET/BS/Mint).

> **The hard part — say it plainly.** A high-quality India *supply-chain / relationship*
> graph is **not** freely available as structured data. It is built by LLM-extracting
> customer/supplier/exposure mentions from annual reports (MD&A, segment notes) + news +
> a curated seed for the top names, all with provenance and confidence. That curation is
> the real moat **and** the real cost. The engine is buildable in weeks; the *graph
> content* is a continuous program. Also mind data licensing/ToS (NSE/Screener scraping)
> and PDF parsing. The calibration loop (P4) is what turns hand-seeded guesses into
> validated edges over time.

## 8. Phased roadmap

- **Phase A — Spine (in progress).** Seed graph + causal propagation + the 8-question
  report. `propagate.py` runs today. Next: wire it behind a `/reasoning` API and a
  cockpit **Reasoning** tab; add counterfactual (reuses propagation) and a graph viz.
- **Phase B — Ingestion.** LLM extraction pipeline (news + announcements → entities,
  events, relationships with provenance/confidence) auto-growing the graph; live event
  stream feeds propagation.
- **Phase C — Memory & calibration.** Log predictions, score outcomes, Bayesian-update
  edge confidence; Hypothesis Lab (historical analogs).
- **Phase D — Simulator + Alpha.** Macro world-simulator, continuous opportunity/alpha
  scans, leading-indicator detection.

## 9. Open decisions
1. Graph DB: Neo4j (best graph UX) vs single Postgres+AGE (one DB to run). 
2. How much manual seed curation up front vs. lean on LLM extraction (accuracy vs speed).
3. News/financials data source + its licensing.
4. Where the reasoning service lives (inside the OpenAlgo Flask app vs a separate service).
