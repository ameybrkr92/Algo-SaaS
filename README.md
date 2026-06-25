# TradeYantra — Algorithmic Trading Platform for Indian Markets

> **Precision algo trading for Indian markets.** Design, backtest, and execute
> strategies across **30+ Indian brokers** through one unified API.

> ℹ️ **Built on [OpenAlgo](https://github.com/marketcalls/openalgo).** TradeYantra is a
> branded distribution of the open-source OpenAlgo platform, licensed under the
> **GNU AGPL-3.0**. See [License](#license) for what that means for you.

---

## What is TradeYantra?

TradeYantra is a self-hosted **trading platform** — not just a broker bridge. Built on
Python (Flask) + React 19, it gives traders a full-stack environment to **design, host,
and execute strategies** across 30+ Indian brokers through a single unified API. Whether
you write Python, prefer drag-and-drop, or trade options exclusively, TradeYantra gives
you a first-class workflow without tying you to any single broker or vendor.

It is **four products in one self-hosted instance** — sharing one broker session, one
WebSocket feed, and one database — covering the journey from idea → backtest → live trade.

## Four Ways to Trade

| Surface | Route | Who it's for |
| --- | --- | --- |
| **Unified Broker API** | `/api/v1/` | External platforms — TradingView, Amibroker, ChartInk, Excel, Google Sheets, Python, Java, Go, .NET, Node.js, MetaTrader, N8N. One API, 30+ brokers. |
| **Python Strategy Host** | `/python` | Traders who code — paste any Python script into the in-browser editor, schedule it on IST start/stop times, run multiple strategies in parallel with process isolation, watch real-time logs. |
| **Flow — No-Code Builder** | `/flow` | Traders who don't code — drag-and-drop nodes for market data, indicators, conditions, order execution, and notifications. Webhook triggers built in. |
| **Options Trading Suite** | `/tools` | Options traders — twelve analytical tools: Strategy Builder with payoff diagrams & live Greeks, Option Chain, IV Smile, Max Pain, Vol Surface, GEX, OI Tracker, Straddle Chart, and more. |

Every surface runs on the same **Sandbox engine** (₹1 Crore sandbox capital,
exchange-aligned auto square-off) so you can paper-trade any flow before going live.
Real-time dashboards, PnL tracker, latency monitor, Telegram alerts, and an AI / MCP
server work uniformly across all four.

## Supported Brokers (30+)

<details>
<summary>View All Supported Brokers</summary>

- 5paisa (Standard + XTS)
- AliceBlue
- AngelOne
- Arrow
- Compositedge
- Definedge
- Delta Exchange
- Dhan (Live + Sandbox)
- Firstock
- Flattrade
- Fyers
- Groww
- IBulls
- IIFL
- Iiflcapital
- Indmoney
- JainamXTS
- Kotak Neo
- Motilal Oswal
- Mstock
- Nubra
- Paytm Money
- Pocketful
- RMoney
- Samco
- Shoonya (Finvasia)
- Tradejini
- TradeSmart
- Upstox
- Wisdom Capital
- Zebu
- Zerodha

</details>

All brokers share a unified API interface, so you can switch brokers without changing your code.

## Core Features

- **Unified REST API** (`/api/v1/`) — place/modify/cancel orders, positions, holdings,
  quotes, historical data, and funds across every broker with one schema. Auto-generated
  Swagger docs at `/api/docs`.
- **Real-time WebSocket streaming** — a unified feed (port 8765) normalizes ticks from
  every broker, fanned out over an internal ZeroMQ bus.
- **Flow visual strategy builder** (`/flow`) — node-based, no-code strategies with
  JSON import/export and webhook triggers.
- **Options & strategy analytics** (`/tools`) — payoff diagrams, live Greeks, IV smile,
  max pain, vol surface, GEX, OI tracking, straddle charts.
- **API Analyzer / Sandbox** — validate requests and paper-trade with ₹1 Cr sandbox
  capital, realistic margins, and exchange-timed square-off, fully isolated from live.
- **Python Strategy Host** (`/python`) — run scheduled, process-isolated strategies with
  live logs, all in the browser.
- **AI-powered trading (MCP server)** — connect Claude, Cursor, Windsurf, or ChatGPT to
  place orders and pull data by chatting.
- **Telegram bot** — alerts, order notifications, and chart snapshots.
- **Enterprise-grade security** — Argon2 password hashing, encrypted-at-rest broker
  tokens, optional TOTP 2FA, CSRF protection, rate limiting, and IP banning.

## Technology Stack

- **Backend:** Python 3.11–3.14, Flask, Flask-SocketIO, SQLAlchemy, APScheduler, ZeroMQ, httpx
- **Frontend:** React 19, TypeScript, Vite, shadcn/ui, Tailwind CSS, TanStack Query
- **Databases:** SQLite (default; PostgreSQL supported), DuckDB for historical data
- **Realtime:** WebSocket proxy + ZeroMQ message bus

## Installation

### Minimum Requirements
- **RAM:** 2GB (or 0.5GB + 2GB swap) · **Disk:** 1GB · **CPU:** 1 vCPU
- **Python:** 3.11, 3.12, 3.13, or 3.14
- **Node.js:** 20.20+, 22.22+, or 24.13+ (only for frontend development)

### Quick Start (uv)

TradeYantra uses the modern `uv` package manager for fast, reliable installs.

```bash
# From the project root
pip install uv                 # install the uv package manager

cp .sample.env .env            # secrets auto-generate on first run
# Set REDIRECT_URL to your broker, e.g. http://127.0.0.1:5000/zerodha/callback

uv run app.py                  # uv handles the venv + dependencies
```

The app will be available at `http://127.0.0.1:5000`. On first launch you'll create an
admin account, then connect your broker.

> The pre-built React UI ships in `frontend/dist/`, so you only need Node.js if you're
> editing the frontend. After editing React code: `cd frontend && npm install && npm run build`.
> To regenerate the brand icon set after changing the logo: `node frontend/scripts/gen-icons.mjs`.

## Documentation & API Reference

TradeYantra runs the OpenAlgo engine, so the OpenAlgo technical references apply directly:

- **API reference:** [docs.openalgo.in/api-documentation/v1](https://docs.openalgo.in/api-documentation/v1)
- **Symbol format:** [docs.openalgo.in/symbol-format](https://docs.openalgo.in/symbol-format)
- **Installation & deployment:** [docs.openalgo.in/installation-guidelines/getting-started](https://docs.openalgo.in/installation-guidelines/getting-started)

## License

TradeYantra is built on **OpenAlgo** and is released under the **GNU AGPL-3.0** license.
See [LICENSE](License.md) for the full text.

**What AGPL-3.0 means for you:**

- ✅ You may use, modify, and self-host TradeYantra freely, for personal or commercial trading.
- ⚠️ If you run a **modified** version as a **network service** for other users, you must make
  your corresponding source code available to those users.
- 📌 The **"Built on OpenAlgo"** attribution in the app footer and this README is part of
  honoring that license — please keep it.

> **Regulatory note (India):** Offering algo execution to *other* traders is subject to
> SEBI regulation — including broker empanelment of algo providers and per-user
> static-IP whitelisting. Review the requirements before operating a multi-user service.

## Credits & Acknowledgments

TradeYantra stands on the shoulders of the **[OpenAlgo](https://github.com/marketcalls/openalgo)**
project and the wider open-source ecosystem — Flask, React, SQLAlchemy, Vite, shadcn/ui,
Tailwind CSS, TanStack Query, ZeroMQ, DuckDB, and many more. Thank you to all maintainers.
