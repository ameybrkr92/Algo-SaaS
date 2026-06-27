# TradeYantra Cockpit — Design System

A personal, AI-first trading terminal built on the OpenAlgo engine
(`/api/v1` REST + WebSocket ticks + SocketIO events). Dark, dense, fast,
keyboard-driven, with an always-present AI copilot. This is the foundation for
the high-fidelity React rebuild.

---

## 1. Design principles

1. **Information density, not clutter** — a trader's screen should answer "what's
   happening and what should I do" in one glance. Tight rows, tabular numerals,
   no decorative chrome.
2. **AI is a surface, not a sidebar afterthought** — the copilot is co-equal with
   the data: a command bar (Cmd-K) everywhere + a persistent insight rail.
3. **Color means money** — green/red are reserved strictly for P&L and price
   direction. Everything else is neutral so the eye finds money fast.
4. **Keyboard-first** — every primary action has a shortcut. Mouse is optional.
5. **Safe by default** — sandbox toggle is always visible; live orders always
   confirm; risk limits are enforced by the UI, not just hoped for.

## 2. Design tokens

### Color — dark base (default theme)
| Token | Hex | Use |
| --- | --- | --- |
| `--bg-app` | `#0B0E14` | App background (near-black navy) |
| `--bg-panel` | `#11151E` | Panels, cards |
| `--bg-elevated` | `#161B26` | Raised (menus, hover rows, tiles) |
| `--bg-inset` | `#0E121A` | Table headers, wells |
| `--border` | `#1E2530` | Default 1px hairline |
| `--border-strong` | `#2A3340` | Hover / emphasis |
| `--text-1` | `#E6E9EF` | Primary text + numbers |
| `--text-2` | `#9AA4B2` | Labels, secondary |
| `--text-3` | `#5B6472` | Hints, disabled, axis |

### Color — semantic (the only colors that carry meaning)
| Token | Hex | Meaning |
| --- | --- | --- |
| `--up` | `#16C784` | Profit, price up, buy-side |
| `--down` | `#EA3943` | Loss, price down, sell-side |
| `--accent` | `#3B82F6` | Brand, primary actions, focus |
| `--accent-2` | `#1D4ED8` | Accent pressed |
| `--warn` | `#F0A020` | Risk warnings, pending |
| `--info` | `#7C5CFF` | AI / copilot accent (distinct from brand) |
| Fills | `…/12%` alpha | Use the same hue at 10–14% alpha for backgrounds (e.g. up-pill = `#16C784` @ 12%). |

> A light "day" theme mirrors these (white `--bg-app`, blue primary) — same token
> names, swapped values — so the app ships both. Dark is default.

### Typography
- **Sans:** `Inter, "Segoe UI", system-ui, sans-serif` — UI, labels, prose.
- **Mono / numerals:** `"JetBrains Mono", "Roboto Mono", ui-monospace` with
  `font-variant-numeric: tabular-nums` — **every price, qty, P&L, %**. Tabular
  numerals stop columns from jittering as values tick.
- **Scale:** 11 (micro/labels) · 12 (table) · 13 (body) · 15 (section) ·
  18 (panel title) · 24 (hero metric) · 30 (account headline). Weights: 400, 500,
  600 only. Never bold a whole price row — weight the value, not the label.

### Spacing & density
- 4px base. Steps: 4 · 8 · 12 · 16 · 24 · 32.
- **Row height:** 28px (compact tables) / 32px (comfortable) — user-toggleable
  "density" setting. Cards pad 12–16px. Gutters 12px.

### Radius / elevation / motion
- Radius: 6px (controls) · 10px (cards) · 14px (modals). Pills: 999px.
- Elevation by background step + 1px border (no heavy shadows; a trading UI is flat).
  One soft shadow only on overlays/menus.
- Motion: 120ms ease for hovers, 180ms for panels. Number changes flash a 200ms
  green/red tint then decay — never animate layout.

## 3. Component inventory

| Component | Purpose | Key states |
| --- | --- | --- |
| `StatTile` | Account/metric number (balance, day P&L) | up/down/neutral, loading |
| `LivePrice` | A ticking price/%/value | up-tick flash, down-tick flash, stale |
| `DataTable` | Positions, orders, holdings, trades | sortable, row-hover, selected, empty, virtualized |
| `WatchlistRow` | Symbol + LTP + chg + spark + quick-trade | hover reveals buy/sell, alerted |
| `OptionChainGrid` | CE/PE ladder around spot | ATM highlight, ITM tint, selected strike, OI heat |
| `OrderTicket` | Place/modify order | market/limit/SL, buy/sell, sandbox vs live, margin preview, confirm |
| `CopilotPanel` | AI chat + proactive insights | thinking, streaming, action-card (proposes order), needs-approval |
| `CommandBar` | Cmd-K natural-language + nav | empty, results, NL-action preview |
| `NavRail` | Module switcher (icon rail) | active, hover, badge (alerts) |
| `Sparkline` | Inline trend | up/down colored |
| `Badge / Pill` | Status (Live, Sandbox, NSE open, PnL) | semantic variants |
| `RiskMeter` | Margin %, exposure, daily-loss vs limit | ok/warn/breached |
| `Toast` | Order ack, alerts | success/error/info, auto-dismiss |

### Spotlight specs

**StatTile** — `--bg-elevated`, 12px label (`--text-2`), 24px tabular value
(`--text-1`); P&L value colored `--up`/`--down`; optional delta pill + sparkline.

**OrderTicket** — segmented Buy(`--up`)/Sell(`--down`); product (MIS/CNC/NRML),
type (MKT/LMT/SL/SL-M); live margin-required + impact preview; a persistent
"Sandbox" switch; live orders require a second confirm press. Maps 1:1 to
`/api/v1/placeorder`.

**CopilotPanel** — three message kinds: (1) prose answer, (2) **insight card**
(proactive nudge with a one-tap action), (3) **action card** — a proposed order
the AI prepares; in advisory mode it's "Review", in co-pilot mode it routes to the
engine's Action Center for approval. Accent `--info` so AI output is visually
distinct from market data.

## 4. Layout patterns

- **App shell:** fixed 64px `NavRail` (left) + 52px `TopBar` + fluid content +
  optional 360px `CopilotPanel` (right, collapsible). Content max-width none —
  fill the screen.
- **Cockpit grid:** account `StatTile` strip → market-pulse strip → a 2/3 main
  (positions + chart) / 1/3 (watchlist) split, with the copilot rail on the right.
- **Workspace tabs:** the 11 modules are the NavRail; within a module, secondary
  tabs (e.g. Options → Chain / Builder / OI / Greeks).
- **Command bar (Cmd-K):** opens anywhere; routes ("go to options"), queries
  ("show my banking exposure"), or actions ("buy 50 NIFTY 24000 CE limit 120").

## 5. Module map (the tabs) — and what each does

| # | Module | What it does | Engine surface |
| --- | --- | --- | --- |
| 1 | **Cockpit** | Account + positions + market pulse + AI insights at a glance | funds, positionbook, quotes, WS |
| 2 | **Markets** | Watchlists, depth (L2), indices, heatmaps, movers, OI buildup, FII/DII | quotes, depth, WS |
| 3 | **Charts** | Multi-TF charts + indicators + AI-drawn levels/patterns | history, WS |
| 4 | **Options** | Chain · strategy builder (payoff+Greeks) · IV · max pain · GEX · OI | optionchain, Greeks |
| 5 | **Trade** | Order ticket, basket, GTT, order/trade book, modify/cancel | placeorder, orderbook, tradebook |
| 6 | **Portfolio** | Positions, holdings, P&L, exposure & aggregate Greeks, what-if | holdings, positionbook |
| 7 | **Strategies** | Python host + Flow no-code + webhooks + live monitor | python, flow, strategy |
| 8 | **Research** | Backtests (with costs), scanners, idea generation | history, analyzer |
| 9 | **Risk** | Limits, margin, exposure caps, daily-loss kill-switch, square-off | funds, sandbox, action-center |
| 10 | **Journal** | Auto trade journal + performance analytics + AI review + reports | tradebook, logs |
| 11 | **Alerts** | Price/OI/news/AI signals → Telegram | alerts, telegram |

## 6. The AI copilot — capability model

Cross-cutting "superpowers", each grounded in the engine via tool-use (MCP-style):
- **Command** — natural language → engine action (place/modify orders, switch views).
- **Watch** — proactive monitoring: risk breaches, support/resistance breaks,
  position management nudges, unusual OI.
- **Pre-trade** — position sizing, margin/risk check, and a "why" before every order.
- **Strategist** — view → optimal options structure (with payoff + cost + Greeks).
- **Co-author** — write / debug Python & Flow strategies.
- **Scanner** — screen the market, generate + backtest ideas.
- **Reviewer** — post-trade journaling + behavioral feedback ("you cut winners early").
- **Portfolio doctor** — exposure, concentration, hedge suggestions.
- Always **explainable** and **guardrailed**.

### Autonomy tiers (how much the AI may decide)
| Tier | AI does | You do | Safety |
| --- | --- | --- | --- |
| **L1 Advisory** (default) | Suggests, analyzes, drafts orders | Place every order | Nothing executes without you |
| **L2 Co-pilot** | Prepares orders/baskets | Approve in Action Center | Engine's semi-auto approval gate |
| **L3 Bounded-auto** | Executes within a strict envelope | Set the envelope + watch | Capital cap, max daily loss, instrument whitelist, time window, sandbox-validated, full audit log, one-tap kill-switch |

Never an open-ended mandate. A kill-switch and daily-loss auto-square-off are
always armed. (And note SEBI/regulatory limits on automated execution.)
