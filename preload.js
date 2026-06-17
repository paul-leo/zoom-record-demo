// Preload — the only bridge between renderer and main under contextIsolation.
// Exposes a tiny, explicit surface. No `electron` leaks into the page.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('recorderBridge', {
  detectMeeting: () => ipcRenderer.invoke('detect-meeting'),
  detectProcess: () => ipcRenderer.invoke('detect-process'),
  listWindows: () => ipcRenderer.invoke('list-windows'),
  mediaAccess: () => ipcRenderer.invoke('media-access'),
  saveRecording: (buffer, filename) => ipcRenderer.invoke('save-recording', { buffer, filename }),
  // electron-audio-loopback IPC channels (registered by initMain in the main process)
  enableLoopbackAudio: () => ipcRenderer.invoke('enable-loopback-audio'),
  disableLoopbackAudio: () => ipcRenderer.invoke('disable-loopback-audio'),
})
