# meetcap-detector

Detect that a native meeting client is **in a call** — Zoom, Microsoft Teams, 腾讯会议, 飞书/Lark out of the box, plus your own rules. Window-title + process-name dual signal. Built for Electron.

```bash
npm install meetcap-detector meetcap-core
```

## How it splits across processes

Detection needs `desktopCapturer` and `ps-list`, both **main-process only**. So the poller runs in main and broadcasts edge events to the renderer.

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

### Renderer — framework-agnostic

```ts
import { createDetectorClient } from 'meetcap-detector/renderer'

const detector = createDetectorClient()
detector.on('meeting-detected', (m) => console.log('joined', m.app, m.windowName))
detector.on('meeting-ended', () => console.log('left'))
```

### Renderer — React

```tsx
import { useMeetingDetector } from 'meetcap-detector/react'

function Banner() {
  const { meeting, isInMeeting } = useMeetingDetector()
  return isInMeeting ? <div>Recording {meeting!.app}?</div> : null
}
```

### Renderer — Vue

```vue
<script setup lang="ts">
import { useMeetingDetector } from 'meetcap-detector/vue'
const { meeting, isInMeeting } = useMeetingDetector()
</script>
```

## Custom rules

A rule matches by window title and/or process name. Strings are case-insensitive substrings; RegExps test directly; a function gets the raw string.

```ts
import { startDetector } from 'meetcap-detector/main'
import { presets } from 'meetcap-detector'

startDetector({
  rules: [
    ...presets, // keep the built-ins
    {
      id: 'mymeet',
      app: 'MyMeet',
      window: [/MyMeet 通话/, 'mymeet call'],
      process: [/mymeet/i],
    },
  ],
})
```

Replace the built-ins entirely by passing only your own rules. Use a function matcher for tricky cases: `window: (t) => t.startsWith('Call · ')`.

**Finding the right pattern:** run the demo's *List windows* button (or call `window.meetcap.listWindows()`) while in a meeting to see the exact window titles, and check process names with your OS task manager.

## `require` policy

- `'window'` (default) — a title match fires; process name attached as a cue. Good recall.
- `'window+process'` — title **and** a process of the same rule must match. Fewer false positives; needs the client running.

## Pure API (testable, no Electron)

`matchWindow`, `matchProcess`, `resolveMeeting`, `createDetectionState`, `toMatcher`, `presets` are exported from the package root and run anywhere.

## License

MIT
