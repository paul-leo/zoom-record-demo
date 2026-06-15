// Electron main process.
//
// Mirrors a production-style hardened config on purpose:
//   contextIsolation: true, nodeIntegration: false, sandbox: false
// so that whatever we prove here transfers to a real app with the same config.
//
// Consequence of that config: the renderer CANNOT `require('electron')`, and
// `desktopCapturer` is main-process only. So window detection + screen-source
// enumeration live here and are exposed to the renderer over IPC (see preload.js).

const { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences, session } = require('electron')
const path = require('path')

// Window-title patterns that indicate an active meeting. Same idea as the prototype.
const MEETING_PATTERNS = [
  /zoom meeting/i,
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

  // Electron 38: getUserMedia({chromeMediaSource:'desktop'}) goes through this handler.
  // Returning the primary screen lets the renderer capture loopback/system audio.
  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
        callback({ video: sources[0], audio: 'loopback' })
      })
    },
    { useSystemPicker: false }
  )

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
