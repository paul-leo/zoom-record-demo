/**
 * Main-process recorder setup. Call once, at the top of your main entry,
 * BEFORE `app.whenReady()` — `initMain()` appends Chromium feature flags that
 * must be set before the app initializes:
 *
 *   import { initRecorderMain } from 'meetcap-recorder/main'
 *   initRecorderMain()
 *
 * It (1) injects the macOS loopback feature flags + registers the
 * enable/disable-loopback-audio handlers (via electron-audio-loopback), and
 * (2) registers the save-recording and media-access IPC handlers.
 */
import { app, ipcMain, shell, systemPreferences } from 'electron'
import { initMain } from 'electron-audio-loopback'
import { IPC, type PermissionStatus } from 'meetcap-core'
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface InitRecorderMainOptions {
  /** Directory for saved recordings. Default `<downloads>/meetcap`. */
  saveDir?: string
  /** Reveal the saved file in the OS file manager. Default `true`. */
  revealInFolder?: boolean
}

export function initRecorderMain(options: InitRecorderMainOptions = {}): void {
  // Inject macOS loopback flags + register enable/disable-loopback-audio IPC.
  initMain()

  const revealInFolder = options.revealInFolder ?? true

  ipcMain.handle(
    IPC.saveRecording,
    async (_evt, { buffer, filename }: { buffer: ArrayBuffer; filename: string }) => {
      const dir = options.saveDir ?? path.join(app.getPath('downloads'), 'meetcap')
      fs.mkdirSync(dir, { recursive: true })
      const filePath = path.join(dir, filename)
      fs.writeFileSync(filePath, Buffer.from(buffer))
      if (revealInFolder) shell.showItemInFolder(filePath)
      return filePath
    },
  )

  ipcMain.handle(IPC.mediaAccess, (): PermissionStatus => {
    if (process.platform !== 'darwin') {
      return { platform: process.platform, screen: 'n/a', microphone: 'n/a' }
    }
    return {
      platform: 'darwin',
      screen: systemPreferences.getMediaAccessStatus('screen'),
      microphone: systemPreferences.getMediaAccessStatus('microphone'),
    }
  })
}
