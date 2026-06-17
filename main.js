// Electron main process.
//
// Mirrors a production-style hardened config on purpose:
//   contextIsolation: true, nodeIntegration: false, sandbox: false
// so that whatever we prove here transfers to a real app with the same config.
//
// Consequence of that config: the renderer CANNOT `require('electron')`, and
// `desktopCapturer` is main-process only. So window detection + screen-source
// enumeration live here and are exposed to the renderer over IPC (see preload.js).

const { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { initMain } = require('electron-audio-loopback')

// Inject the Chromium feature flags that make system-audio loopback actually
// produce sound on macOS 13+ (MacLoopbackAudioForScreenShare +
// MacSckSystemAudioLoopbackOverride) and register the enable/disable-loopback-audio
// IPC handlers. MUST run before app is ready. Without this the loopback track
// exists but is silent on macOS — the platform limitation noted in the README.
initMain()

// Window-title patterns that indicate an active meeting. Same idea as the prototype.
const MEETING_PATTERNS = [
  /zoom\s*meeting/i,
  /zoom\s*会议/i,
  /google meet/i,
  /microsoft teams.*call/i,
  /腾讯会议.*通话/,
  /飞书.*会议/,
  /lark.*meeting/i,
  // loosened during the lab so we can trigger with any window for smoke testing:
  // /zoom/i, /meet/i,
]

function parseAppName(name) {
  if (/zoom/i.test(name)) return 'Zoom'
  if (/meet/i.test(name)) return 'Google Meet'
  if (/teams/i.test(name)) return 'Microsoft Teams'
  if (/腾讯会议/.test(name)) return '腾讯会议'
  if (/飞书|lark/i.test(name)) return '飞书'
  return name
}

// ── IPC: detection (main-process desktopCapturer) ────────────────────────────
ipcMain.handle('detect-meeting', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 1, height: 1 },
  })
  for (const s of sources) {
    if (MEETING_PATTERNS.some((p) => p.test(s.name))) {
      return { app: parseAppName(s.name), windowName: s.name, sourceId: s.id }
    }
  }
  return null
})

// ── IPC: is a meeting app process running? (robust, no i18n / no title needed) ─
// Process name is the steadier signal (Meetily relies on it): a Zoom *meeting*
// title can be localized ("Zoom会议"), but the process name is stable. We use it
// as a cross-check alongside the window-title detection above.
const MEETING_PROCESS_PATTERNS = [/zoom\.us/i, /zoom/i, /CptHost/i, /Microsoft Teams/i, /Google Chrome Helper/i, /飞书|lark/i, /WeMeet|wemeetapp|腾讯会议/i]
ipcMain.handle('detect-process', async () => {
  const { default: psList } = await import('ps-list')
  const procs = await psList()
  const hit = procs.find((p) => MEETING_PROCESS_PATTERNS.some((re) => re.test(p.name)))
  return hit ? { name: hit.name, pid: hit.pid } : null
})

// ── IPC: enumerate windows (debug — see exactly what titles we can read) ──────
ipcMain.handle('list-windows', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 1, height: 1 },
  })
  return sources.map((s) => ({ id: s.id, name: s.name }))
})

// ── IPC: pick a screen source id (needed for system/loopback audio capture) ──
ipcMain.handle('get-screen-source', async () => {
  const screens = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1, height: 1 },
  })
  if (!screens.length) return null
  return { id: screens[0].id, name: screens[0].name }
})

// ── IPC: report macOS screen-recording permission status ─────────────────────
ipcMain.handle('media-access', () => {
  if (process.platform !== 'darwin') return { platform: process.platform, screen: 'n/a', microphone: 'n/a' }
  return {
    platform: 'darwin',
    screen: systemPreferences.getMediaAccessStatus('screen'),
    microphone: systemPreferences.getMediaAccessStatus('microphone'),
  }
})

// ── IPC: persist a finished recording to disk ────────────────────────────────
// Renderer hands over the raw bytes (ArrayBuffer) + a suggested filename; we
// write them under ~/Downloads/meeting-capture and return the absolute path.
ipcMain.handle('save-recording', async (_evt, { buffer, filename }) => {
  const dir = path.join(app.getPath('downloads'), 'meeting-capture')
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, filename)
  fs.writeFileSync(filePath, Buffer.from(buffer))
  shell.showItemInFolder(filePath)
  return filePath
})

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 720,
    webPreferences: {
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[render-process-gone]', JSON.stringify(details))
  })
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.error(`[renderer:${level}] ${message} (${sourceId}:${line})`)
  })

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
