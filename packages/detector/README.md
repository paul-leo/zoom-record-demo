# meetcap-detector

Detect that a native meeting client is **in a call** — Zoom, Microsoft Teams, 腾讯会议, 飞书/Lark out of the box, plus your own rules. Window-title + process-name dual signal. Built for Electron.

```bash
npm install meetcap-detector meetcap-core
```

Detection needs `desktopCapturer` and `ps-list` (both **main-process only**), so the poller runs in main and broadcasts edge events to the renderer. Two process entries:

- `meetcap-detector/main` — the Electron poller.
- `meetcap-detector/renderer` — a tiny framework-agnostic event client.

### Main process

```ts
import { startDetector } from 'meetcap-detector/main'

const detector = startDetector({
  intervalMs: 3000,
  require: 'window', // or 'window+process' for higher precision
})
// detector.stop() to tear down
```

### Preload

```ts
import { contextBridge, ipcRenderer } from 'electron'
import { exposeMeetcapBridge } from 'meetcap-core/preload'
exposeMeetcapBridge(contextBridge, ipcRenderer)
```

### Renderer

```ts
import { createDetectorClient } from 'meetcap-detector/renderer'

const detector = createDetectorClient()
detector.on('meeting-detected', (m) => console.log('joined', m.app, m.windowName))
detector.on('meeting-ended', () => console.log('left'))
// detector.current / detector.isInMeeting for current state
```

Framework-agnostic by design — wire it into React/Vue state yourself in a few lines.

## Custom rules

A rule matches by window title and/or process name. Strings are case-insensitive substrings; RegExps test directly; a function gets the raw string.

```ts
import { startDetector } from 'meetcap-detector/main'
import { presets } from 'meetcap-detector'

startDetector({
  rules: [
    ...presets, // keep the built-ins
    { id: 'mymeet', app: 'MyMeet', window: [/MyMeet 通话/, 'mymeet call'], process: [/mymeet/i] },
  ],
})
```

Pass only your own rules to replace the built-ins. Use a function matcher for tricky cases: `window: (t) => t.startsWith('Call · ')`.

**Finding the right pattern:** call `window.meetcap.listWindows()` while in a meeting to see exact window titles; check process names with your OS task manager.

## `require` policy

- `'window'` (default) — a title match fires; process name attached as a cue.
- `'window+process'` — title **and** a process of the same rule must match. Fewer false positives; needs the client running.

## Pure API (testable, no Electron)

`matchWindow`, `matchProcess`, `resolveMeeting`, `createDetectionState`, `toMatcher`, `presets` are exported from the package root and run anywhere.

## License

MIT
