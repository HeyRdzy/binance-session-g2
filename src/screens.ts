// Screen rendering — pure functions.
// Every screen returns short text lines for the 576x288 lens canvas
// (line height 27px, so at most ~9 lines; we keep to 8 and short lines
// because the firmware wraps with its own glyph widths).
// The same lines feed the real glasses (SDK text container) and the
// browser demo (DOM <pre>), so both always show the same thing.

import { COINS, fmtCompactUsd, fmtPct, fmtPrice, fmtTime, fmtUsd, fmtVolume, type Ticker } from './binance'

export type Screen = 'home' | 'detail' | 'alerts' | 'portfolio' | 'voice'

export interface Alert {
  id: string
  symbol: string
  direction: 'above' | 'below'
  price: number
  hit: boolean
  hitAt: string | null
}

export interface SessionState {
  screen: Screen
  coinIndex: number
  tickers: Record<string, Ticker>
  updatedAt: Date | null
  offline: boolean
  alerts: Alert[]
  lastHeard: string
  lastReply: string
  listening: boolean
  micFrames: number
}

function shortOf(symbol: string): string {
  return COINS.find((c) => c.symbol === symbol)?.short ?? symbol.replace('USDT', '')
}

function statusLine(s: SessionState): string {
  if (!s.updatedAt) return 'Loading prices...'
  if (s.offline) return `OFFLINE - last ${fmtTime(s.updatedAt)}`
  return `LIVE ${fmtTime(s.updatedAt)}`
}

function renderHome(s: SessionState): string[] {
  const lines: string[] = ['BINANCE SESSION', statusLine(s)]
  for (const coin of COINS) {
    const t = s.tickers[coin.symbol]
    lines.push(
      t
        ? `${coin.short}  ${fmtPrice(t.lastPrice)}  ${fmtPct(t.priceChangePercent)}`
        : `${coin.short}  --`,
    )
  }
  lines.push('Tap: detail - Dbl-tap: exit')
  return lines
}

function renderDetail(s: SessionState): string[] {
  const coin = COINS[s.coinIndex % COINS.length]
  const t = s.tickers[coin.symbol]
  if (!t) return [coin.name.toUpperCase(), 'Loading...', 'Tap: next coin']
  return [
    `${coin.name.toUpperCase()} - ${coin.symbol}`,
    fmtPrice(t.lastPrice),
    `24h  ${fmtPct(t.priceChangePercent)}  (${fmtPrice(t.priceChange)})`,
    `High ${fmtPrice(t.highPrice)} Low ${fmtPrice(t.lowPrice)}`,
    `Vol ${fmtVolume(t.volume, coin.short)}`,
    `Vol ${fmtCompactUsd(t.quoteVolume)} USDT`,
    'Tap: next coin - Swipe: back',
  ]
}

function renderAlerts(s: SessionState): string[] {
  const lines: string[] = [`PRICE ALERTS (${s.alerts.length})`]
  if (s.alerts.length === 0) {
    lines.push('No alerts yet.')
    lines.push('Say: "alert BTC above 62000"')
    return lines
  }
  for (const a of s.alerts.slice(0, 5)) {
    const short = shortOf(a.symbol)
    const state = a.hit ? `HIT ${a.hitAt ?? ''}` : 'ARMED'
    lines.push(`${short} ${a.direction} ${fmtPrice(a.price)} - ${state}`)
  }
  lines.push('Say: "alert BTC above 62000"')
  return lines.slice(0, 8)
}

export interface Holding {
  short: string
  amount: number
  cost: number // average buy price, USDT
}

/** Paper portfolio — DEMO funds only, never a real account. */
export const PAPER_HOLDINGS: Holding[] = [
  { short: 'BTC', amount: 0.05, cost: 58000 },
  { short: 'ETH', amount: 1.2, cost: 1600 },
  { short: 'BNB', amount: 5, cost: 580 },
  { short: 'SOL', amount: 20, cost: 120 },
]

function renderPortfolio(s: SessionState): string[] {
  const lines: string[] = ['PAPER PORTFOLIO - DEMO']
  let totalValue = 0
  let totalCost = 0
  for (const h of PAPER_HOLDINGS) {
    const t = s.tickers[h.short + 'USDT']
    const value = t ? t.lastPrice * h.amount : 0
    totalValue += value
    totalCost += h.cost * h.amount
    lines.push(
      t ? `${h.amount} ${h.short}   ${fmtUsd(value)}` : `${h.amount} ${h.short}   --`,
    )
  }
  const pnlPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0
  lines.push(`Total ${fmtUsd(totalValue)} - PnL ${fmtPct(pnlPct)}`)
  lines.push('Demo funds - not real money')
  return lines
}

function renderVoice(s: SessionState): string[] {
  const lines: string[] = ['VOICE - say a command']
  if (s.listening) lines.push(`Listening... (${s.micFrames} frames)`)
  else lines.push('Tap to start listening')
  if (s.lastHeard) lines.push(`Heard: "${s.lastHeard}"`)
  if (s.lastReply) lines.push(s.lastReply)
  lines.push('Try: "Bitcoin price" - "alerts"')
  lines.push('"alert BTC above 62000"')
  return lines.slice(0, 8)
}

export function renderScreen(s: SessionState): string[] {
  switch (s.screen) {
    case 'home':
      return renderHome(s)
    case 'detail':
      return renderDetail(s)
    case 'alerts':
      return renderAlerts(s)
    case 'portfolio':
      return renderPortfolio(s)
    case 'voice':
      return renderVoice(s)
  }
}
