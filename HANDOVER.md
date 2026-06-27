# TradeYantra — Project Handover

> Read this first to continue the project in a fresh chat. It captures the vision,
> every decision, the directory map, how to run everything, what's done, and what's
> next. Last updated: 2026-06-27.

---

## 1. What this project is

**TradeYantra** — a personal, advanced, **AI-first algorithmic trading cockpit for
Indian markets**, built on top of the open-source **OpenAlgo** engine, with a custom
**9-pillar financial reasoning "brain"** underneath it.

Two halves:
1. **The cockpit** (the UI) — a dark, dense "trading terminal" dashboard. Trading
   surfaces (positions, options, charts, orders) + an always-present AI copilot.
2. **The brain** (the intelligence) — a causal knowledge graph of the Indian market
   that reasons about events: *what happened, why, what's next, who benefits, who's
   hurt, which assumptions changed, which opportunities emerge, what the market is
   missing.*

### How we got here (the arc)
- Started by white-labeling OpenAlgo → "TradeYantra" (light/blue theme) and even
  scaffolded a SaaS (control plane + provisioner). **That SaaS is now SHELVED.**
- **Pivoted to personal use only.** Decided to rebuild the UI from scratch as an
  advanced AI cockpit (dark terminal aesthetic) — a new Vite app, not the old frontend.
- Then specified and built the 9-pillar reasoning brain (all 4 phases, as a slice).
- Then built the real Vite cockpit app and wired the brain into it.

---

## 2. Key decisions (do NOT re-litigate these)

| Decision | Choice |
| --- | --- |
| Business model | **Personal use only.** SaaS is shelved (code still exists under `openalgo/saas/`). |
| UI | **Rebuild from scratch** as a dark, AI-first trading cockpit. |
| New app | **New Vite + React + TS app** (`tradeyantra-cockpit/`), NOT extending `openalgo/frontend`. |
| Aesthetic | **Dark trading-terminal**; blue `--accent` (#3B82F6), green/red reserved for P&L only, tabular-numeral prices. |
| Copilot AI | **Rules-based first, Claude later.** |
| Brain substrate | One **causal knowledge graph + temporal memory**; engines on top; Claude orchestrator (grounded in the graph, no hallucinated facts). |
| Graph store | **In-process Python now → Neo4j when ingestion scales** (Neo4j backend already written, opt-in). |
| Broker | **Zerodha** (Kite Connect), connected and working. |

---

## 3. Directory map

Workspace root: `C:\Users\ameyb\OneDrive\Desktop\Algo-trade\`

> **Note (2026-06-28):** when published to the public `Algo-SaaS` repo (whose root *is*
> `openalgo/`), `tradeyantra-cockpit/` and this `HANDOVER.md` were **moved inside
> `openalgo/`**. So the tree below shows them as root-siblings for history, but on disk
> they now live at `openalgo/tradeyantra-cockpit/` and `openalgo/HANDOVER.md`.

```
Algo-trade/
├─ HANDOVER.md                  ← this file
├─ openalgo/                    ← OpenAlgo engine, white-labeled to TradeYantra
│  ├─ .env                      ← REAL Zerodha Kite keys (gitignored, never commit)
│  ├─ app.py                    ← Flask backend / trading engine (port 5000)
│  ├─ frontend/                 ← OLD React 19 UI (white-labeled; being replaced)
│  ├─ saas/                     ← SHELVED (control-plane, provisioner, caddy)
│  ├─ cockpit/                  ← design artifacts for the new UI
│  │  ├─ DESIGN_SYSTEM.md       ← tokens, components, layout, the 11 modules, copilot model
│  │  └─ prototype.html         ← self-contained clickable dark cockpit (all modules + brain tabs)
│  └─ intelligence/             ← THE BRAIN
│     ├─ engine.py              ← canonical graph (~80 nodes) + causal propagation + analyze()
│     ├─ propagate.py           ← CLI over the engine
│     ├─ service.py             ← Flask reasoning API (port 6061)
│     ├─ graph_store.py         ← MemoryStore + Neo4jStore (opt-in)
│     ├─ ingest.py              ← ingestion pipeline (Claude or rule-based) → grows the graph
│     ├─ memory.py              ← calibration + hypothesis lab (SQLite memory.db)
│     ├─ ARCHITECTURE.md        ← full brain design (9 pillars → substrate + engines + orchestrator)
│     └─ README.md              ← how to run + Neo4j setup
└─ tradeyantra-cockpit/         ← THE NEW REAL APP (Vite + React 18 + TS) — the daily driver
   ├─ vite.config.ts            ← proxies /api,/auth→:5000 ; /reasoning,/memory,/hypothesis→:6061
   └─ src/
      ├─ main.tsx               ← router (13 routes)
      ├─ App.tsx                ← shell: NavRail + TopBar + Copilot + <Outlet>
      ├─ index.css              ← dark design system
      ├─ lib/
      │  ├─ api.ts              ← typed client: reasoning (GET) + trading /api/v1 (POST + API-key)
      │  ├─ useApi.ts           ← usePoll() — polls an endpoint, pauses when tab hidden
      │  └─ format.ts           ← ₹ / signed-₹ / % / up-down formatting (Indian grouping)
      ├─ components/            ← Icon.tsx, Copilot.tsx, DataState.tsx (graceful no-key/down panels)
      └─ pages/                 ← Cockpit.tsx (live), Folio.tsx (live), Risk.tsx (live),
                                   Setup.tsx (API key), Brain.tsx (Reason/…/Memory), Stub.tsx
```

---

## 4. How to run everything

Three processes (all from their dirs). On Windows, prefix Python with `PYTHONUTF8=1`
to avoid console unicode errors.

```bash
# 1. Trading backend (OpenAlgo engine) — port 5000
cd openalgo && PYTHONUTF8=1 uv run app.py

# 2. Reasoning API (the brain) — port 6061   [REQUIRED for the brain tabs]
cd openalgo && PYTHONUTF8=1 uv run python intelligence/service.py

# 3. The new cockpit app — port 5174  (now lives inside openalgo/)
cd openalgo/tradeyantra-cockpit && npm run dev
#    → open http://localhost:5174
```

Brain tabs (Reason/Scenario/Graph/Alpha/Memory) need #2 running, else they show a
friendly "start the API" message. Cockpit + Folio + Risk now read LIVE from #1 — paste
your OpenAlgo API key (from http://127.0.0.1:5000/apikey) into the cockpit's **Setup** tab
once; without it (or without #1 running) they show a graceful "connect / start engine"
state. Markets/Charts/Options/Trade are still prototype stubs (see §6).

To populate the Memory tab's calibration, run once:
`cd openalgo && PYTHONUTF8=1 python intelligence/memory.py`

Brain CLI (no servers needed):
`cd openalgo && PYTHONUTF8=1 python intelligence/propagate.py ev_push`
(scenarios: `crude repo inr crudedrop repocut ev_push infra_boom defence_push stagflation`)

Ingestion demo (grows the graph from sample text):
`cd openalgo && PYTHONUTF8=1 python intelligence/ingest.py`

### Ports
| Port | Service |
| --- | --- |
| 5000 | OpenAlgo Flask backend (`/api/v1`, old UI, the trading engine) |
| 8765 | OpenAlgo WebSocket (market data) |
| 6061 | Reasoning API (brain) — `/reasoning/*`, `/memory/calibration`, `/hypothesis` |
| 5174 | New Vite cockpit app |
| 6070 | (optional) static prototype.html via `python -m http.server` |
| 6060 | (shelved) SaaS control plane |

---

## 5. Status — what's DONE

**Trading platform (OpenAlgo, white-labeled):** ✅ rebranded to TradeYantra (light/blue
theme), Zerodha connected & live, runs locally.

**The brain — all 4 phases built & proven (on a hand-seeded ~80-node India graph):**
- ✅ Pillars 1-3 + 7: knowledge graph, causal reasoning, event propagation, counterfactual.
  CLI + API answer the 8 questions with explainable chains. Example wins: `crude +20%`
  surfaces IT-as-a-rupee-hedge and Oil India (under-covered); `ev_push` reproduces
  EV→battery→copper→transformers (Hindustan Copper, CG Power as hidden beneficiaries).
- ✅ Pillar 5/9 (opportunity/alpha): high-impact × low-coverage scan.
- ✅ Pillar 3 ingestion (Phase 3): provenance-aware graph store (memory + Neo4j),
  LLM/rule extraction that grows the graph from text (proven: 80→87 nodes, discovered
  Adani Green / Waaree / Solar from a press release).
- ✅ Pillar 4/6 (Phase 4): market memory + calibration (hit-rate, Brier, calibration
  curve, by-sector) + Hypothesis Lab. Proven: 75% hit-rate, Brier 0.238; catches the
  `crude→paints` edge failing.

**The cockpit UI:**
- ✅ Design system + a full clickable **prototype** (`openalgo/cockpit/prototype.html`)
  with all modules designed + the 5 brain tabs live.
- ✅ **The real Vite app** (`tradeyantra-cockpit/`): builds clean, 13 modules routing,
  dark shell + copilot, and the **5 brain tabs wired LIVE to the reasoning API**
  (verified: Memory tab pulls real calibration).
- ✅ **Cockpit + Folio + Risk wired to LIVE Zerodha data** (read-only slice, 2026-06-27/28):
  - API-key handling — key entered once on the new **Setup** page, stored in localStorage,
    injected into every `/api/v1` POST. Typed client + `usePoll` (auto-refresh ~5s, pauses
    when tab hidden) + graceful states (`no-key` → "Connect your broker", `down` → "engine
    not running", `bad-key`, `broker`/session-expired).
  - **Cockpit**: funds tiles (cash/margin/Day P&L/exposure/open-count), positions table,
    index pulse + watchlist via `multiquotes`. **Folio**: holdings + portfolio stats.
    **Risk**: margin-utilisation / exposure / concentration / Day-P&L tiles, margin gauge,
    exposure-by-position table, and a locally-set daily-loss kill-switch (alert only — no
    auto square-off; that's a write action for the Trade pass). All computed from funds +
    positions — no new endpoints. TopBar connection pill + Day P&L now honest.
  - Verified via browser preview: build clean, all graceful states correct, AND all three
    pages confirmed rendering populated data + correct ₹/%/P&L math (via a temporary fetch
    stub of `/api/v1` shapes). Full *live* values still pending an authenticated engine (§6).

---

## 6. What's NEXT (prioritized)

1. **Finish live trading data** — read-only Cockpit + Folio are DONE (see §5). Remaining:
   - **Live end-to-end verify:** start an *authenticated* engine (`uv run app.py` + complete
     the Zerodha login), paste the `/apikey` key into Setup → confirm real funds/positions/
     holdings/quotes render. (Verify the index-pulse symbols — `NIFTY`/`BANKNIFTY`/`FINNIFTY`
     on `NSE_INDEX`, `SENSEX` on `BSE_INDEX`, `INDIAVIX` — match your master contract; any
     mismatch just shows "—" per-card, non-breaking.)
   - **WebSocket feed** (port 8765) to replace the ~5s polling with streaming ticks.
   - **Remaining surfaces:** Markets / Charts / Options / Trade still on the prototype design
     (see item 2). **Trade = order placement (write/dangerous)** — give it its own pass with
     confirmations + the order-mode/approval flow; don't fold it into a read-only port.
2. **Port the prototype's module designs into React** — the prototype already has
   high-fidelity Markets (depth/heatmap), Charts (candles + order ticket), Options Lab
   (chain + payoff + Greeks), Trade, Portfolio, Risk. Translate them to components.
3. **Give the copilot Claude's brain** — replace the rules-based copilot with Claude
   tool-use over both APIs (the shell is in place). Needs `ANTHROPIC_API_KEY`.
4. **Brain → production data** (all data/infra-bound, not code-bound):
   - Turn on the Claude extractor + point ingestion at live feeds (NSE/BSE announcements,
     news RSS) on a schedule.
   - Stand up real Neo4j (`docker run … neo4j:5`; set `NEO4J_URI`) — backend code ready.
   - Wire the engine to reason over the *live* store (so an ingested "solar PLI" event
     surfaces Adani Green in propagation automatically).
   - Swap the illustrative analog seed in `memory.py` for a real backtest feed.

---

## 7. Honest constraints & gotchas

- **AGPL-3.0** — OpenAlgo is AGPL. Keep the "Built on OpenAlgo" attribution; if ever run
  as a service for others, source must be available. (Personal use is unrestricted.)
- **SEBI** — algo-trading regs (broker empanelment, per-user static IP) only bite if you
  go multi-user. Personal use with your own broker creds + IP is fine.
- **Env limits during the build sessions:** no Docker/Neo4j and no `ANTHROPIC_API_KEY`
  were available, so the Neo4j backend is written-but-unrun and ingestion used the
  rule-based extractor. On your own machine, set the key and run Neo4j to switch them on.
- **The reasoning API must be running** for brain tabs (manual `uv run`); consider running
  it as a service. It also tends to get killed between sessions — just restart it.
- **Windows:** use `PYTHONUTF8=1` for the Python CLIs (unicode in output).
- **Secrets:** `openalgo/.env` holds the real Kite keys; it is gitignored — never commit
  it. Kite app's redirect URL must be `http://127.0.0.1:5000/zerodha/callback`.
- **Preview tooling works** via the Claude Preview MCP (`launch.json` has a
  `tradeyantra-vite` config on :5174) — used it this session to verify the live-data
  wiring (snapshots, screenshots, `preview_eval`). You can also just open
  http://localhost:5174 in Chrome.
- **Headless/preview browsers report `document.hidden = true`**, which would pause any
  visibility-gated polling — `lib/useApi.ts` therefore always runs the *initial* fetch and
  only gates the recurring interval. Keep that invariant if you refactor the hook.

---

## 8. Version control state (important)

- The white-labeled OpenAlgo was published (public, AGPL) to
  **https://github.com/ameybrkr92/Algo-SaaS**. In `openalgo/`: git remote `origin` =
  that repo, `upstream` = `marketcalls/openalgo` (never push to upstream).
- **The cockpit/brain/Vite work is NOT committed anywhere yet** — `openalgo/cockpit/`,
  `openalgo/intelligence/`, and the whole `tradeyantra-cockpit/` app are local-only.
  Since the project pivoted to personal (and away from the public SaaS repo), consider a
  **fresh private repo** for the cockpit + brain before building further.

---

## 9. First message to paste into the new chat

> "Continue the TradeYantra project — read `C:\Users\ameyb\OneDrive\Desktop\Algo-trade\HANDOVER.md`
> for full context. It's a personal AI-first Indian-market trading cockpit (new Vite app at
> `tradeyantra-cockpit/`) on the OpenAlgo engine, with a 9-pillar reasoning brain at
> `openalgo/intelligence/`. All 4 brain phases + the app shell + live brain tabs are done.
> Next I want to [pick: wire live Zerodha data into the cockpit / port the trading module
> designs into React / give the copilot Claude's brain / set up a private git repo]."
