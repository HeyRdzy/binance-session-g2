// Session state machine — shared by the glasses runtime (main.ts) and the
// browser demo (demo.ts). No DOM, no SDK calls here: pure state + data.

import { COINS, fetchTickers, fmtPct, fmtPrice, fmtTime, type Ticker } from './binance'
import { renderScreen, type Alert, type Screen, type SessionState } from './screens'
import { parseCommand, type Command } from './voice'

export type { Alert, Screen, SessionState }

const ALERTS_KEY = 'binance-session-alerts-v1'
const REFRESH_MS = 10_000

const DEFAULT_ALERTS: Alert[] = [
  { id: 'a1', symbol: 'BTCUSDT', direction: 'above', price: 62000, hit: false, hitAt: null },
  { id: 'a2', symbol: 'ETHUSDT', direction: 'below', price: 1650, hit: false, hitAt: null },
  { id: 'a3', symbol: 'SOLUSDT', direction: 'above', price: 140, hit: false, hitAt: null },
]

function loadAlerts(): Alert[] {
  try {
    const raw = localStorage.getItem(ALERTS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Alert[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // storage unavailable (some WebViews) — fall through to defaults
  }
  return DEFAULT_ALERTS.map((a) => ({ ...a }))
}

function saveAlerts(alerts: Alert[]): void {
  try {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts))
  } catch {
    // ignore — alerts just won't persist
  }
}

const SCREENS: Screen[] = ['home', 'detail', 'alerts', 'portfolio', 'voice']

export interface Session {
  state: SessionState
  /** Fetch live prices, check alerts. Returns true when fresh data arrived. */
  refresh(): Promise<boolean>
  nextScreen(): void
  prevScreen(): void
  show(screen: Screen): void
  nextCoin(): void
  prevCoin(): void
  /** Run a voice transcript through the command parser. Returns the reply. */
  handleVoice(transcript: string): string
  render(): string[]
}

export function createSession(): Session {
  const state: SessionState = {
    screen: 'home',
    coinIndex: 0,
    tickers: {},
    updatedAt: null,
    offline: false,
    alerts: loadAlerts(),
    lastHeard: '',
    lastReply: '',
    listening: false,
    micFrames: 0,
  }

  function checkAlerts(): void {
    let changed = false
    for (const a of state.alerts) {
      const t = state.tickers[a.symbol]
      if (!t || a.hit) continue
      const crossed = a.direction === 'above' ? t.lastPrice >= a.price : t.lastPrice <= a.price
      if (crossed) {
        a.hit = true
        a.hitAt = fmtTime(new Date())
        changed = true
      }
    }
    if (changed) saveAlerts(state.alerts)
  }

  async function refresh(): Promise<boolean> {
    try {
      const tickers = await fetchTickers(COINS.map((c) => c.symbol))
      const map: Record<string, Ticker> = {}
      for (const t of tickers) map[t.symbol] = t
      state.tickers = map
      state.updatedAt = new Date()
      state.offline = false
      checkAlerts()
      return true
    } catch {
      state.offline = true
      return false
    }
  }

  function show(screen: Screen): void {
    state.screen = screen
    state.listening = screen === 'voice' ? state.listening : false
  }

  function nextScreen(): void {
    const i = SCREENS.indexOf(state.screen)
    show(SCREENS[(i + 1) % SCREENS.length])
  }

  function prevScreen(): void {
    const i = SCREENS.indexOf(state.screen)
    show(SCREENS[(i - 1 + SCREENS.length) % SCREENS.length])
  }

  function nextCoin(): void {
    state.coinIndex = (state.coinIndex + 1) % COINS.length
  }

  function prevCoin(): void {
    state.coinIndex = (state.coinIndex - 1 + COINS.length) % COINS.length
  }

  function shortOf(symbol: string): string {
    return COINS.find((c) => c.symbol === symbol)?.short ?? symbol.replace('USDT', '')
  }

  function nameOf(symbol: string): string {
    return COINS.find((c) => c.symbol === symbol)?.name ?? symbol
  }

  function runCommand(cmd: Command): string {
    switch (cmd.type) {
      case 'coin': {
        state.coinIndex = COINS.findIndex((c) => c.symbol === cmd.symbol)
        show('detail')
        const t = state.tickers[cmd.symbol]
        return t
          ? `${nameOf(cmd.symbol)} ${fmtPrice(t.lastPrice)}, ${fmtPct(t.priceChangePercent)} in 24 hours.`
          : `${nameOf(cmd.symbol)} price not loaded yet.`
      }
      case 'screen':
        show(cmd.screen)
        return cmd.screen === 'alerts'
          ? `${state.alerts.length} alerts. ${state.alerts.filter((a) => a.hit).length} triggered.`
          : cmd.screen === 'portfolio'
            ? 'Paper portfolio. Demo funds only.'
            : cmd.screen === 'voice'
              ? 'Listening. Say a command.'
              : 'Binance session overview.'
      case 'next':
        if (state.screen === 'detail') nextCoin()
        else nextScreen()
        return 'Next.'
      case 'prev':
        if (state.screen === 'detail') prevCoin()
        else prevScreen()
        return 'Back.'
      case 'refresh':
        void refresh()
        return 'Refreshing prices.'
      case 'alert': {
        const existing = state.alerts.find(
          (a) => a.symbol === cmd.symbol && a.direction === cmd.direction && a.price === cmd.price,
        )
        if (existing) {
          show('alerts')
          return `Alert already set: ${shortOf(cmd.symbol)} ${cmd.direction} ${fmtPrice(cmd.price)}.`
        }
        const alert: Alert = {
          id: `a${Date.now()}`,
          symbol: cmd.symbol,
          direction: cmd.direction,
          price: cmd.price,
          hit: false,
          hitAt: null,
        }
        state.alerts = [...state.alerts, alert]
        saveAlerts(state.alerts)
        show('alerts')
        return `Alert set: ${shortOf(cmd.symbol)} ${cmd.direction} ${fmtPrice(cmd.price)}.`
      }
      case 'exit':
        return 'Double-tap to exit.'
      case 'unknown':
        return `Didn't catch that. Try "Bitcoin price", "alerts", or "portfolio".`
    }
  }

  function handleVoice(transcript: string): string {
    const heard = transcript.trim()
    state.lastHeard = heard
    const reply = runCommand(parseCommand(heard))
    state.lastReply = reply
    return reply
  }

  function render(): string[] {
    return renderScreen(state)
  }

  return { state, refresh, nextScreen, prevScreen, show, nextCoin, prevCoin, handleVoice, render }
}

export { REFRESH_MS }
