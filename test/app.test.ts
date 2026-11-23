// Tests for the Binance Session app — pure logic + live Binance fetch.
// Run with: npm test   (esbuild bundles this to /dev/shm, then node runs it)
// No framework: plain assertions, non-zero exit on failure.

import { fetchTickers, COINS } from '../src/binance'
import { parseCommand, parseNumberWords, parsePrice } from '../src/voice'
import { renderScreen, type SessionState } from '../src/screens'
import { createSession } from '../src/app'

let failures = 0

function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) {
    console.log(`  ok  ${name}`)
  } else {
    failures += 1
    console.log(`FAIL  ${name}${extra !== undefined ? ' — ' + JSON.stringify(extra) : ''}`)
  }
}

function eq<T>(name: string, got: T, want: T): void {
  check(name, JSON.stringify(got) === JSON.stringify(want), { got, want })
}

// --- number words ---
eq('words: sixty two thousand five hundred', parseNumberWords('sixty two thousand five hundred'), 62500)
eq('words: one hundred twenty three', parseNumberWords('one hundred twenty three'), 123)
eq('words: two thousand', parseNumberWords('two thousand'), 2000)
eq('words: none', parseNumberWords('hello world'), null)

// --- prices ---
eq('price: 62,000', parsePrice('alert btc above 62,000'), 62000)
eq('price: 62k', parsePrice('alert btc above 62k'), 62000)
eq('price: 1,724.82', parsePrice('eth at 1,724.82'), 1724.82)
eq('price: words', parsePrice('alert bitcoin below sixty two thousand'), 62000)

// --- commands ---
eq('cmd: bitcoin price', parseCommand('Bitcoin price'), { type: 'coin', symbol: 'BTCUSDT' })
eq('cmd: show me solana', parseCommand('show me solana'), { type: 'coin', symbol: 'SOLUSDT' })
eq('cmd: alerts', parseCommand('show alerts'), { type: 'screen', screen: 'alerts' })
eq('cmd: portfolio', parseCommand('my portfolio'), { type: 'screen', screen: 'portfolio' })
eq('cmd: alert digits', parseCommand('alert BTC above 62000'), { type: 'alert', symbol: 'BTCUSDT', direction: 'above', price: 62000 })
eq('cmd: alert words', parseCommand('alert bitcoin below sixty two thousand'), { type: 'alert', symbol: 'BTCUSDT', direction: 'below', price: 62000 })
eq('cmd: alert 2k', parseCommand('alert eth above 2k'), { type: 'alert', symbol: 'ETHUSDT', direction: 'above', price: 2000 })
eq('cmd: next', parseCommand('next'), { type: 'next' })
eq('cmd: refresh', parseCommand('refresh'), { type: 'refresh' })
eq('cmd: exit', parseCommand('exit'), { type: 'exit' })
eq('cmd: unknown', parseCommand('gibberish xyz'), { type: 'unknown', heard: 'gibberish xyz' })

// --- screens (fake tickers) ---
const fake: SessionState = {
  screen: 'home',
  coinIndex: 0,
  tickers: {
    BTCUSDT: { symbol: 'BTCUSDT', lastPrice: 61120.44, priceChange: 861.44, priceChangePercent: 1.43, highPrice: 61669.99, lowPrice: 58768.51, volume: 20022.63, quoteVolume: 1208395054 },
    ETHUSDT: { symbol: 'ETHUSDT', lastPrice: 1724.82, priceChange: 40.64, priceChangePercent: 2.41, highPrice: 1732.52, lowPrice: 1648.35, volume: 232549.5, quoteVolume: 394640465 },
    BNBUSDT: { symbol: 'BNBUSDT', lastPrice: 612.45, priceChange: 9.58, priceChangePercent: 1.59, highPrice: 620.1, lowPrice: 598.2, volume: 850000, quoteVolume: 520000000 },
    SOLUSDT: { symbol: 'SOLUSDT', lastPrice: 128.45, priceChange: 1.1, priceChangePercent: 0.86, highPrice: 131.2, lowPrice: 126.0, volume: 5400000, quoteVolume: 690000000 },
  },
  updatedAt: new Date('2026-11-23T06:30:00'),
  offline: false,
  alerts: [
    { id: 'a1', symbol: 'BTCUSDT', direction: 'above', price: 62000, hit: false, hitAt: null },
    { id: 'a2', symbol: 'ETHUSDT', direction: 'below', price: 1650, hit: true, hitAt: '06:02' },
  ],
  lastHeard: 'bitcoin price',
  lastReply: 'Bitcoin $61,120, +1.43% in 24 hours.',
  listening: false,
  micFrames: 0,
}

for (const screen of ['home', 'detail', 'alerts', 'portfolio', 'voice'] as const) {
  const lines = renderScreen({ ...fake, screen })
  check(`screen ${screen}: <=8 lines`, lines.length <= 8, lines)
  check(`screen ${screen}: lines <=44 chars`, lines.every((l) => l.length <= 44), lines)
  console.log(`--- ${screen} ---`)
  for (const l of lines) console.log(`  ${l}`)
}
check('home shows BTC price', renderScreen({ ...fake, screen: 'home' }).join('\n').includes('$61,120'))
check('detail shows high/low', renderScreen({ ...fake, screen: 'detail' }).join('\n').includes('High $61,670'))
check('portfolio shows PnL', renderScreen({ ...fake, screen: 'portfolio' }).join('\n').includes('PnL'))
check('alerts shows HIT', renderScreen({ ...fake, screen: 'alerts' }).join('\n').includes('HIT 06:02'))

// --- session voice flow ---
const session = createSession()
const reply = session.handleVoice('bitcoin price')
check('session: voice switches to detail', session.state.screen === 'detail')
check('session: reply mentions Bitcoin', reply.includes('Bitcoin'), reply)
const alertReply = session.handleVoice('alert bnb above 700')
check('session: voice adds alert', session.state.alerts.some((a) => a.symbol === 'BNBUSDT' && a.price === 700), alertReply)

// --- live Binance data ---
console.log('--- live Binance (data-api.binance.vision) ---')
const tickers = await fetchTickers(COINS.map((c) => c.symbol))
check('live: 4 tickers', tickers.length === 4, tickers.length)
for (const t of tickers) {
  check(`live: ${t.symbol} price > 0`, t.lastPrice > 0, t.lastPrice)
  console.log(`  ${t.symbol}: $${t.lastPrice} (${t.priceChangePercent.toFixed(2)}% 24h)`)
}

if (failures > 0) {
  console.log(`\n${failures} FAILURE(S)`)
  process.exit(1)
}
console.log('\nAll tests passed.')
