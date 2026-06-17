# meetcap — project context (handoff)

Onboarding for an agent picking up development. Auto-loaded by Kiro.

## What this is

`meetcap` — an open-source toolkit to **detect a meeting and record both sides of
the audio** (mic + system loopback) in any Electron app. Monorepo of publishable
TypeScript packages. Repo: `git@github.com:paul-leo/zoom-record-demo.git` (branch `main`).

## Repo layout

```
packages/
  core/                meetcap-core              shared types, IPC contract, window.meetcap preload bridge
  detector/            meetcap-detector          meeting detection (window title + process), /main + /renderer + pure rule engine
  recorder-main/       meetcap-recorder-main      loopback flags + streaming save + manifest + media-access (main process)
  recorder-renderer/   meetcap-recorder-renderer  capture/mix/MediaRecorder, chunk events, React/Vue hooks (renderer)
examples/
  electron-demo/       runnable end-to-end demo (esbuild-bundled renderer), instrumented with harness-fe solo
docs/                  recording-lifecycle.md (the integration guide), debugging.md, assets/
```

## Commands

```bash
pnpm install
pnpm build        # turbo: tsc per package + esbuild demo bundle
pnpm test         # vitest — rule engine, manifest, mime/filename (24 tests)
pnpm typecheck
pnpm demo         # build + launch examples/electron-demo
```

## How it works (one paragraph)

Detection runs in the **main** process (`desktopCapturer` + `ps-list`), broadcasts
`meeting-detected`/`meeting-ended` to the renderer. Recording captures in the
**renderer** (`getUserMedia` mic + `getDisplayMedia` loopback via
`electron-audio-loopback`, mixed with Web Audio) and **streams chunk-by-chunk to
disk** through `window.meetcap` IPC — flat memory, crash-safe. A sidecar manifest
(`<key>.meetcap.json`) ties multiple segments into one logical recording for
**manual crash-resume** (`listInterruptedRecordings()` + `start(meeting,{resumeKey})`).
Upload is supported both whole-file (`complete.filePath`) and segmented (`chunk` events).
Full detail: `docs/recording-lifecycle.md`.

## Conventions (important)

- **Git identity is `meetcap <meetcap@users.noreply.github.com>`** — never commit
  with a tanka/personal email. It's pinned in the repo's local git config.
- Do not push company-internal data; this is a personal open-source project.
- Module output is **CommonJS** (Electron-main friendly); `ps-list` is ESM → dynamic `import()`.
- Each package: own `tsconfig.json` extending `../../tsconfig.base.json`, `tsc` build,
  subpath `exports`, `publishConfig.access=public`. Mirrors harness-fe conventions.
- Release: changesets — `pnpm changeset` in a PR; CI (`.github/workflows/release.yml`)
  opens a Version PR, merging it publishes (OIDC + NPM_TOKEN). Nothing published to npm yet.
- The demo is instrumented with harness-fe in **solo** mode (local gateway 47620,
  tokenless) for agent debugging — see `docs/debugging.md`.

## Current state

Built + green (build/test/typecheck). Done: monorepo, detection w/ presets +
custom rules, streaming recording, segmented crash-resume, chunk/segmented upload,
pre-flight permissions, harness-fe solo debugging, CI/changesets, docs.

## Pending / next

1. **Interactive E2E** (needs a human): `pnpm demo` → Record now → speak → Stop
   (verify chunk log + saved file/segments); force-quit mid-record → relaunch →
   Resume produces a 2nd segment under the same recordingKey.
2. **Demo walkthrough recording** for `docs/assets/demo-walkthrough.gif` (capture via
   harness-fe replay at http://127.0.0.1:47620/console, then embed in recording-lifecycle.md).
3. **npm publish** (first release) — when ready, via changesets.
4. Browser-based meeting detection is intentionally out of scope (recording works; detection doesn't).
