import { useState } from 'react'
import { trading } from '../lib/api'
import { usePoll } from '../lib/useApi'
import { DataState } from '../components/DataState'
import { cls, inr, num, pctAbs, signedInr } from '../lib/format'

const FO = new Set(['NFO', 'BFO', 'MCX', 'CDS', 'BCD', 'NCDEX'])
const LIMIT_KEY = 'ty.risk.dailyLossLimit'
const getLimit = () => Number(localStorage.getItem(LIMIT_KEY)) || 10000

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 8, borderRadius: 6, background: 'var(--bg-inset)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: Math.min(Math.max(value, 0), 100) + '%', background: color, borderRadius: 6, transition: 'width .3s' }} />
    </div>
  )
}

// Risk is computed entirely from funds + positions (no extra endpoints). It's
// read-only analytics + a locally-configured daily-loss limit; an actual
// auto-square-off kill-switch is a write action and lives with the Trade pass.
export function Risk() {
  const funds = usePoll(trading.funds, 6000)
  const pos = usePoll(trading.positions, 6000)
  const [limit, setLimit] = useState(getLimit())

  function onLimit(v: string) {
    const n = Math.max(0, Math.round(Number(v) || 0))
    setLimit(n)
    localStorage.setItem(LIMIT_KEY, String(n))
  }

  if (funds.error && !funds.data) return <><div className="h">Risk</div><DataState error={funds.error} /></>

  const f = funds.data
  const open = (pos.data ?? []).filter(p => p.quantity !== 0)
  const avail = f ? num(f.availablecash) : NaN
  const used = f ? num(f.utiliseddebits) : NaN
  const total = avail + used
  const marginUtil = total > 0 ? (used / total) * 100 : NaN

  const exps = open.map(p => ({ p, exp: Math.abs(p.quantity) * p.ltp }))
  const gross = exps.reduce((a, x) => a + x.exp, 0)
  const longExp = exps.filter(x => x.p.quantity > 0).reduce((a, x) => a + x.exp, 0)
  const shortExp = gross - longExp
  const net = longExp - shortExp
  const top = exps.length ? Math.max(...exps.map(x => x.exp)) : 0
  const concentration = gross > 0 ? (top / gross) * 100 : 0
  const dayPnl = f ? num(f.m2mrealized) + num(f.m2munrealized) : NaN

  const breached = isFinite(dayPnl) && dayPnl <= -limit
  const warning = isFinite(dayPnl) && !breached && dayPnl <= -0.7 * limit
  const status = breached ? { t: 'BREACHED', c: 'var(--down)' }
    : warning ? { t: 'WARNING', c: 'var(--warn)' }
    : { t: 'WITHIN LIMIT', c: 'var(--up)' }
  const headroom = limit + Math.min(dayPnl, 0) // remaining loss capacity before breach

  const level = (v: number, warn: number, bad: number) => v >= bad ? 'var(--down)' : v >= warn ? 'var(--warn)' : 'var(--up)'

  const tiles = [
    { lab: 'Margin utilisation', val: f ? pctAbs(marginUtil) : '—', color: isFinite(marginUtil) ? level(marginUtil, 60, 85) : 'var(--t1)' },
    { lab: 'Gross exposure', val: pos.data ? inr(gross) : '—', color: 'var(--t1)' },
    { lab: 'Net exposure', val: pos.data ? signedInr(net) : '—', color: net > 0 ? 'var(--up)' : net < 0 ? 'var(--down)' : 'var(--t1)' },
    { lab: 'Top concentration', val: pos.data ? pctAbs(concentration) : '—', color: pos.data ? level(concentration, 40, 60) : 'var(--t1)' },
    { lab: 'Day P&L', val: f ? signedInr(dayPnl) : '—', color: isFinite(dayPnl) ? (dayPnl > 0 ? 'var(--up)' : dayPnl < 0 ? 'var(--down)' : 'var(--t1)') : 'var(--t1)' },
  ]

  return (
    <>
      <div className="h">Risk <small>· limits, margin &amp; exposure — live from Zerodha</small></div>

      <div className="strip" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {tiles.map(t => (
          <div className="tile" key={t.lab}><div className="lab">{t.lab}</div>
            <div className="val num" style={{ color: t.color }}>{t.val}</div></div>
        ))}
      </div>

      <div className="split">
        <div className="panel">
          <div className="ptitle">Margin <span className="act">used vs available</span></div>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Bar value={isFinite(marginUtil) ? marginUtil : 0} color={isFinite(marginUtil) ? level(marginUtil, 60, 85) : 'var(--t3)'} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--t2)' }}>
              <span>Used <b className="num" style={{ color: 'var(--t1)' }}>{f ? inr(used) : '—'}</b></span>
              <span>Available <b className="num" style={{ color: 'var(--t1)' }}>{f ? inr(avail) : '—'}</b></span>
              <span>Total <b className="num" style={{ color: 'var(--t1)' }}>{f ? inr(total) : '—'}</b></span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="ptitle">Daily-loss kill-switch</div>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', padding: '4px 10px', borderRadius: 6, color: status.c, border: '1px solid ' + status.c }}>{f ? status.t : '—'}</span>
              <span style={{ fontSize: 12, color: 'var(--t2)' }}>{f && dayPnl < 0 ? <>headroom <b className="num" style={{ color: 'var(--t1)' }}>{inr(Math.max(headroom, 0))}</b></> : 'no loss today'}</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--t2)' }}>
              Max daily loss ₹
              <input
                type="number" min={0} value={limit} onChange={e => onLimit(e.target.value)}
                style={{ width: 120, background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 9px', color: 'var(--t1)', font: 'inherit', fontFamily: 'var(--mono)', fontSize: 12.5, outline: 'none' }}
              />
            </label>
            <div className="meta">Read-only alert — auto square-off is a write action, deferred to the Trade pass.</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="ptitle">Exposure by position <span className="act">{open.length} open · long {gross > 0 ? Math.round(longExp / gross * 100) : 0}% / short {gross > 0 ? Math.round(shortExp / gross * 100) : 0}%</span></div>
        {pos.error && !pos.data ? (
          <div className="chainline" style={{ padding: 14 }}>{pos.error.kind === 'broker' ? pos.error.message : 'positions unavailable'}</div>
        ) : !pos.data ? (
          <div className="stub" style={{ padding: 24 }}>Loading positions…</div>
        ) : open.length === 0 ? (
          <div className="stub" style={{ padding: 24, color: 'var(--t3)' }}>Flat — no exposure</div>
        ) : (
          <table>
            <thead><tr><th>Instrument</th><th>Side</th><th>Exposure</th><th>% of gross</th><th>P&amp;L</th></tr></thead>
            <tbody>
              {exps.sort((a, b) => b.exp - a.exp).map(({ p, exp }) => (
                <tr key={p.symbol + p.product}>
                  <td><span className="sym">{p.symbol}</span> <span className="tag">{FO.has(p.exchange) ? 'F&O' : 'EQ'}</span><div className="meta">{p.exchange}</div></td>
                  <td className={'num ' + (p.quantity < 0 ? 's' : 'b')}>{p.quantity < 0 ? 'SHORT' : 'LONG'}</td>
                  <td className="num">{inr(exp)}</td>
                  <td className="num">{pctAbs(gross > 0 ? exp / gross * 100 : 0)}</td>
                  <td className={'num ' + cls(p.pnl)}>{signedInr(p.pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
