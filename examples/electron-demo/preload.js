// Preload — exposes the full meetcap IPC surface on window.meetcap in one call.
const { contextBridge, ipcRenderer } = require('electron')
const { exposeMeetcapBridge } = require('meetcap-core/preload')

exposeMeetcapBridge(contextBridge, ipcRenderer)
