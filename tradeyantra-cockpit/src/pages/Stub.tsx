import { Icon } from '../components/Icon'

export function Stub({ title, note, icon = 'dash' }: { title: string; note: string; icon?: string }) {
  return (
    <>
      <div className="h">{title}</div>
      <div className="panel"><div className="stub"><Icon name={icon} size={30} />{note}
        <span style={{ fontSize: 12, color: 'var(--t3)' }}>ported from the prototype design next</span>
      </div></div>
    </>
  )
}
