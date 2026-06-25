/**
 * Central brand configuration (white-label).
 *
 * This is the single source of truth for the product's public identity.
 * To rebrand the entire UI, change the values here — components read from
 * this object instead of hardcoding the name in dozens of places.
 *
 * NOTE: This product is built on OpenAlgo, which is licensed under the
 * GNU AGPL-3.0. You may rebrand the UI, but the AGPL requires that the
 * (modified) source remain available to users of the network service.
 * Keep the `poweredBy` attribution visible to stay compliant.
 */
export const BRAND = {
  /** Primary product name shown in the navbar, titles, and marketing copy. */
  name: 'TradeYantra',
  /** Short name for tight spaces (mobile, badges). */
  shortName: 'TradeYantra',
  /** Hero tagline. */
  tagline: 'Your Personal Algo Trading Platform',
  /** Secondary positioning line. */
  subTagline: 'Precision algo trading for Indian markets',
  /** Meta description / SEO blurb. */
  description:
    'TradeYantra — an algorithmic trading platform for Indian markets. Design, backtest, and execute strategies across 30+ brokers through one unified API.',
  /** Public domain (no protocol). */
  domain: 'tradeyantra.in',
  /** Canonical site URL. */
  url: 'https://tradeyantra.in',
  /** Support contact. */
  email: 'support@tradeyantra.in',
  /** Brand logo path (served from /public). */
  logo: '/logo.svg',
  /** External resource links. */
  links: {
    docs: 'https://docs.openalgo.in',
    github: 'https://github.com/marketcalls/openalgo',
  },
  /**
   * Upstream attribution. Required by the AGPL-3.0 license of the project
   * TradeYantra is built on. Surface this in the footer.
   */
  poweredBy: 'OpenAlgo',
} as const

export type Brand = typeof BRAND
