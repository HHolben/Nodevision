const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nodevisionElectron', {
  exportHtmlToPdf: (payload) => ipcRenderer.invoke('nodevision:export-html-to-pdf', payload),
});
