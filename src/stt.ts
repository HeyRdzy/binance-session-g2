// Speech-to-text plug-in point.
//
// How voice works on the real glasses:
//   1. The app starts mic capture with bridge.audioControl(true).
//      Audio arrives as PCM s16le @ 16 kHz mono frames in `audioEvent`.
//   2. Those frames must go to a speech-to-text provider — the G2 has no
//      on-device STT and no speaker. The official `asr` template ships the
//      same shape: "STT provider is a blank stub — plug in your own"
//      (Deepgram, AssemblyAI, Whisper, Soniox, self-hosted, ...).
//   3. The transcript is fed to handleVoice() in app.ts, which parses the
//      command and updates the lens. Voice replies are spoken by the PHONE
//      (the glasses are display-only); on the lens the reply shows as text.
//
// This file is that stub, kept explicit on purpose. The browser demo
// (demo.ts) uses the Web Speech API instead, so the full voice loop works
// end-to-end there and in the demo video without any provider key.

export interface SttProvider {
  /** Transcribe one chunk of PCM s16le 16kHz mono audio. */
  transcribe(pcm: Int16Array): Promise<string | null>
}

/**
 * No provider configured. Returns null so the caller can show the
 * "STT not configured" hint on the voice screen.
 *
 * To wire a real provider, implement SttProvider (e.g. POST the PCM to
 * Deepgram/Whisper) and pass it to createSession via setSttProvider().
 */
export const noSttProvider: SttProvider = {
  async transcribe(): Promise<string | null> {
    return null
  },
}

let provider: SttProvider = noSttProvider

export function setSttProvider(p: SttProvider): void {
  provider = p
}

export function getSttProvider(): SttProvider {
  return provider
}
