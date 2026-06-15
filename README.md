# Meeting Capture Lab

A minimal, **honest** proof-of-concept for one question:

> Can an Electron app detect that a meeting is happening (Zoom / Meet / Teams / etc.)
> and record **both sides** of the audio — your microphone *and* the other party's
> voice (system / loopback audio)?

The hard part is not detection. It's capturing system audio, which behaves very
differently across platforms. This repo exists to find out exactly where it
works and where it doesn't, instead of guessing.

## What it does

1. **Detect** — polls open window titles via `desktopCapturer` (main process) and
   matches them against meeting-app patterns. No accessibility hacks, no private APIs.
2. **Prompt** — shows a banner when a meeting window appears.
3. **Capture** — mixes `getUserMedia(mic)` + system/loopback audio into one stream
   with the Web Audio API.
4. **Record** — `MediaRecorder` → a playable `audio/webm` blob.

Every internal step is logged in the UI so you can see precisely what succeeds.

## Why a hardened config

`main.js` deliberately uses `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: false` — a production-style setup. Under it the renderer cannot
`require('electron')`, and `desktopCapturer` is main-process only. So detection and
screen-source enumeration live in main and are exposed over a tiny IPC bridge
(`preload.js`). This way the result transfers to a real app with the same config —
a PoC that cheats with `nodeIntegration: true` proves nothing.

## Known platform reality

- **System/loopback audio on macOS** is the make-or-break step. Chromium's
  `chromeMediaSource: 'desktop'` audio is unreliable on macOS; you typically need
  a virtual audio device (e.g. BlackHole) or, on Electron 38, the
  `setDisplayMediaRequestHandler(..., { audio: 'loopback' })` path this repo wires up.
  The log will say `⚠️ EMPTY — no loopback` when the system track comes back empty.
- **Windows / Linux**: loopback via the desktop capturer is generally more cooperative.
- **Microphone + window detection** work on all three given OS permissions.

## Run

```bash
npm install
npm start
```

On macOS, grant **Screen Recording** and **Microphone** permission to Electron
(System Settings → Privacy & Security), then restart the app. The permission
pills at the top show live status.

## License

MIT
