// Nodevision/public/PanelInstances/InfoPanels/FileManager.mjs
// Sets up the File Manager panel and loads FileManagerCore.mjs
// Provides toolbar integration through panelCapabilities

import { updateToolbarState } from '/panels/createToolbar.mjs';

export const panelCapabilities = {
  supportedActions: [
    'NewFile', 'NewDirectory', 'DeleteFile', 'renameFile',
    'copyFile', 'cutFile', 'pasteFile'
  ],
  panelType: 'FileManager'
};

export function getActionHandler() {
  return window.handleFileManagerAction;
}

export function setupPanel(panelElem, panelVars = {}) {
  console.log("Initializing FileManager panel...", panelVars);

  panelElem.innerHTML = `
    <div class="file-manager">
      <h3>File Manager</h3>
      <div id="loading" style="display:none;">Loading...</div>
      <div id="error" style="color:red;"></div>
      <ul id="file-list" class="file-list"></ul>
      <div id="fm-path" style="margin-top:8px; font-size:0.9em; color:#555;"></div>
    </div>
  `;

  panelElem.addEventListener('focus', () => {
    updateToolbarState({ activePanelType: 'FileManager' });
    window.NodevisionState.activeActionHandler = window.handleFileManagerAction;
  }, true);

  panelElem.addEventListener('click', () => {
    updateToolbarState({ activePanelType: 'FileManager' });
    window.NodevisionState.activeActionHandler = window.handleFileManagerAction;
  });

  import("/PanelInstances/InfoPanels/FileManagerCore.mjs")
    .then(mod => {
      mod.initFileView(panelVars.currentDirectory || '');
    })
    .catch(err => {
      console.error("Failed to load FileManagerCore.mjs:", err);
      const errElem = panelElem.querySelector("#error");
      if (errElem) errElem.textContent = "Failed to initialize File Manager.";
    });
}
