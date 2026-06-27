import { trading, type QuoteResult } from '../lib/api'
import { usePoll } from '../lib/useApi'
import { DataState } from '../components/DataState'
import { cls, inr, num, pct, price, signedInr } from '../lib/format'

// F&O / commodity exchanges — everything else counts as equity for the split.
const FO = new Set(['NFO', 'BFO', 'MCX', 'CDS', 'BCD', 'NCDEX'])

const PULSE = [
  { label: 'NIFTY 50', symbol: 'NIFTY', exchange: 'NSE_INDEX' },
  { label: 'BANK NIFTY', symbol: 'BANKNIFTY', exchange: 'NSE_INDEX' },
  { label: 'FIN NIFTY', symbol: 'FINNIFTY', exchange: 'NSE_INDEX' },
  { label: 'SENSEX', symbol: 'SENSEX', exchange: 'BSE_INDEX' },
  { label: 'INDIA VIX', symbol: 'INDIAVIX', exchange: 'NSE_INDEX' },
]
const WATCH = [
  { symbol: 'HDFCBANK', exchange: 'NSE' }, { symbol: 'ICICIBANK', exchange: 'NSE' },
  { symbol: 'SBIN', exchange: 'NSE' }, { symbol: 'TCS', exchange: 'NSE' },
  { symbol: 'RELIANCE', exchange: 'NSE' },
]

function quoteMap(results: QuoteResult[] | null) {
  const m = new Map<string, QuoteResult>()
  results?.forEach(r => m.set(`${r.exchange}:${r.symbol}`, r))
  return m
}
function dayChange(q?: { ltp: number; prev_close: number }) {
  if (!q || !q.prev_close) return NaN
  return ((q.ltp - q.prev_close) / q.prev_close) * 100
}
function greet() {
  const h = new Date().getHours()
  return h < 12 ? 'good morning' : h < 17 ? 'good afternoon' : 'good evening'
}

export function Cockpit() {
  const funds = usePoll(trading.funds, 5000)
  const pos = usePoll(trading.positions, 5000)
  const pulse = usePoll(() => trading.multiquotes(PULSE), 5000)
  const watch = usePoll(() => trading.multiquotes(WATCH), 6000)

  // Gate the page only when funds has never loaded — keep showing data through
  // transient refresh failures rather than blanking on a single hiccup.
  if (funds.error && !funds.data) {
    return <><div className="h">Cockpit</div><DataState error={funds.error} /></>
  }

  const f = funds.data
  const open = (pos.data ?? []).filter(p => p.quantity !== 0)
  const exposure = open.reduce((a, p) => a + Math.abs(p.quantity) * p.ltp, 0)
  const longExp = open.filter(p => p.quantity > 0).reduce((a, p) => a + p.quantity * p.ltp, 0)
  const eq = open.filter(p => !FO.has(p.exchange)).length
  const dayPnl = f ? num(f.m2mrealized) + num(f.m2munrealized) : NaN

  const tiles = [
    { lab: 'Available cash', val: f ? inr(f.availablecash) : '—', sub: f ? `collateral ${inr(f.collateral)}` : '', c: '' },
    { lab: 'Margin used', val: f ? inr(f.utiliseddebits) : '—', sub: 'utilised debits', c: '' },
    { lab: 'Day P&L', val: f ? signedInr(dayPnl) : '—', sub: f ? `realised ${signedInr(f.m2mrealized)}` : '', c: cls(dayPnl) },
    { lab: 'Net exposure', val: pos.data ? inr(exposure) : '—', sub: exposure ? `long ${Math.round(longExp / exposure * 100)}% · short ${Math.round((1 - longExp / exposure) * 100)}%` : 'flat', c: '' },
    { lab: 'Open positions', val: pos.data ? String(open.length) : '—', sub: `${eq} equity · ${open.length - eq} F&O`, c: '' },
  ]

  const pm = quoteMap(pulse.data)
  const wm = quoteMap(watch.data)

  return (
    <>
      <div className="h">Cockpit <small>· {greet()}, Amey — live from Zerodha</small></div>

      <div className="strip" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {tiles.map(t => (
          <div className="tile" key={t.lab}><div className="lab">{t.lab}</div>
            <div className={'val num ' + t.c}>{t.val}</div><div className={'sub ' + t.c}>{t.sub}</div></div>
        ))}
      </div>

      <div className="strip" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {PULSE.map(p => {
          const q = pm.get(`${p.exchange}:${p.symbol}`)?.data
          const c = dayChange(q)
          return (
            <div className="pcard" key={p.label}><div className="nm">{p.label}</div>
              <div className="pr num">{q ? price(q.ltp) : '—'}</div>
              <div className={'ch num ' + cls(c)}>{q ? pct(c) : '—'}</div></div>
          )
        })}
      </div>

      <div className="split">
        <div className="panel">
          <div className="ptitle">Open positions <span className="act"><span>{open.length} live</span></span></div>
          {pos.error && !pos.data ? (
            <div className="chainline" style={{ padding: 14 }}>{pos.error.kind === 'broker' ? pos.error.message : 'positions unavailable'}</div>
          ) : !pos.data ? (
            <div className="stub" style={{ padding: 24 }}>Loading positions…</div>
          ) : open.length === 0 ? (
            <div className="stub" style={{ padding: 24, color: 'var(--t3)' }}>No open positions</div>
          ) : (
            <table>
              <thead><tr><th>Instrument</th><th>Qty</th><th>Avg</th><th>LTP</th><th>P&amp;L</th><th>Chg%</th></tr></thead>
              <tbody>
                {open.map(p => {
                  const invested = num(p.average_price) * Math.abs(p.quantity)
                  const ret = invested ? (p.pnl / invested) * 100 : NaN
                  return (
                    <tr key={p.symbol + p.product}>
                      <td><span className="sym">{p.symbol}</span> <span className="tag">{p.product}</span><div className="meta">{p.exchange}</div></td>
                      <td className={'num ' + (p.quantity < 0 ? 's' : 'b')}>{p.quantity}</td>
                      <td className="num">{price(p.average_price)}</td>
                      <td className="num">{price(p.ltp)}</td>
                      <td className={'num ' + cls(p.pnl)}>{signedInr(p.pnl)}</td>
                      <td className={'num ' + cls(p.pnl)}>{pct(ret)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="ptitle">Watchlist</div>
          {WATCH.map(w => {
            const q = wm.get(`${w.exchange}:${w.symbol}`)?.data
            const c = dayChange(q)
            return (
              <div className="wlrow" key={w.symbol}><div><span className="sym">{w.symbol}</span><div className="meta">{w.exchange}</div></div>
                <div className="r"><div className="num">{q ? price(q.ltp) : '—'}</div><div className={'num ' + cls(c)} style={{ fontSize: 11 }}>{q ? pct(c) : '—'}</div></div></div>
            )
          })}
        </div>
      </div>

      <div className="meta">Live funds, positions &amp; quotes via OpenAlgo <code>/api/v1</code>, refreshing ~5s. Streaming WebSocket and the Markets / Options / Trade surfaces are the next step.</div>
    </>
  )
}
