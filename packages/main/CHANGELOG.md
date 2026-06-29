# meetcap-main

## 0.1.2

### Patch Changes

- 69faff8: fix(detector): skip desktopCapturer when policy is 'process', default to 'process'

  When `require` is `'process'`, `listWindowSources()` is now skipped entirely so
  `desktopCapturer.getSources` is never called — eliminating the macOS Sequoia
  SCContentSharingPicker permission dialog for process-only detection.

  Default policy changed from `'either'` to `'process'` to avoid the permission
  prompt out of the box.

## 0.1.1

### Patch Changes

- 3fb51b6: Fix Zoom false positive: `caphost` is Zoom Workplace's capture/screenshot helper that runs while the app is merely open (e.g. the login screen), not a meeting. Removed it from the Zoom rule's `meetingProcess` so being signed in no longer reads as "in a meeting". The genuine meeting-only helpers `CptHost` and `aomhost` (spawned on join, gone on leave) remain.

## 0.1.0

### Minor Changes

- 54598c6: First release of meetcap — detect a meeting and record both sides of the audio in any Electron app.

  - **Detection** (`meetcap-main`): poll window titles + processes against built-in rules (Zoom / Teams / Tencent / Lark) or custom ones. Selectable `require` modes — `'either'` (default), `'process'`, `'window'`, `'window+process'` — plus a `meetingProcess` rule field so a minimized/hidden meeting window no longer reads as "ended".
  - **Recording** (`meetcap-main` setup + `meetcap-renderer` capture): mic + system (loopback) audio, mixed and streamed to disk chunk-by-chunk (flat memory, crash-safe partial file), with a sidecar manifest for segments / resume. `pause()` / `resume()` hold within the same file; `durationMs` excludes paused time.
  - **Renderer** (`meetcap-renderer`): framework-agnostic recorder + detector client, plus React (`/react`) and Vue (`/vue`) hooks.
  - **Core** (`meetcap-core`): shared types, the IPC contract, and the `window.meetcap` preload bridge.

### Patch Changes

- Updated dependencies [54598c6]
  - meetcap-core@0.1.0
