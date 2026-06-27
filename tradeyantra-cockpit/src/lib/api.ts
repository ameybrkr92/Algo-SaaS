// Trading data → OpenAlgo engine (proxied /api); reasoning brain → intelligence API
// (proxied /reasoning, /memory, /hypothesis). Throws on failure so pages can show a
// graceful "service not running" state.

async function j<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.json() as Promise<T>
}

export interface ChainStep { node: string; name: string; sign: number; why: string; contribution: number }
export interface Row { id: string; name: string; impact: number; confidence: number; horizon_days: number; chain: ChainStep[] }
export interface Analysis {
  id: string; label: string; affected: number
  macro_transmission: Row[]; winners: Row[]; losers: Row[]; whats_next: Row[]
  assumptions: { src: string; dst: string; sign: number; strength: number; confidence: number; why: string }[]
  opportunities: { id: string; name: string; impact: number; coverage: number; tag: string }[]
  sector_impacts: { id: string; name: string; impact: number }[]
}

export const reasoning = {
  scenarios: () => j<{ id: string; label: string }[]>('/reasoning/scenarios'),
  propagate: (s: string) => j<Analysis>(`/reasoning/propagate?scenario=${s}`),
  graph: () => j<{ nodes: { id: string; name: string; type: string; coverage: number }[]; edges: { src: string; dst: string; sign: number; strength: number; confidence: number; lag: number; why: string }[] }>('/reasoning/graph'),
  calibration: () => j<any>('/memory/calibration'),
  hypothesis: (e: string) => j<any>(`/hypothesis?event=${e}`),
}

// ── OpenAlgo trading engine (/api/v1) ─────────────────────────────────────────
// Every /api/v1 call authenticates with the OpenAlgo API key. This is a personal
// cockpit, so we keep the key in localStorage — entered once on the Setup page,
// generated at http://127.0.0.1:5000/apikey — and inject it into each POST body.

const KEY_STORE = 'ty.apikey'
export const getApiKey = () => localStorage.getItem(KEY_STORE) || ''
export const setApiKey = (k: string) =>
  k.trim() ? localStorage.setItem(KEY_STORE, k.trim()) : localStorage.removeItem(KEY_STORE)
export const hasApiKey = () => !!getApiKey()

export type ApiErrorKind = 'no-key' | 'down' | 'bad-key' | 'broker'
export class ApiError extends Error {
  kind: ApiErrorKind
  constructor(kind: ApiErrorKind, message: string) {
    super(message)
    this.kind = kind
    this.name = 'ApiError'
  }
}

// POST to /api/v1/<path> with the API key injected; returns the parsed JSON after
// classifying failures into ApiError kinds the pages can render distinctly.
async function postJson<T = any>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const apikey = getApiKey()
  if (!apikey) throw new ApiError('no-key', 'No OpenAlgo API key set')
  let r: Response
  try {
    r = await fetch(`/api/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey, ...body }),
    })
  } catch {
    throw new ApiError('down', 'OpenAlgo engine unreachable')
  }
  let json: any = null
  try { json = await r.json() } catch { /* non-JSON body */ }
  // A non-JSON response means the engine/proxy failed (the API always returns JSON,
  // even for errors) — through the Vite dev proxy a down engine surfaces as a 5xx
  // HTML page, so treat "no JSON" as the engine being unreachable, not a broker error.
  if (!json) throw new ApiError('down', `OpenAlgo engine error (HTTP ${r.status})`)
  if (!r.ok || json.status === 'error') {
    const raw = json.message || json.error
    const msg = typeof raw === 'string' ? raw : raw ? JSON.stringify(raw) : `HTTP ${r.status}`
    const badKey = r.status === 403 || /invalid.*apikey/i.test(msg)
    throw new ApiError(badKey ? 'bad-key' : 'broker', msg)
  }
  return json as T
}

// Most endpoints wrap their payload in { status, data }.
const post = <T>(path: string, body?: Record<string, unknown>) =>
  postJson<{ data: T }>(path, body).then(j => j.data)

export interface Funds {
  availablecash: string; collateral: string
  m2munrealized: string; m2mrealized: string; utiliseddebits: string
}
export interface Position {
  symbol: string; exchange: string; product: string
  quantity: number; pnl: number; average_price: string; ltp: number
}
export interface Holding {
  symbol: string; exchange: string; quantity: number; product: string
  average_price: number; pnl: number; pnlpercent: number
}
export interface HoldingsStats {
  totalholdingvalue: number; totalinvvalue: number
  totalprofitandloss: number; totalpnlpercentage: number
}
export interface Quote {
  ask: number; bid: number; high: number; low: number
  ltp: number; open: number; prev_close: number; volume: number; oi: number
}
export interface SymRef { symbol: string; exchange: string }
export interface QuoteResult extends SymRef { data?: Quote; error?: string }

export const trading = {
  funds: () => post<Funds>('funds'),
  positions: () => post<Position[]>('positionbook'),
  holdings: () => post<{ holdings: Holding[]; statistics: HoldingsStats }>('holdings'),
  quote: (symbol: string, exchange: string) => post<Quote>('quotes', { symbol, exchange }),
  // multiquotes returns { status, results } — not the usual { data } envelope.
  multiquotes: (symbols: SymRef[]) =>
    postJson<{ results: QuoteResult[] }>('multiquotes', { symbols }).then(j => j.results),
}
