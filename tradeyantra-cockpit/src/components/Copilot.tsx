import { useLocation } from 'react-router-dom'
import { Icon } from './Icon'

type Ins = [kind: 'warn' | 'info' | 'ai', icon: string, head: string, body: string, btns: string[]]

const FEED: Record<string, Ins[]> = {
  '/': [
    ['warn', 'alert', 'Risk · position', 'BANKNIFTY lost 51,500 support. Your long FUT is −₹2,130. Trail stop to 51,250?', ['Set SL 51,250', 'Dismiss']],
    ['info', 'target', 'Opportunity', 'INFY +1.0% into resistance 1,635. You\'re +₹1,620. Book half (50)?', ['Prepare sell 50', 'Chart']],
    ['ai', 'layers', 'Proposed strategy', 'Weekly bullish on NIFTY → bull call spread 24200/24400. Debit ₹86, max +₹114.', ['Review payoff']],
  ],
  '/reason': [
    ['ai', 'layers', 'Reasoning', 'Every arrow has a sign, strength, confidence and lag. The non-obvious one: crude up → weaker rupee → IT exporters benefit.', ['Explain chain']],
    ['info', 'target', 'Discovery', 'Oil India is a real beneficiary but under-covered — a structural mispricing, not a tip.', ['Add to watchlist']],
  ],
  '/memory': [
    ['ai', 'clock', 'Calibration', 'I score every call against what actually happened. Right now: 75% hit-rate, well-calibrated in the mid band.', ['Why these misses?']],
    ['warn', 'alert', 'Learning', 'The crude→paints edge failed this episode — I\'m marking its confidence down.', ['Show edge']],
  ],
}
const DEFAULT: Ins[] = [['ai', 'spark', 'Copilot', 'I watch this module live and surface what matters — risk, opportunities, and ready-to-place actions. Ask me anything.', ['Examples']]]

export function Copilot() {
  const path = useLocation().pathname
  const feed = FEED[path] ?? DEFAULT
  return (
    <aside className="copilot">
      <div className="cohead">
        <div className="t"><span className="ai"><Icon name="spark" size={15} /></span> AI Copilot</div>
        <div className="tiers"><button className="on">Advisory</button><button>Co-pilot</button><button>Bounded-auto</button></div>
      </div>
      <div className="feed">
        {feed.map((i, k) => (
          <div key={k} className={'ins il-' + i[0]}>
            <div className="ih"><Icon name={i[1]} size={15} /> {i[2]}</div>
            <p dangerouslySetInnerHTML={{ __html: i[3].replace(/(−?\+?₹[\d,]+|[+−]\d[\d.]*%?|\d+%)/g, '<b>$1</b>') }} />
            <div className="row">{i[4].map((b, n) => <button key={n} className={n === 0 ? 'pri' : ''}>{b}</button>)}</div>
          </div>
        ))}
      </div>
      <div className="coin"><div className="box"><Icon name="spark" size={16} /><input placeholder="Ask or command…" /><div className="send"><Icon name="up" size={15} /></div></div></div>
    </aside>
  )
}
