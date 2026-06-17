# meetcap-core

Shared TypeScript types and the IPC contract for [`meetcap-detector`](../detector) and [`meetcap-recorder`](../recorder). Dependency-free — safe to import from any process.

## Install

```bash
npm install meetcap-core
```

## What's inside

- **Types** — `MeetingInfo`, `MeetingRule`, `DetectionResult`, `DetectorEvent`, `RecordingResult`, `PermissionStatus`, `MeetcapBridge`.
- **`IPC`** — the single source of truth for channel names shared by main and renderer.
- **`exposeMeetcapBridge`** (`meetcap-core/preload`) — wire the whole IPC surface onto `window.meetcap` in one call.

## Preload usage

```ts
// preload.ts
import { contextBridge, ipcRenderer } from 'electron'
import { exposeMeetcapBridge } from 'meetcap-core/preload'

exposeMeetcapBridge(contextBridge, ipcRenderer) // → window.meetcap
```

`window.meetcap` then exposes `detectOnce`, `onDetectorEvent`, `listWindows`, `mediaAccess`, `saveRecording`, `enableLoopbackAudio`, `disableLoopbackAudio` — consumed by the renderer halves of the detector/recorder packages.

## License

MIT
