// Public Binance market data — no API key needed.
// Uses the public data endpoint (data-api.binance.vision) because
// api.binance.com is geo-blocked (HTTP 451) from some networks.
// Read-only: this module never places orders or touches an account.

export interface Coin {
  symbol: string // e.g. BTCUSDT
  name: string // e.g. Bitcoin
  short: string // e.g. BTC
}

export const COINS: Coin[] = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', short: 'BTC' },
  { symbol: 'ETHUSDT', name: 'Ethereum', short: 'ETH' },
  { symbol: 'BNBUSDT', name: 'BNB', short: 'BNB' },
  { symbol: 'SOLUSDT', name: 'Solana', short: 'SOL' },
]

export interface Ticker {
  symbol: string
  lastPrice: number
  priceChange: number // absolute 24h change in quote currency
  priceChangePercent: number
  highPrice: number
  lowPrice: number
  volume: number // base asset volume
  quoteVolume: number // quote asset volume (USDT)
}

const BASE = 'https://data-api.binance.vision'

export async function fetchTickers(symbols: string[]): Promise<Ticker[]> {
  const query = encodeURIComponent(JSON.stringify(symbols))
  const res = await fetch(`${BASE}/api/v3/ticker/24hr?symbols=${query}`)
  if (!res.ok) throw new Error(`Binance ${res.status}`)
  const rows = (await res.json()) as Array<Record<string, string>>
  return rows.map((r) => ({
    symbol: r.symbol,
    lastPrice: Number(r.lastPrice),
    priceChange: Number(r.priceChange),
    priceChangePercent: Number(r.priceChangePercent),
    highPrice: Number(r.highPrice),
    lowPrice: Number(r.lowPrice),
    volume: Number(r.volume),
    quoteVolume: Number(r.quoteVolume),
  }))
}

// --- formatting helpers (short, for the 576x288 lens) ---

/** $61,120 for >= 1000, $1,724.82 / $128.45 below; -$861 when negative. */
export function fmtPrice(p: number): string {
  if (!Number.isFinite(p)) return '--'
  const sign = p < 0 ? '-' : ''
  const a = Math.abs(p)
  if (a >= 1000) return sign + '$' + Math.round(a).toLocaleString('en-US')
  return sign + '$' + a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** $10,748 (no decimals, commas). */
export function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '--'
  return '$' + Math.round(n).toLocaleString('en-US')
}

/** +1.43% / -0.82% */
export function fmtPct(p: number): string {
  if (!Number.isFinite(p)) return '--'
  return (p >= 0 ? '+' : '') + p.toFixed(2) + '%'
}

/** $1.21B / $394.64M / $8.82M */
export function fmtCompactUsd(n: number): string {
  if (!Number.isFinite(n)) return '--'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  return '$' + n.toFixed(0)
}

/** 20,023 BTC */
export function fmtVolume(n: number, short: string): string {
  if (!Number.isFinite(n)) return '--'
  return Math.round(n).toLocaleString('en-US') + ' ' + short
}

/** 06:12 */
export function fmtTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return p(d.getHours()) + ':' + p(d.getMinutes())
}
