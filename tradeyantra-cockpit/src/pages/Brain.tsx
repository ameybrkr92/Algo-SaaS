import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { reasoning, type Analysis, type Row } from '../lib/api'

function ApiDown() {
  return (
    <div className="panel"><div className="stub"><Icon name="alert" size={30} />
      Reasoning API not running
      <span style={{ fontSize: 12, color: 'var(--t3)' }}>start it: <code>uv run python intelligence/service.py</code></span>
    </div></div>
  )
}
const Loading = () => <div className="panel"><div className="stub">Reasoning…</div></div>

function chain(c: Row['chain']) {
  return c.map((s, i) => (i === 0 ? s.name : <span key={i}> <b>→</b> {s.name}</span>))
}
function ImpactRow({ r, max }: { r: Row; max: number }) {
  const pos = r.impact > 0, w = Math.min((Math.abs(r.impact) / max) * 50, 50)
  return (
    <div>
      <div className="irow">
        <span className="nm">{r.name}</span>
        <div className="ibar"><div className="mid" /><div className={'f ' + (pos ? 'pos' : 'neg')} style={{ width: w + '%' }} /></div>
        <span className={'ival ' + (pos ? 'up' : 'down')}>{pos ? '+' : ''}{r.impact.toFixed(2)}</span>
        <span className="icv">{Math.round(r.confidence * 100)}%</span>
      </div>
      <div className="chainline">{chain(r.chain)} <b>· ~{r.horizon_days}d</b></div>
    </div>
  )
}

const EVENTS = ['crude', 'repo', 'inr', 'ev_push', 'infra_boom', 'defence_push']

export function Reason() {
  const [ev, setEv] = useState('crude')
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [d, setD] = useState<Analysis | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { reasoning.scenarios().then(s => setLabels(Object.fromEntries(s.map(x => [x.id, x.label])))).catch(() => {}) }, [])
  useEffect(() => { setD(null); setErr(false); reasoning.propagate(ev).then(setD).catch(() => setErr(true)) }, [ev])
  if (err) return <><div className="h">Reasoning engine</div><ApiDown /></>
  const max = d ? Math.max(...[...d.winners, ...d.losers].map(x => Math.abs(x.impact)), 0.1) : 1
  return (
    <>
      <div className="h">Reasoning engine <small>· an event ripples through the causal graph</small></div>
      <div className="panel"><div className="ptitle">Inject an event</div>
        <div className="evbtns">{EVENTS.map(e => <button key={e} className={'evbtn' + (e === ev ? ' on' : '')} onClick={() => setEv(e)}>{labels[e] || e}</button>)}</div>
      </div>
      {!d ? <Loading /> : <>
        <div className="panel"><div className="ptitle">What the engine concludes <span className="act">{d.affected} entities traced</span></div>
          <div className="qa">
            <span className="q">What happened</span><span>{d.label}.</span>
            <span className="q">Why it matters</span><span>{d.macro_transmission.map(m => `${m.name} ${m.impact > 0 ? '+' : ''}${m.impact.toFixed(2)}`).join(' · ') || 'demand flows through the supply chain'}.</span>
            <span className="q">Key assumption</span><span>{d.assumptions[0] && `${d.assumptions[0].src} → ${d.assumptions[0].dst} (strength ${Math.round(d.assumptions[0].strength * 100)}%, confidence ${Math.round(d.assumptions[0].confidence * 100)}%)`}.</span>
            <span className="q">Market is missing</span><span>{d.opportunities[0] && `${d.opportunities[0].name} — impact ${d.opportunities[0].impact > 0 ? '+' : ''}${d.opportunities[0].impact.toFixed(2)} at ${Math.round(d.opportunities[0].coverage * 100)}% coverage`}.</span>
          </div>
        </div>
        <div className="split">
          <div className="panel"><div className="ptitle">Who benefits <span className="act">{d.winners.length}</span></div>{d.winners.slice(0, 7).map(r => <ImpactRow key={r.id} r={r} max={max} />)}</div>
          <div className="panel"><div className="ptitle">Who gets hurt <span className="act">{d.losers.length}</span></div>{d.losers.length ? d.losers.slice(0, 6).map(r => <ImpactRow key={r.id} r={r} max={max} />) : <div className="chainline" style={{ padding: 14 }}>none in this slice — a broad tailwind</div>}</div>
        </div>
        <div className="grid2">
          <div className="panel"><div className="ptitle">System-wide · sector impacts</div>{d.sector_impacts.slice(0, 7).map(s => <div className="star" key={s.id}><span className="sym">{s.name}</span><span className={'num ' + (s.impact > 0 ? 'up' : 'down')} style={{ marginLeft: 'auto' }}>{s.impact > 0 ? '+' : ''}{s.impact.toFixed(2)}</span></div>)}</div>
          <div className="panel"><div className="ptitle">Opportunities · market is missing</div>{d.opportunities.slice(0, 5).map(o => <div className="star" key={o.id}><Icon name="layers" size={15} /><span className="sym">{o.name}</span><span className={'num ' + (o.impact > 0 ? 'up' : 'down')}>{o.impact > 0 ? '+' : ''}{o.impact.toFixed(2)}</span><span className="tag" style={{ marginLeft: 'auto', color: o.impact > 0 ? 'var(--up)' : 'var(--down)' }}>{o.tag}</span></div>)}</div>
        </div>
      </>}
    </>
  )
}

export function Scenario() {
  const ids = ['ev_push', 'infra_boom', 'defence_push', 'crudedrop', 'repocut', 'stagflation']
  const [data, setData] = useState<Analysis[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { Promise.all(ids.map(reasoning.propagate)).then(setData).catch(() => setErr(true)) }, [])
  if (err) return <><div className="h">Scenarios</div><ApiDown /></>
  return (
    <>
      <div className="h">Scenarios <small>· counterfactual — alternate futures</small></div>
      {!data ? <Loading /> : <div className="grid2">{data.map(d => {
        const cf = d.id.includes('drop') || d.id.includes('cut')
        return <div className="panel" key={d.id}><div className="ptitle">{cf && <span style={{ color: 'var(--info)' }}>counterfactual · </span>}{d.label}</div>
          <div style={{ padding: '11px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6 }}>BENEFITS</div>
            {d.winners.slice(0, 3).map(w => <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0' }}><span>{w.name}</span><span className="num up">+{w.impact.toFixed(2)}</span></div>)}
            <div style={{ fontSize: 11, color: 'var(--t3)', margin: '8px 0 6px' }}>HURT</div>
            {d.losers.length ? d.losers.slice(0, 3).map(w => <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0' }}><span>{w.name}</span><span className="num down">{w.impact.toFixed(2)}</span></div>) : <div className="meta">none</div>}
          </div></div>
      })}</div>}
    </>
  )
}

export function Graph() {
  const [g, setG] = useState<Awaited<ReturnType<typeof reasoning.graph>> | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { reasoning.graph().then(setG).catch(() => setErr(true)) }, [])
  if (err) return <><div className="h">Knowledge graph</div><ApiDown /></>
  if (!g) return <><div className="h">Knowledge graph</div><Loading /></>
  const NM = Object.fromEntries(g.nodes.map(n => [n.id, n.name]))
  const byType: Record<string, number> = {}
  g.nodes.forEach(n => { byType[n.type] = (byType[n.type] || 0) + 1 })
  return (
    <>
      <div className="h">Knowledge graph <small>· entities &amp; causal relationships</small></div>
      <div className="strip" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="tile"><div className="lab">Entities</div><div className="val num">{g.nodes.length}</div></div>
        <div className="tile"><div className="lab">Relationships</div><div className="val num">{g.edges.length}</div></div>
        <div className="tile"><div className="lab">Node types</div><div className="val num">{Object.keys(byType).length}</div></div>
        <div className="tile"><div className="lab">Avg confidence</div><div className="val num">{(g.edges.reduce((a, e) => a + e.confidence, 0) / g.edges.length).toFixed(2)}</div></div>
      </div>
      <div className="panel"><div className="ptitle">Entities by type</div>
        <div style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>{Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => <span className="tag" key={t} style={{ fontSize: 12, padding: '5px 11px' }}>{t} · <b style={{ color: 'var(--t1)' }}>{n}</b></span>)}</div>
      </div>
      <div className="panel"><div className="ptitle">Causal edges <span className="act">sign · strength · confidence</span></div>
        <table><thead><tr><th>From</th><th>To</th><th>Sign</th><th>Str</th><th>Conf</th><th style={{ textAlign: 'left' }}>Rationale</th></tr></thead>
          <tbody>{g.edges.slice(0, 30).map((e, i) => <tr key={i}><td className="sym">{NM[e.src] || e.src}</td><td>{NM[e.dst] || e.dst}</td><td className={e.sign > 0 ? 'up' : 'down'}>{e.sign > 0 ? '+' : '−'}</td><td className="num">{e.strength.toFixed(2)}</td><td className="num">{e.confidence.toFixed(2)}</td><td style={{ textAlign: 'left', color: 'var(--t2)', fontSize: 11 }}>{e.why}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  )
}

export function Alpha() {
  const scn = ['crude', 'ev_push', 'infra_boom', 'defence_push', 'inr', 'repo']
  const [feed, setFeed] = useState<any[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    Promise.all(scn.map(reasoning.propagate)).then(ds => {
      const f: any[] = []
      ds.forEach(d => d.opportunities.forEach(o => f.push({ ...o, scenario: d.label })))
      f.sort((a, b) => Math.abs(b.impact) * (1 - b.coverage) - Math.abs(a.impact) * (1 - a.coverage))
      setFeed(f)
    }).catch(() => setErr(true))
  }, [])
  if (err) return <><div className="h">Alpha discovery</div><ApiDown /></>
  return (
    <>
      <div className="h">Alpha discovery <small>· mispriced relationships across scenarios</small></div>
      {!feed ? <Loading /> : <div className="panel"><div className="ptitle">Alpha feed · high impact × low coverage <span className="act">{feed.length} signals</span></div>
        {feed.slice(0, 16).map((o, i) => <div className="star" key={i}><Icon name="target" size={15} /><span className="sym">{o.name}</span><span className={'num ' + (o.impact > 0 ? 'up' : 'down')}>{o.impact > 0 ? '+' : ''}{o.impact.toFixed(2)}</span><span className="meta">cov {Math.round(o.coverage * 100)}%</span><span className="meta" style={{ marginLeft: 8 }}>via {o.scenario}</span><span className="tag" style={{ marginLeft: 'auto', color: o.impact > 0 ? 'var(--up)' : 'var(--down)' }}>{o.tag}</span></div>)}
      </div>}
    </>
  )
}

export function Memory() {
  const [c, setC] = useState<any>(null)
  const [hs, setHs] = useState<any[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    reasoning.calibration().then(setC).catch(() => setErr(true))
    Promise.all(['rbi_cut', 'crude_spike', 'budget_capex'].map(reasoning.hypothesis)).then(setHs).catch(() => setErr(true))
  }, [])
  if (err) return <><div className="h">Market memory</div><ApiDown /></>
  return (
    <>
      <div className="h">Market memory <small>· calibration &amp; the hypothesis lab</small></div>
      {!c ? <Loading /> : c.n ? <>
        <div className="strip" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <div className="tile"><div className="lab">Scored predictions</div><div className="val num">{c.n}</div></div>
          <div className="tile"><div className="lab">Hit-rate</div><div className="val num up">{Math.round(c.hit_rate * 100)}%</div></div>
          <div className="tile"><div className="lab">Brier score</div><div className="val num">{c.brier.toFixed(3)}</div></div>
        </div>
        <div className="panel"><div className="ptitle">Calibration curve · is a 70% call right ~70% of the time?</div>
          <table><thead><tr><th style={{ textAlign: 'left' }}>Confidence band</th><th>n</th><th>Said</th><th>Was</th><th style={{ textAlign: 'left' }}>Verdict</th></tr></thead>
            <tbody>{c.curve.map((b: any, i: number) => { const diff = b.avg_conf - b.actual_hit; const v = Math.abs(diff) <= 0.12 ? 'well-calibrated' : diff > 0 ? 'over-confident' : 'under-confident'; return <tr key={i}><td style={{ textAlign: 'left' }}>{b.band}</td><td className="num">{b.n}</td><td className="num">{Math.round(b.avg_conf * 100)}%</td><td className="num">{Math.round(b.actual_hit * 100)}%</td><td style={{ textAlign: 'left', color: v === 'well-calibrated' ? 'var(--up)' : 'var(--warn)' }}>{v}</td></tr> })}</tbody>
          </table>
        </div>
        <div className="panel"><div className="ptitle">Accuracy by sector <span className="act">which causal edges held</span></div>
          {c.by_sector.map((s: any, i: number) => <div className="star" key={i}><span className="sym">{s.sector}</span><span className={'num ' + (s.hit >= 0.6 ? 'up' : 'down')} style={{ marginLeft: 'auto' }}>{Math.round(s.hit * 100)}% <span className="meta">n={s.n}</span></span></div>)}
        </div>
      </> : <div className="panel"><div className="stub"><Icon name="clock" size={30} />No scored predictions yet<span style={{ fontSize: 12, color: 'var(--t3)' }}>run <code>python intelligence/memory.py</code> to populate the memory</span></div></div>}
      {hs && <><div className="h" style={{ marginTop: 18 }}>Hypothesis lab <small>· what history says, with evidence</small></div>
        <div className="grid3">{hs.map((h, i) => <div className="panel" key={i}><div className="ptitle">{h.event_type.replace(/_/g, ' ')} <span className="act">{h.episodes} episodes</span></div>
          {(h.sectors || []).map((s: any, k: number) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 12.5 }}><span>{s.sector}</span><span><span className={'num ' + (s.avg_return > 0 ? 'up' : 'down')}>{s.avg_return > 0 ? '+' : ''}{s.avg_return}%</span> <span className="meta">·{Math.round(s.consistency * 100)}%·n{s.n}</span></span></div>)}
        </div>)}</div></>}
    </>
  )
}
