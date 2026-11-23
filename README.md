# Binance Session — Even G2 Glasses App

A glanceable, voice-first, **read-only** Binance trading session for Even Realities G2
smart glasses. Built for the **"Heads Up: Even Realities Hackathon"** (DoraHacks, TVM
Ventures & Daos Hub), **Track 3: Exchanges & Stocks**.

One screen at a time, big numbers, minimal text — the way the G2 wants it. No orders,
no transfers, no real funds: prices come from the Binance **public** API, and the
portfolio is a clearly-labeled **paper (demo)** portfolio.

## What it does

Five screens, navigated by temple tap / swipe (or buttons + voice in the browser demo):

| Screen | Content |
|---|---|
| **Session** (home) | BTC / ETH / BNB / SOL — live price + 24h % |
| **Detail** | One coin, big: price, 24h change, high/low, volume |
| **Alerts** | Price alerts (armed / hit), set by voice |
| **Portfolio** | Paper portfolio value + PnL — demo funds, not real money |
| **Voice** | Voice command screen: last heard command + reply |

Voice commands (English): `"Bitcoin price"`, `"alerts"`, `"portfolio"`, `"next"`,
`"refresh"`, `"alert BTC above 62000"`, `"alert bitcoin below sixty two thousand"`,
`"exit"`. Number words work ("sixty two thousand" → 62000, "2k" → 2000).

## Even Realities integration

- **Platform:** Even Hub — the app is a Vite + TypeScript web app that runs in a
  WebView inside the Even phone app. The SDK bridge turns code into display
  containers on the lenses and turns taps / swipes / mic audio back into events.
- **SDK:** `@evenrealities/even_hub_sdk` 0.0.16 (`waitForEvenAppBridge`,
  `TextContainerProperty`, `CreateStartUpPageContainer`, `textContainerUpgrade`,
  `onEvenHubEvent`, `audioControl`).
- **Canvas:** one text container, 576×288 px, 4-bit greyscale (monochrome green).
  Every screen is ≤ 8 short lines (line height 27 px) — enforced by tests.
- **Input:** temple tap (next), swipe up/down (prev/next), double-tap exits
  (system confirm dialog, as required). The tap-event gotcha from the official
  template is handled: `CLICK_EVENT` (0) arrives with `eventType` undefined, so
  the default is resolved inside the envelope check; taps live on `sysEvent`,
  scrolls on `textEvent`, PCM on `audioEvent`.
- **Microphone:** `audioControl(true, AudioInputSource.Glasses)` on the voice
  screen; audio arrives as PCM s16le @ 16 kHz mono. See `src/stt.ts`.
- **Permissions (`app.json`):** `network` whitelisted to
  `https://data-api.binance.vision` only; `g2-microphone` for voice capture.
- **Manifest:** `app.json` — package `com.heyrdzy.binancesession`, edition
  `202601`, entrypoint `index.html`.
- **Packaging:** `npm run pack` produces `binance-session-0.1.0.ehpk` (Even Hub
  package, custom `EHPK` container) for upload through the developer portal.

Docs used: [Your First App](https://hub.evenrealities.com/docs/get-started/quickstart/first-app),
[Display & UI System](https://hub.evenrealities.com/docs/build/display),
[UI/UX Design Guidelines](https://hub.evenrealities.com/docs/build/design-guidelines),
[Device APIs](https://hub.evenrealities.com/docs/build/device-apis),
[evenhub-templates](https://github.com/even-realities/evenhub-templates) (MIT — the
`minimal` template is the scaffold this app started from).

## Data — read-only, no key

- Prices: `GET https://data-api.binance.vision/api/v3/ticker/24hr?symbols=[...]`
  (the public data endpoint — `api.binance.com` is geo-blocked with HTTP 451 from
  some networks). One call for all four symbols, refreshed every 10 s.
- No Binance API key is used or needed. No account data is read. No order,
  transfer, or trade is ever placed. The portfolio is hard-coded paper holdings
  with a fixed cost basis, valued at live prices.
- If the network fails, the app shows `OFFLINE — last HH:MM` and keeps the last
  values. Alerts are stored in `localStorage` (best effort).

## Run it

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173
npm run simulate     # official simulator (needs a desktop + WebKitGTK, see below)
npm test             # unit + live-data tests
npm run build        # tsc + vite build
npm run pack         # build + pack into binance-session-0.1.0.ehpk
```

**Browser demo (no hardware needed):** open `http://localhost:5173` in a desktop
browser. No Even Hub bridge is found, so after ~5 s the app switches to demo mode:
the same screens render into a green 576×288 lens mockup, buttons simulate
tap / swipe / double-tap, and voice works end-to-end via the Web Speech API
(SpeechRecognition + speechSynthesis). A text box is provided as a typed
fallback for the same commands. This is what the demo video records.

**Real glasses:** `npm run dev`, then `npx evenhub qr --url http://<your-LAN-IP>:5173`
and scan the QR in the Even Hub companion app on a phone paired with your G2.
Hot-reload works on the lenses.

## Voice — how it works, and the honest limitation

- **Browser demo:** full loop works — microphone → Web Speech API transcript →
  command parser → lens reply + spoken reply (phone speaker).
- **Real glasses:** the G2 has **no speaker and no on-device STT**. Mic audio is
  captured through the SDK (`audioControl`, PCM 16 kHz) and the voice screen shows
  the mic is live (frame counter). Turning that audio into a transcript needs a
  speech-to-text provider — exactly like the official `asr` template, whose STT
  provider is "a blank stub — plug in your own" (Deepgram, AssemblyAI, Whisper,
  Soniox, self-hosted). `src/stt.ts` is that stub: implement `SttProvider` and call
  `setSttProvider()`. Voice replies are spoken by the **phone**, never the glasses.
- Until a provider is wired, voice commands on real hardware are received as audio
  but not transcribed; tap / swipe navigation works fully without voice.

## Project layout

```
app.json                  Even Hub manifest (package id, permissions)
index.html                Vite entry + browser-demo shell (lens mockup, controls)
public/icon.png           Greyscale 24x24 app icon
src/main.ts               Entry: bridge detection, glasses runtime, events, mic
src/app.ts                Session state machine (shared by glasses + demo)
src/screens.ts            Pure screen renderers -> lens text lines
src/binance.ts            Public Binance data + formatting
src/voice.ts              Voice command parser + number words
src/stt.ts                STT provider stub (see "Voice" above)
src/demo.ts               Browser demo mode (DOM lens + Web Speech API)
test/app.test.ts          Tests: parser, screens, session flow, live Binance
binance-session-0.1.0.ehpk  Packaged app (built by `npm run pack`)
```

## Known limitations (for the judges, stated plainly)

1. **No G2 hardware was available while building.** The app was verified with
   `tsc` + `vite build`, unit/live-data tests, the dev server, and the official
   `evenhub pack` validator — but not on real lenses. The official simulator
   could not run on the build VM (it needs `libwebkit2gtk-4.1` + a display;
   run `npm run simulate` on a desktop to verify the lens rendering).
2. **Voice transcription on hardware needs an STT provider key** (see above).
   The demo video uses the browser's Web Speech API, which is the same command
   parser and the same screens — but it is not the glasses microphone.
3. **Demo video is a screen recording of the browser demo**, not footage of the
   lenses. It shows the exact 576×288 green canvas the glasses would display.
4. Alerts persist in `localStorage` only and reset if storage is unavailable.
5. Four coins only (BTC / ETH / BNB / SOL) — the watchlist is a fixed constant
   in `src/binance.ts`.

## Hackathon

- Event: "Heads Up: Even Realities Hackathon" — DoraHacks, TVM Ventures & Daos Hub.
- Track 3: Exchanges & Stocks. Submission: repo link + 1–2 min demo video.
- Deadline: 30 Nov 2026, 02:59 WIB. Demo is testnet / paper / read-only only,
  per the track rules — this app is read-only by design.
