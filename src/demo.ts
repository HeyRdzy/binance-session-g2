// Browser demo mode — runs only when no Even Hub bridge is present.
// Renders the SAME screens (session.render()) into a DOM lens mockup and
// wires the SAME interactions: tap / swipe / double-tap buttons plus real
// voice via the Web Speech API (SpeechRecognition + speechSynthesis).
// This is what the demo video records: no hardware needed.

import { createSession, REFRESH_MS } from './app'

// Minimal Web Speech API types (not in the TS DOM lib).
interface SpeechAlternative {
  transcript: string
}
interface SpeechRecognitionResult {
  0: SpeechAlternative
  isFinal: boolean
}
interface SpeechRecognitionEvent extends Event {
  results: ArrayLike<SpeechRecognitionResult>
}
interface SpeechRecognition extends EventTarget {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
type SpeechRecognitionCtor = new () => SpeechRecognition

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`missing #${id}`)
  return node as T
}

const session = createSession()
const { state } = session

const companion = el('companion')
const demo = el('demo')
const lens = el<HTMLPreElement>('lens')
const statusLine = el('status')
const logBox = el('log')
const exitOverlay = el('exit-overlay')
const closedBox = el('closed')

companion.style.display = 'none'
demo.style.display = 'block'

function log(message: string): void {
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const line = document.createElement('div')
  line.textContent = `${time}  ${message}`
  logBox.prepend(line)
  while (logBox.children.length > 8) logBox.lastElementChild?.remove()
}

function render(): void {
  lens.textContent = session.render().join('\n')
  statusLine.textContent = state.updatedAt
    ? state.offline
      ? `OFFLINE — last update ${state.updatedAt.toLocaleTimeString()}`
      : `LIVE — Binance public data, updated ${state.updatedAt.toLocaleTimeString()}`
    : 'Loading live prices from Binance...'
}

function tap(): void {
  if (state.screen === 'voice') {
    toggleMic()
    return
  }
  if (state.screen === 'detail') session.nextCoin()
  else session.nextScreen()
  render()
}

function swipeUp(): void {
  if (state.screen === 'detail') session.prevCoin()
  else session.prevScreen()
  render()
}

function swipeDown(): void {
  if (state.screen === 'detail') session.nextCoin()
  else session.nextScreen()
  render()
}

// --- voice (Web Speech API; the phone's mic + speaker stand in for the
// glasses mic, since the G2 has no speaker and no on-device STT) ---
const SR: SpeechRecognitionCtor | undefined =
  window.SpeechRecognition ?? window.webkitSpeechRecognition

let recog: SpeechRecognition | null = null
const micBtn = el<HTMLButtonElement>('btn-mic')

function speak(text: string): void {
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 1
    window.speechSynthesis.speak(utterance)
  } catch {
    // speech synthesis unavailable — the reply still shows on the lens
  }
}

function handleTranscript(transcript: string): void {
  const reply = session.handleVoice(transcript)
  log(`Heard: "${transcript}" → ${reply}`)
  speak(reply)
  render()
}

function setMicUi(listening: boolean): void {
  state.listening = listening
  micBtn.textContent = listening ? '⏹ Stop listening' : '🎤 Listen (voice)'
  micBtn.classList.toggle('active', listening)
}

function toggleMic(): void {
  if (!SR) {
    log('Speech recognition not supported in this browser — type a command below.')
    el<HTMLInputElement>('voice-input').focus()
    return
  }
  if (recog) {
    recog.stop()
    return
  }
  recog = new SR()
  recog.lang = 'en-US'
  recog.interimResults = false
  recog.maxAlternatives = 1
  recog.continuous = false
  recog.onresult = (event) => {
    const transcript = event.results[0][0].transcript
    handleTranscript(transcript)
  }
  recog.onerror = () => {
    log('Mic error — check microphone permission, or type a command below.')
  }
  recog.onend = () => {
    // Single-shot per press: the user presses Listen once per command.
    recog = null
    setMicUi(false)
    render()
  }
  try {
    recog.start()
    setMicUi(true)
    render()
    log('Listening... say a command.')
  } catch {
    recog = null
    setMicUi(false)
    log('Could not start the microphone.')
  }
}

// --- controls ---
el('btn-tap').addEventListener('click', tap)
el('btn-up').addEventListener('click', swipeUp)
el('btn-down').addEventListener('click', swipeDown)
el('btn-dbltap').addEventListener('click', () => {
  exitOverlay.style.display = 'flex'
})
el('btn-exit-cancel').addEventListener('click', () => {
  exitOverlay.style.display = 'none'
})
el('btn-exit-confirm').addEventListener('click', () => {
  exitOverlay.style.display = 'none'
  demo.style.display = 'none'
  closedBox.style.display = 'block'
})
el('btn-restart').addEventListener('click', () => window.location.reload())
micBtn.addEventListener('click', toggleMic)

const voiceInput = el<HTMLInputElement>('voice-input')
function sendTyped(): void {
  const text = voiceInput.value.trim()
  if (!text) return
  voiceInput.value = ''
  handleTranscript(text)
}
el('btn-send').addEventListener('click', sendTyped)
voiceInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') sendTyped()
})

// --- boot + live refresh ---
void session.refresh().then(() => render())
render()
log(SR ? 'Voice ready (Web Speech API).' : 'Voice: mic not supported here — use the text box.')
setInterval(() => {
  void session.refresh().then((fresh) => {
    if (fresh) render()
  })
}, REFRESH_MS)
