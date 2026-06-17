# meetcap

**Detect a meeting and record both sides of the audio — in any Electron app.**

meetcap answers one question honestly: can an Electron app notice you've joined a meeting (Zoom / Teams / 腾讯会议 / 飞书) and record *both* your microphone *and* the other party's voice (system / loopback audio), then save it locally — with a hardened, production-style config?

It ships as two focused packages plus a shared core, so you take only what you need.

| Package | What it does |
|---|---|
| [`meetcap-detector`](packages/detector) | Detect that a meeting client is in a call, by window title + process name, with custom rules. |
| [`meetcap-recorder`](packages/recorder) | Record mic + system (loopback) audio and save to disk. Real macOS loopback. |
| [`meetcap-core`](packages/core) | Shared types, the IPC contract, and the `window.meetcap` preload bridge. |

Each renderer half ships **framework-agnostic events**, plus **React hooks** and **Vue composables**.

## Quick start

```bash
npm install meetcap-detector meetcap-recorder meetcap-core
```

```ts
// main.ts — runs before app.whenReady()
import { initRecorderMain } from 'meetcap-recorder/main'
import { startDetector } from 'meetcap-detector/main'
initRecorderMain()
app.whenReady().then(() => { createWindow(); startDetector({ require: 'window' }) })

// preload.ts
import { contextBridge, ipcRenderer } from 'electron'
import { exposeMeetcapBridge } from 'meetcap-core/preload'
exposeMeetcapBridge(contextBridge, ipcRenderer)

// renderer
import { createDetectorClient } from 'meetcap-detector/renderer'
import { createRecorder } from 'meetcap-recorder/renderer'
const detector = createDetectorClient()
const recorder = createRecorder()
detector.on('meeting-detected', (m) => recorder.start(m))
recorder.on('complete', (r) => recorder.save(r))
```

See [`examples/electron-demo`](examples/electron-demo) for a complete, runnable app.

## Architecture: who runs where

Electron splits this work across two processes; meetcap hides the split behind `/main` and `/renderer` entries.

```
 main process                          renderer process
 ────────────                          ────────────────
 desktopCapturer (window titles)  ┐
 ps-list (process names)          �├─ detect ──► broadcast ──► createDetectorClient / hooks
 rule engine                      ┘                              (meeting-detected / ended)

 initMain() loopback flags        ┐                          getUserMedia(mic)
 save-recording (fs)              ┤◄─ window.meetcap (IPC) ─►  getDisplayMedia(loopback)
 media-access                     ┘                          AudioContext mix → MediaRecorder
```

- **Detection** is essentially main-process — `desktopCapturer` and `ps-list` are main-only. The poller broadcasts edge events; the renderer just subscribes.
- **Recording** is renderer-process capture (`getUserMedia` / `getDisplayMedia` / `MediaRecorder`) plus main-process flag injection and disk writes.

## Platform support

| | Detection | Mic | System / loopback audio |
|---|---|---|---|
| **macOS 13.2+** | ✅ window + process | ✅ | ✅ via `MacLoopbackAudioForScreenShare` flags (injected) |
| **macOS < 13.2** | ✅ | ✅ | ⚠️ may be empty → records mic-only, `hasSystemAudio:false` |
| **Windows 10+** | ✅ | ✅ | ✅ WASAPI loopback |
| **Linux** | ✅ | ✅ | ✅ PulseAudio |

On macOS, grant **Screen Recording** + **Microphone** to your app (System Settings → Privacy & Security), then restart.

## Custom rules

Adapt to any meeting client without touching meetcap internals:

```ts
import { presets } from 'meetcap-detector'
startDetector({
  rules: [...presets, { id: 'mymeet', app: 'MyMeet', window: [/MyMeet 通话/], process: [/mymeet/i] }],
})
```

Strings match as case-insensitive substrings, RegExps test directly, or pass a function. See [meetcap-detector](packages/detector#custom-rules).

## Known limitations

- **Browser-based meetings** (Google Meet / Zoom Web in a tab) are **not** reliably detected — a browser tab has no distinctive process and a messy title. Recording still works (loopback captures whatever plays), only auto-detection is out of scope for now.
- No transcription / speaker diarization yet — meetcap captures audio; turning it into notes is downstream.

## Develop

```bash
pnpm install
pnpm build        # turbo: builds all packages
pnpm test         # vitest: rule engine, state machine, pure helpers
pnpm demo         # build + launch examples/electron-demo
```

## Debugging the demo

The demo is wired for AI-agent debugging via [harness-fe](https://github.com/Morphicai/harness-fe) in **solo mode** — a tokenless local gateway on `127.0.0.1:47620`. Install the skill (`npx @harness-fe/skill install`), reload MCP (`.mcp.json` is committed), run `pnpm demo`, and an agent can stream console/network/DOM and drive the window. Full guide: [docs/debugging.md](docs/debugging.md).

## Release

Changesets-driven. In a PR: `pnpm changeset` to declare bumps. On merge to `main`, CI opens a **Version Packages** PR; merging it publishes to npm (OIDC trusted publishing with NPM_TOKEN fallback). See `.github/workflows/release.yml`.

## License

MIT
