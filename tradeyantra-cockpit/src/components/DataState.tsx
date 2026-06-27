import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import type { ApiError } from '../lib/api'

export const Loading = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="panel"><div className="stub">{label}</div></div>
)

const sub = (children: ReactNode) => (
  <span style={{ fontSize: 12, color: 'var(--t3)' }}>{children}</span>
)
const link = (to: string, text: string) => (
  <Link to={to} style={{ color: 'var(--accent)' }}>{text}</Link>
)

// Renders the right "why there's no data" panel for each ApiError kind, mirroring
// the Brain tabs' ApiDown pattern. Trading pages return this in place of content.
export function DataState({ error }: { error: ApiError }) {
  switch (error.kind) {
    case 'no-key':
      return (
        <div className="panel"><div className="stub"><Icon name="settings" size={30} />
          Connect your broker
          {sub(<>add your OpenAlgo API key in {link('/setup', 'Setup')}</>)}
        </div></div>
      )
    case 'bad-key':
      return (
        <div className="panel"><div className="stub"><Icon name="alert" size={30} />
          API key rejected
          {sub(<>re-check it in {link('/setup', 'Setup')}</>)}
        </div></div>
      )
    case 'down':
      return (
        <div className="panel"><div className="stub"><Icon name="alert" size={30} />
          OpenAlgo engine not running
          {sub(<>start it: <code>uv run app.py</code> · port 5000</>)}
        </div></div>
      )
    default:
      return (
        <div className="panel"><div className="stub"><Icon name="alert" size={30} />
          {error.message || 'Broker request failed'}
          {sub('the broker rejected this — your Zerodha session may have expired (tokens reset ~3 AM IST)')}
        </div></div>
      )
  }
}
