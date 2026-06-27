import { trading } from '../lib/api'
import { usePoll } from '../lib/useApi'
import { DataState, Loading } from '../components/DataState'
import { cls, inr, pct, price, signedInr } from '../lib/format'

export function Folio() {
  const { data, error } = usePoll(trading.holdings, 8000)

  if (error && !data) return <><div className="h">Portfolio</div><DataState error={error} /></>
  if (!data) return <><div className="h">Portfolio</div><Loading label="Loading holdings…" /></>

  const { holdings, statistics: s } = data
  const tiles = [
    { lab: 'Holdings value', val: inr(s.totalholdingvalue), c: '' },
    { lab: 'Invested', val: inr(s.totalinvvalue), c: '' },
    { lab: 'Total P&L', val: signedInr(s.totalprofitandloss), c: cls(s.totalprofitandloss) },
    { lab: 'Overall return', val: pct(s.totalpnlpercentage), c: cls(s.totalpnlpercentage) },
  ]

  return (
    <>
      <div className="h">Portfolio <small>· delivery holdings, live from Zerodha</small></div>

      <div className="strip" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {tiles.map(t => (
          <div className="tile" key={t.lab}><div className="lab">{t.lab}</div>
            <div className={'val num ' + t.c}>{t.val}</div></div>
        ))}
      </div>

      <div className="panel">
        <div className="ptitle">Holdings <span className="act">{holdings.length} instruments</span></div>
        {holdings.length === 0 ? (
          <div className="stub" style={{ padding: 24, color: 'var(--t3)' }}>No holdings</div>
        ) : (
          <table>
            <thead><tr><th>Instrument</th><th>Qty</th><th>Avg</th><th>Invested</th><th>P&amp;L</th><th>Return</th></tr></thead>
            <tbody>
              {holdings.map(h => (
                <tr key={h.symbol + h.exchange}>
                  <td><span className="sym">{h.symbol}</span> <span className="tag">{h.product}</span><div className="meta">{h.exchange}</div></td>
                  <td className="num">{h.quantity}</td>
                  <td className="num">{price(h.average_price)}</td>
                  <td className="num">{inr(h.average_price * h.quantity)}</td>
                  <td className={'num ' + cls(h.pnl)}>{signedInr(h.pnl)}</td>
                  <td className={'num ' + cls(h.pnlpercent)}>{pct(h.pnlpercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
