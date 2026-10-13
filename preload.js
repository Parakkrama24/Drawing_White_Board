const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whiteboardAPI', {
  savePNG: (dataUrl) => ipcRenderer.invoke('save-png', dataUrl),
  savePDF: (payload) => ipcRenderer.invoke('save-pdf', payload)
});
