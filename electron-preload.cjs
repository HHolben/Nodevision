const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nodevisionElectron', {
  exportHtmlToPdf: (payload) => ipcRenderer.invoke('nodevision:export-html-to-pdf', payload),
  readFileClipboardSummary: () => ipcRenderer.invoke('nodevision:read-file-clipboard-summary'),
  writeNotebookFilesToClipboard: (payload) => ipcRenderer.invoke('nodevision:write-notebook-files-to-clipboard', payload),
  pasteExternalFilesFromClipboard: (payload) => ipcRenderer.invoke('nodevision:paste-external-files-from-clipboard', payload),
  startNotebookFileDrag: (payload) => ipcRenderer.send('nodevision:start-file-drag', payload),
});
