// Indian-market number formatting. Prices/P&L use tabular numerals (.num class);
// these helpers produce the strings. '−' is U+2212 (matches the design's minus).

const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function num(v: number | string): number {
  return typeof v === 'string' ? parseFloat(v) : v
}

/** ₹ amount with Indian grouping. `decimals` toggles 0 vs 2 places. */
export function inr(v: number | string, decimals = 0): string {
  const n = num(v)
  if (!isFinite(n)) return '—'
  return '₹' + (decimals ? nf2 : nf0).format(n)
}

/** Signed ₹ amount, e.g. "+₹12,480" / "−₹2,130" — sign before the symbol. */
export function signedInr(v: number | string, decimals = 0): string {
  const n = num(v)
  if (!isFinite(n)) return '—'
  const s = n > 0 ? '+' : n < 0 ? '−' : ''
  return s + '₹' + (decimals ? nf2 : nf0).format(Math.abs(n))
}

/** Plain price with grouping, 2 decimals (no currency symbol). */
export function price(v: number | string): string {
  const n = num(v)
  if (!isFinite(n)) return '—'
  return nf2.format(n)
}

/** Signed percentage, e.g. "+0.42%" / "−3.10%" — for gains/losses. */
export function pct(v: number | string): string {
  const n = num(v)
  if (!isFinite(n)) return '—'
  const s = n > 0 ? '+' : n < 0 ? '−' : ''
  return s + Math.abs(n).toFixed(2) + '%'
}

/** Unsigned percentage, e.g. "72.00%" — for magnitudes (utilisation, shares). */
export function pctAbs(v: number | string): string {
  const n = num(v)
  if (!isFinite(n)) return '—'
  return n.toFixed(2) + '%'
}

/** Up/down CSS class for a signed value (empty when flat). */
export function cls(v: number | string): string {
  const n = num(v)
  return n > 0 ? 'up' : n < 0 ? 'down' : ''
}
