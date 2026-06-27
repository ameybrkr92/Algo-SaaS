import { NavLink, Outlet } from 'react-router-dom'
import { Icon } from './components/Icon'
import { Copilot } from './components/Copilot'
import { trading } from './lib/api'
import { usePoll } from './lib/useApi'
import { cls, num, signedInr } from './lib/format'

const TRADING = [
  ['', 'dash', 'Cockpit'], ['markets', 'markets', 'Markets'], ['charts', 'charts', 'Charts'],
  ['options', 'options', 'Options'], ['trade', 'trade', 'Trade'], ['folio', 'folio', 'Folio'],
  ['risk', 'risk', 'Risk'],
] as const
const BRAIN = [
  ['reason', 'spark', 'Reason'], ['scenario', 'layers', 'Scenario'], ['graph', 'options', 'Graph'],
  ['alpha', 'target', 'Alpha'], ['memory', 'clock', 'Memory'],
] as const

function Rail() {
  const item = ([to, icon, label]: readonly [string, string, string]) => (
    <NavLink key={to} to={'/' + to} end={to === ''} className={({ isActive }) => 'nav' + (isActive ? ' on' : '')}>
      <Icon name={icon} size={19} /><span>{label}</span>
    </NavLink>
  )
  return (
    <aside className="rail">
      <div className="logo">
        <svg viewBox="0 0 64 64"><path d="M20.5 20.5 L32 33.5 L43.5 20.5" stroke="#fff" strokeWidth="5.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M32 33.5 L32 47" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" /><circle cx="43.5" cy="20.5" r="3.4" fill="#fff" /></svg>
      </div>
      {TRADING.map(item)}
      <div className="railsep" />
      {BRAIN.map(item)}
      <div style={{ flex: 1 }} />
      {item(['setup', 'settings', 'Setup'])}
    </aside>
  )
}

function TopBar() {
  const funds = usePoll(trading.funds, 10000)
  const f = funds.data
  const conn = f ? { dot: 'var(--up)', text: 'Zerodha · Live' }
    : funds.error?.kind === 'no-key' ? { dot: 'var(--warn)', text: 'Not connected' }
    : funds.error?.kind === 'down' ? { dot: 'var(--down)', text: 'Engine offline' }
    : funds.error?.kind === 'bad-key' ? { dot: 'var(--down)', text: 'Key rejected' }
    : { dot: 'var(--t3)', text: 'Connecting…' }
  const dayPnl = f ? num(f.m2mrealized) + num(f.m2munrealized) : NaN
  return (
    <header className="topbar">
      <span className="pill"><span className="dot" style={{ background: conn.dot }} />{conn.text}</span>
      <label className="cmd"><Icon name="spark" size={16} /><input placeholder="Ask or command — “buy 50 NIFTY 24000 CE limit 130” or “review my risk”" /><span className="kbd">Ctrl K</span></label>
      <span className="pill num">Day P&amp;L&nbsp;<b className={cls(dayPnl) || undefined}>{f ? signedInr(dayPnl) : '—'}</b></span>
      <div className="iconbtn"><Icon name="bell" size={18} /></div>
      <div className="avatar">A</div>
    </header>
  )
}

export function App() {
  return (
    <div className="app">
      <Rail />
      <div className="main">
        <TopBar />
        <div className="content">
          <div className="work"><Outlet /></div>
          <Copilot />
        </div>
      </div>
    </div>
  )
}
