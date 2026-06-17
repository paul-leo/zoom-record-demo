# meetcap-recorder-renderer

Renderer-process half of [meetcap recording](https://github.com/paul-leo/zoom-record-demo). Records **both sides** of a call — your microphone *and* the other party's voice (system / loopback audio) — mixes them, and saves to disk.

```bash
npm install meetcap-recorder-renderer meetcap-core
```

Pair it with [`meetcap-recorder-main`](../recorder-main) (which injects the macOS loopback flags and handles disk writes) and the [`meetcap-core/preload`](../core) bridge.

### Framework-agnostic

```ts
import { createRecorder } from 'meetcap-recorder-renderer'

const rec = createRecorder()
rec.on('complete', async (result) => {
  console.log(result.durationMs, 'ms · systemAudio:', result.hasSystemAudio)
  await rec.save(result) // → <downloads>/meetcap/meetcap-Zoom-….webm
})
await rec.start(meeting) // meeting is optional metadata for the filename
// …later: rec.stop()
```

### React

```tsx
import { useRecorder } from 'meetcap-recorder-renderer/react'
const { start, stop, state, lastResult, save } = useRecorder()
```

### Vue

```vue
<script setup lang="ts">
import { useRecorder } from 'meetcap-recorder-renderer/vue'
const { start, stop, state, lastResult, save } = useRecorder()
</script>
```

## Platform notes

- **macOS 13.2+** — loopback works via the flags injected by `meetcap-recorder-main`. Older macOS may return an empty system track; the recorder records mic-only and sets `hasSystemAudio: false` instead of failing.
- **Windows 10+** — WASAPI loopback. **Linux** — PulseAudio.

## Pure API (testable, no Electron)

`pickMimeType()` and `buildFilename(meeting, date, prefix)` are exported from the root.

## License

MIT
