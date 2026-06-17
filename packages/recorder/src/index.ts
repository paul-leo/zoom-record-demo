/**
 * meetcap-recorder — record mic + system (loopback) audio in Electron and save
 * to disk.
 *
 * This root entry exports the pure helpers (testable, no Electron). The Electron
 * setup lives in `meetcap-recorder/main`, the capture logic in
 * `meetcap-recorder/renderer`, and framework hooks in `meetcap-recorder/react`
 * and `meetcap-recorder/vue`.
 */
export { pickMimeType, buildFilename } from './util'
export type { RecordingResult, PermissionStatus } from 'meetcap-core'
