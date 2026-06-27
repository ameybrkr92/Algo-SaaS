import { useState } from 'react'
import { Icon } from '../components/Icon'
import { ApiError, getApiKey, setApiKey, trading } from '../lib/api'
import { inr } from '../lib/format'

type Status = { kind: 'idle' | 'testing' | 'ok' | 'fail'; msg: string }

const inputStyle: React.CSSProperties = {
  flex: 1, background: 'var(--bg-inset)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--t1)',
  font: 'inherit', fontFamily: 'var(--mono)', fontSize: 12.5, outline: 'none',
}
const btn = (primary?: boolean): React.CSSProperties => ({
  font: 'inherit', fontSize: 12.5, padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
  border: '1px solid ' + (primary ? 'var(--accent)' : 'var(--border-strong)'),
  background: primary ? 'var(--accent)' : 'var(--bg-elev)', color: primary ? '#fff' : 'var(--t1)',
})

export function Setup() {
  const [key, setKey] = useState(getApiKey())
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle', msg: '' })

  async function saveAndTest() {
    setApiKey(key)
    setStatus({ kind: 'testing', msg: '' })
    try {
      const f = await trading.funds()
      setStatus({ kind: 'ok', msg: `Connected — available cash ${inr(f.availablecash)}` })
    } catch (e) {
      const m = e instanceof ApiError
        ? (e.kind === 'down' ? 'OpenAlgo engine unreachable — is it running on port 5000?'
          : e.kind === 'bad-key' ? 'Key rejected — copy a fresh one from /apikey'
          : e.message)
        : String(e)
      setStatus({ kind: 'fail', msg: m })
    }
  }

  function clear() {
    setApiKey('')
    setKey('')
    setStatus({ kind: 'idle', msg: '' })
  }

  const dot = status.kind === 'ok' ? 'var(--up)' : status.kind === 'fail' ? 'var(--down)' : 'var(--t3)'

  return (
    <>
      <div className="h">Setup <small>· broker connection &amp; services</small></div>

      <div className="panel">
        <div className="ptitle">OpenAlgo API key <span className="act">authenticates every trading call</span></div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6 }}>
            The cockpit reads live funds, positions, holdings and quotes from your OpenAlgo
            engine using its API key. Generate or copy one from{' '}
            <a href="http://127.0.0.1:5000/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
              127.0.0.1:5000/apikey
            </a>, then paste it here. It's stored only in this browser.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={inputStyle}
              type={show ? 'text' : 'password'}
              placeholder="paste your OpenAlgo API key"
              value={key}
              onChange={e => setKey(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
            <button style={btn()} onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button>
            <button style={btn(true)} onClick={saveAndTest} disabled={!key.trim()}>
              {status.kind === 'testing' ? 'Testing…' : 'Save & test'}
            </button>
            {getApiKey() && <button style={btn()} onClick={clear}>Clear</button>}
          </div>
          {status.kind !== 'idle' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
              color: status.kind === 'fail' ? 'var(--down)' : status.kind === 'ok' ? 'var(--up)' : 'var(--t2)' }}>
              <span className="dot" style={{ background: dot }} />
              {status.kind === 'testing' ? 'Checking connection…' : status.msg}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="ptitle">Services</div>
        <table>
          <thead><tr><th style={{ textAlign: 'left' }}>Service</th><th>Port</th><th style={{ textAlign: 'left' }}>Powers</th></tr></thead>
          <tbody>
            <tr><td style={{ textAlign: 'left' }}><span className="sym">OpenAlgo engine</span></td><td className="num">5000</td><td style={{ textAlign: 'left', color: 'var(--t2)' }}>Cockpit · Folio · live quotes (Zerodha)</td></tr>
            <tr><td style={{ textAlign: 'left' }}><span className="sym">Reasoning API</span></td><td className="num">6061</td><td style={{ textAlign: 'left', color: 'var(--t2)' }}>Reason · Scenario · Graph · Alpha · Memory</td></tr>
            <tr><td style={{ textAlign: 'left' }}><span className="sym">Market WebSocket</span></td><td className="num">8765</td><td style={{ textAlign: 'left', color: 'var(--t2)' }}>streaming ticks (polling for now)</td></tr>
          </tbody>
        </table>
        <div className="star" style={{ color: 'var(--t3)', fontSize: 12 }}>
          <Icon name="alert" size={14} />
          Zerodha broker tokens expire daily ~3 AM IST — re-login at the engine if quotes stop.
        </div>
      </div>
    </>
  )
}
