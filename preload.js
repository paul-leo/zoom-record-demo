// Preload — the only bridge between renderer and main under contextIsolation.
// Exposes a tiny, explicit surface. No `electron` leaks into the page.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('recorderBridge', {
  detectMeeting: () => ipcRenderer.invoke('detect-meeting'),
  listWindows: () => ipcRenderer.invoke('list-windows'),
  getScreenSource: () => ipcRenderer.invoke('get-screen-source'),
  mediaAccess: () => ipcRenderer.invoke('media-access'),
})
