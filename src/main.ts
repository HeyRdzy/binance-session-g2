// Binance Session — Even Hub app entry point.
//
// Two modes, one codebase:
//   - Glasses mode: the Even Hub bridge is present (simulator or real G2).
//     The app renders into a single 576x288 text container on the lens and
//     reacts to temple taps / swipes / double-tap via the SDK.
//   - Browser demo mode: no bridge appears within 5s (plain browser).
//     demo.ts takes over and renders the same screens into a DOM lens
//     mockup with Web Speech API voice, so the app can be demoed and
//     recorded without hardware.

import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
  AudioInputSource,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import { createSession, REFRESH_MS } from './app'

const BRIDGE_TIMEOUT_MS = 5000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

// The bridge promise can reject on some runtimes (the SDK JS is
// obfuscated, so its exact failure paths aren't auditable). A rejection
// must not kill the module before the timeout fires: convert it into a
// never-settling promise so the timeout still wins and demo mode starts.
const bridge = await withTimeout(
  waitForEvenAppBridge().catch(() => new Promise<EvenAppBridge>(() => {})),
  BRIDGE_TIMEOUT_MS,
)

if (!bridge) {
  // No Even Hub bridge — run the browser demo (same screens, same data).
  await import('./demo')
} else if (!(await runGlasses(bridge))) {
  // The SDK singleton reports itself "ready" in ANY browser (its
  // _ready flag is set at construction), so a plain browser reaches
  // glasses mode — but createStartUpPageContainer then fails because
  // there is no Flutter handler to talk to. That failure means "not
  // really on glasses": fall back to the browser demo instead of
  // leaving the lens stuck on "Starting…". On real G2 hardware (and
  // in the official simulator) the container is created fine, so
  // glasses mode is unaffected.
  await import('./demo')
}

async function runGlasses(bridge: EvenAppBridge): Promise<boolean> {
  const session = createSession()
  const { state } = session
  let lastContent = ''

  async function push(): Promise<void> {
    const content = session.render().join('\n')
    if (content === lastContent) return
    lastContent = content
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({ containerID: 1, containerName: 'main', content }),
    )
  }

  // Live data first, so the first frame already shows real prices.
  await session.refresh()
  const initial = session.render().join('\n')
  const result = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [
        new TextContainerProperty({
          xPosition: 0,
          yPosition: 0,
          width: 576,
          height: 288,
          borderWidth: 0,
          borderColor: 5,
          paddingLength: 4,
          containerID: 1,
          containerName: 'main',
          content: initial,
          isEventCapture: 1,
        }),
      ],
    }),
  )
  if (result !== 0) {
    console.error('createStartUpPageContainer failed:', result)
    return false
  }
  lastContent = initial

  // --- microphone (voice screen) ---
  // Audio arrives as PCM s16le @ 16kHz mono in `audioEvent`. There is no
  // on-device STT: transcripts need a provider (see stt.ts). We count
  // frames so the voice screen can show the mic is live.
  let micOn = false
  async function setMic(on: boolean): Promise<void> {
    if (on === micOn) return
    micOn = on
    state.listening = on
    try {
      // Start: glasses four-mic array (the default). Stop: no source arg.
      if (on) await bridge.audioControl(true, AudioInputSource.Glasses)
      else await bridge.audioControl(false)
    } catch {
      // Simulator / older app builds may not implement audio.
    }
    await push()
  }

  // --- events (same gotcha as the official minimal template) ---
  // CLICK_EVENT is 0 and protobuf omits zero-value fields, so a tap
  // arrives with `eventType` undefined. Resolve the default INSIDE the
  // envelope check. Taps/double-taps/lifecycle come on sysEvent, scrolls
  // on textEvent, PCM on audioEvent — never mix them.
  function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
    if (!envelope) return null
    return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
  }

  const unsubscribe = bridge.onEvenHubEvent((event: EvenHubEvent) => {
    const sysType = eventTypeOf(event.sysEvent)
    const textType = eventTypeOf(event.textEvent)

    // Double-tap anywhere exits (mode 1 = system confirm dialog, required).
    if (
      sysType === OsEventTypeList.DOUBLE_CLICK_EVENT ||
      textType === OsEventTypeList.DOUBLE_CLICK_EVENT
    ) {
      void setMic(false)
      void bridge.shutDownPageContainer(1)
      return
    }

    if (event.audioEvent) {
      state.micFrames += 1
      return
    }

    if (
      sysType === OsEventTypeList.SYSTEM_EXIT_EVENT ||
      sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT
    ) {
      void setMic(false)
      unsubscribe()
      return
    }

    // Swipe up / down (arrive on textEvent).
    if (textType === OsEventTypeList.SCROLL_TOP_EVENT) {
      if (state.screen === 'detail') session.prevCoin()
      else session.prevScreen()
      void setMic(false)
      void push()
      return
    }
    if (textType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      if (state.screen === 'detail') session.nextCoin()
      else session.nextScreen()
      void setMic(false)
      void push()
      return
    }

    // Single tap.
    if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
      if (state.screen === 'voice') {
        void setMic(!micOn)
      } else if (state.screen === 'detail') {
        session.nextCoin()
      } else {
        session.nextScreen()
      }
      void push()
      return
    }
  })

  // Live refresh every 10s; push only when the text actually changed.
  setInterval(() => {
    void session.refresh().then((fresh) => {
      if (fresh) void push()
    })
  }, REFRESH_MS)

  // While listening, refresh the frame counter on the voice screen.
  setInterval(() => {
    if (state.listening && state.screen === 'voice') void push()
  }, 2000)

  return true
}
