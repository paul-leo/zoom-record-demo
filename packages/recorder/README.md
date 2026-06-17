# meetcap-recorder

Record **both sides** of a call in Electron — your microphone *and* the other party's voice (system / loopback audio) — and save to disk. Real macOS loopback via [`electron-audio-loopback`](https://github.com/alectrocute/electron-audio-loopback) (injects the `MacLoopbackAudioForScreenShare` / `MacSckSystemAudioLoopbackOverride` flags so the system track actually carries sound).

```bash
npm install meetcap-recorder meetcap-core
```

## How it splits across processes

Capture (`getUserMedia`/`getDisplayMedia`/`MediaRecorder`) is **renderer-only**; flag injection + disk writes are **main-only**.

### Main process — call BEFORE `app.whenReady()`

```ts
import { initRecorderMain } from 'meetcap-recorder/main'

initRecorderMain({ saveDir: undefined /* default <downloads>/meetcap */ })
```

### Preload

```ts
import { contextBridge, ipcRenderer } from 'electron'
import { exposeMeetcapBridge } from 'meetcap-core/preload'
exposeMeetcapBridge(contextBridge, ipcRenderer)
```

### Renderer — framework-agnostic

```ts
import { createRecorder } from 'meetcap-recorder/renderer'

const rec = createRecorder()
rec.on('complete', async (result) => {
  console.log(result.durationMs, 'ms · systemAudio:', result.hasSystemAudio)
  const path = await rec.save(result) // → <downloads>/meetcap/meetcap-Zoom-….webm
})
await rec.start(meeting) // meeting is optional metadata for the filename
// …later
rec.stop()
```

### Renderer — React

```tsx
import { useRecorder } from 'meetcap-recorder/react'

function Controls() {
  const { start, stop, state, lastResult, save } = useRecorder()
  // call save(lastResult) once lastResult is set
}
```

### Renderer — Vue

```vue
<script setup lang="ts">
import { useRecorder } from 'meetcap-recorder/vue'
const { start, stop, state, lastResult, save } = useRecorder()
</script>
```

## Platform notes

- **macOS 13.2+** — loopback works via the injected feature flags. Older macOS may return an empty system-audio track; the recorder then records mic-only and sets `hasSystemAudio: false` instead of failing.
- **Windows 10+** — loopback via WASAPI is generally cooperative.
- **Linux** — via PulseAudio.

Grant **Screen Recording** + **Microphone** permission (macOS) before recording. Query status with `window.meetcap.mediaAccess()`.

## Pure API (testable, no Electron)

`pickMimeType()` and `buildFilename(meeting, date, prefix)` are exported from the root.

## License

MIT
