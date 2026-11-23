// Voice command parsing — pure functions, no I/O.
// Commands are short on purpose: the lens shows one reply line, and the
// speaker (the phone — the G2 has no speaker) reads the same line aloud.

import { COINS } from './binance'

export type Command =
  | { type: 'coin'; symbol: string }
  | { type: 'screen'; screen: 'home' | 'detail' | 'alerts' | 'portfolio' | 'voice' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'refresh' }
  | { type: 'alert'; symbol: string; direction: 'above' | 'below'; price: number }
  | { type: 'exit' }
  | { type: 'unknown'; heard: string }

const COIN_WORDS: Record<string, string> = {
  bitcoin: 'BTCUSDT',
  btc: 'BTCUSDT',
  ethereum: 'ETHUSDT',
  eth: 'ETHUSDT',
  ether: 'ETHUSDT',
  bnb: 'BNBUSDT',
  binance: 'BNBUSDT',
  solana: 'SOLUSDT',
  sol: 'SOLUSDT',
}

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
}
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
}

/** "sixty two thousand five hundred" -> 62500. Returns null when no number words. */
export function parseNumberWords(text: string): number | null {
  const words = text.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean)
  let total = 0
  let current = 0
  let seen = false
  for (const w of words) {
    if (w in ONES) {
      current += ONES[w]
      seen = true
    } else if (w in TENS) {
      current += TENS[w]
      seen = true
    } else if (w === 'hundred') {
      current = (current || 1) * 100
      seen = true
    } else if (w === 'thousand') {
      total += (current || 1) * 1000
      current = 0
      seen = true
    } else if (w === 'million') {
      total += (current || 1) * 1000000
      current = 0
      seen = true
    }
  }
  if (!seen) return null
  return total + current
}

/** Last number in the text: digits ("62,000", "62k", "62000.5") or number words. */
export function parsePrice(text: string): number | null {
  const cleaned = text.toLowerCase().replace(/,/g, '')
  const digitMatches = [...cleaned.matchAll(/(\d+(?:\.\d+)?)\s*k\b|(\d+(?:\.\d+)?)/g)]
  if (digitMatches.length > 0) {
    const last = digitMatches[digitMatches.length - 1]
    const value = Number(last[1] ?? last[2])
    return last[1] !== undefined ? value * 1000 : value
  }
  return parseNumberWords(text)
}

function findCoin(text: string): string | null {
  for (const coin of COINS) {
    if (new RegExp(`\\b${coin.short.toLowerCase()}\\b`).test(text)) return coin.symbol
  }
  for (const [word, symbol] of Object.entries(COIN_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return symbol
  }
  return null
}

export function parseCommand(raw: string): Command {
  const text = raw.toLowerCase().replace(/[?!.]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return { type: 'unknown', heard: raw }

  // "alert bitcoin above 62000" / "alert btc below sixty two thousand"
  if (text.includes('alert')) {
    const symbol = findCoin(text)
    const direction = text.includes('below') || text.includes('under') || text.includes('less')
      ? 'below'
      : text.includes('above') || text.includes('over') || text.includes('more')
        ? 'above'
        : null
    const price = parsePrice(text)
    if (symbol && direction && price !== null && price > 0) {
      return { type: 'alert', symbol, direction, price }
    }
    return { type: 'screen', screen: 'alerts' }
  }

  if (/\b(exit|quit|close|stop listening|goodbye)\b/.test(text)) return { type: 'exit' }
  if (/\b(alerts?|notifications?)\b/.test(text)) return { type: 'screen', screen: 'alerts' }
  if (/\b(portfolio|holdings|my coins|balance)\b/.test(text)) return { type: 'screen', screen: 'portfolio' }
  if (/\b(voice|listen|command)\b/.test(text)) return { type: 'screen', screen: 'voice' }
  if (/\b(home|session|overview|summary|watchlist)\b/.test(text)) return { type: 'screen', screen: 'home' }
  if (/\brefresh|update\b/.test(text)) return { type: 'refresh' }
  if (/\bnext\b/.test(text)) return { type: 'next' }
  if (/\b(previous|back|prev)\b/.test(text)) return { type: 'prev' }

  const symbol = findCoin(text)
  if (symbol) return { type: 'coin', symbol }

  return { type: 'unknown', heard: raw }
}

/** Short example commands shown on the voice screen. */
export const VOICE_HINTS = [
  '"Bitcoin price"',
  '"alerts" · "portfolio"',
  '"alert BTC above 62000"',
]
