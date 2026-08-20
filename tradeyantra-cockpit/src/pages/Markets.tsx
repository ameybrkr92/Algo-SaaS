import { useEffect, useState } from 'react'
import { trading, type DepthLevel, type QuoteResult, type SymRef } from '../lib/api'
import { usePoll } from '../lib/useApi'
import { DataState } from '../components/DataState'
import { cls, count, num, pct, price } from '../lib/format'

const WATCH: SymRef[] = [
  { symbol: 'RELIANCE', exchange: 'NSE' }, { symbol: 'HDFCBANK', exchange: 'NSE' },
  { symbol: 'ICICIBANK', exchange: 'NSE' }, { symbol: 'INFY', exchange: 'NSE' },
  { symbol: 'TCS', exchange: 'NSE' }, { symbol: 'SBIN', exchange: 'NSE' },
  { symbol: 'TATAMOTORS', exchange: 'NSE' }, { symbol: 'AXISBANK', exchange: 'NSE' },
  { symbol: 'BHARTIARTL', exchange: 'NSE' }, { symbol: 'ITC', exchange: 'NSE' },
  { symbol: 'LT', exchange: 'NSE' }, { symbol: 'HINDUNILVR', exchange: 'NSE' },
]

const dayChange = (ltp?: number, pc?: number) => (ltp && pc ? ((ltp - pc) / pc) * 100 : NaN)

function DepthRow({ level, max, side }: { level: DepthLevel; max: number; side: 'bid' | 'ask' }) {
  const w = max > 0 ? (level.quantity / max) * 100 : 0
  const bar = side === 'bid' ? 'rgba(22,199,132,.14)' : 'rgba(234,57,67,.14)'
  const priceCell = <span className={'num ' + (side === 'bid' ? 'up' : 'down')} style={{ fontWeight: 500 }}>{level.price ? price(level.price) : '—'}</span>
  const qtyCell = <span className="num" style={{ color: 'var(--t2)' }}>{level.quantity ? count(level.quantity) : '—'}</span>
  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '5px 12px', fontSize: 12 }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, [side === 'bid' ? 'right' : 'left']: 0, width: w + '%', background: bar }} />
      <span style={{ position: 'relative', zIndex: 1 }}>{side === 'bid' ? qtyCell : priceCell}</span>
      <span style={{ position: 'relative', zIndex: 1 }}>{side === 'bid' ? priceCell : qtyCell}</span>
    </div>
  )
}

export function Markets() {
  const [sel, setSel] = useState<SymRef>(WATCH[0])
  const quotes = usePoll(() => trading.multiquotes(WATCH), 5000)
  const depth = usePoll(() => trading.depth(sel.symbol, sel.exchange), 4000)
  // usePoll's interval is keyed on a stable tick, so selecting a new symbol won't
  // refetch until the next interval — force an immediate book refresh on selection.
  useEffect(() => { depth.refresh() }, [sel.symbol, sel.exchange]) // eslint-disable-line react-hooks/exhaustive-deps

  if (quotes.error && !quotes.data) return <><div className="h">Markets</div><DataState error={quotes.error} /></>

  const qmap = new Map<string, QuoteResult>()
  quotes.data?.forEach(r => qmap.set(`${r.exchange}:${r.symbol}`, r))

  // Movers from the watchlist quotes
  const withChg = (quotes.data ?? [])
    .map(r => ({ ...r, chg: dayChange(r.data?.ltp, r.data?.prev_close) }))
    .filter(r => isFinite(r.chg))
    .sort((a, b) => b.chg - a.chg)
  const gainers = withChg.slice(0, 3)
  const losers = withChg.slice(-3).reverse()

  const d = depth.data
  const maxQty = d ? Math.max(...d.bids.map(b => b.quantity), ...d.asks.map(a => a.quantity), 1) : 1
  const selChg = d ? dayChange(d.ltp, d.prev_close) : NaN
  const spread = d && d.asks[0]?.price && d.bids[0]?.price ? d.asks[0].price - d.bids[0].price : NaN
  const buyPct = d && d.totalbuyqty + d.totalsellqty > 0 ? (d.totalbuyqty / (d.totalbuyqty + d.totalsellqty)) * 100 : 50

  const summary = d ? [
    ['LTP', price(d.ltp), cls(selChg)],
    ['Change', pct(selChg), cls(selChg)],
    ['Open', price(d.open), ''],
    ['High', price(d.high), ''],
    ['Low', price(d.low), ''],
    ['Prev close', price(d.prev_close), ''],
    ['Volume', count(d.volume), ''],
    ['Spread', isFinite(spread) ? price(spread) : '—', ''],
  ] : []

  return (
    <>
      <div className="h">Markets <small>· watchlist, L2 depth &amp; movers — live from Zerodha</small></div>

      <div className="split">
        {/* Watchlist (selectable) */}
        <div className="panel">
          <div className="ptitle">Watchlist <span className="act">{WATCH.length} symbols · click to inspect</span></div>
          <table>
            <thead><tr><th>Symbol</th><th>LTP</th><th>Chg%</th></tr></thead>
            <tbody>
              {WATCH.map(w => {
                const q = qmap.get(`${w.exchange}:${w.symbol}`)?.data
                const c = dayChange(q?.ltp, q?.prev_close)
                const on = w.symbol === sel.symbol && w.exchange === sel.exchange
                return (
                  <tr key={w.symbol} onClick={() => setSel(w)} style={{ cursor: 'pointer', background: on ? 'var(--bg-elev)' : undefined }}>
                    <td><span className="sym">{w.symbol}</span> {on && <span className="tag" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>book</span>}<div className="meta">{w.exchange}</div></td>
                    <td className="num">{q ? price(q.ltp) : '—'}</td>
                    <td className={'num ' + cls(c)}>{q ? pct(c) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Order book for the selected symbol */}
        <div className="panel">
          <div className="ptitle">Order book · {sel.symbol} <span className="act">L2 · top 5</span></div>
          {depth.error && !depth.data ? (
            <div className="chainline" style={{ padding: 14 }}>{depth.error.kind === 'broker' ? depth.error.message : 'depth unavailable'}</div>
          ) : !d ? (
            <div className="stub" style={{ padding: 24 }}>Loading book…</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', fontSize: 10, letterSpacing: '.04em', color: 'var(--t3)', textTransform: 'uppercase' }}><span>Qty</span><span>Bid</span></div>
                  {d.bids.map((b, i) => <DepthRow key={i} level={b} max={maxQty} side="bid" />)}
                </div>
                <div style={{ borderLeft: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', fontSize: 10, letterSpacing: '.04em', color: 'var(--t3)', textTransform: 'uppercase' }}><span>Ask</span><span>Qty</span></div>
                  {d.asks.map((a, i) => <DepthRow key={i} level={a} max={maxQty} side="ask" />)}
                </div>
              </div>
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t2)', marginBottom: 5 }}>
                  <span>Total buy <b className="num up">{count(d.totalbuyqty)}</b></span>
                  <span>Total sell <b className="num down">{count(d.totalsellqty)}</b></span>
                </div>
                <div style={{ display: 'flex', height: 7, borderRadius: 5, overflow: 'hidden', background: 'var(--down)' }}>
                  <div style={{ width: buyPct + '%', background: 'var(--up)' }} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quote summary for the selected symbol */}
      {d && (
        <div className="strip" style={{ gridTemplateColumns: 'repeat(8,1fr)' }}>
          {summary.map(([lab, val, c]) => (
            <div className="tile" key={lab}><div className="lab">{lab}</div>
              <div className={'val num ' + c} style={{ fontSize: 16 }}>{val}</div></div>
          ))}
        </div>
      )}

      {/* Movers */}
      <div className="grid2">
        <div className="panel"><div className="ptitle">Top gainers</div>
          {gainers.length ? gainers.map(g => (
            <div className="wlrow" key={g.symbol} onClick={() => setSel({ symbol: g.symbol, exchange: g.exchange })} style={{ cursor: 'pointer' }}>
              <div><span className="sym">{g.symbol}</span><div className="meta">{g.exchange}</div></div>
              <div className="r"><div className="num">{price(g.data!.ltp)}</div><div className="num up" style={{ fontSize: 11 }}>{pct(g.chg)}</div></div>
            </div>
          )) : <div className="stub" style={{ padding: 20, color: 'var(--t3)' }}>—</div>}
        </div>
        <div className="panel"><div className="ptitle">Top losers</div>
          {losers.length ? losers.map(l => (
            <div className="wlrow" key={l.symbol} onClick={() => setSel({ symbol: l.symbol, exchange: l.exchange })} style={{ cursor: 'pointer' }}>
              <div><span className="sym">{l.symbol}</span><div className="meta">{l.exchange}</div></div>
              <div className="r"><div className="num">{price(l.data!.ltp)}</div><div className={'num ' + cls(l.chg)} style={{ fontSize: 11 }}>{pct(l.chg)}</div></div>
            </div>
          )) : <div className="stub" style={{ padding: 20, color: 'var(--t3)' }}>—</div>}
        </div>
      </div>

      <div className="meta">Watchlist &amp; movers via <code>/api/v1/multiquotes</code>; order book via <code>/api/v1/depth</code> (top-5, ~4s). Click any symbol to load its book.</div>
    </>
  )
}
