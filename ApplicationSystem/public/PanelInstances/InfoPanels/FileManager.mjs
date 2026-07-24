// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManager.mjs
// Sets up the File Manager panel and loads FileManagerCore.mjs
// Provides toolbar integration through panelCapabilities

import { updateToolbarState } from '/panels/createToolbar.mjs';
import { getNodevisionNavigationState } from '/NodevisionNavigationState.mjs';

const navigationState = getNodevisionNavigationState();

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

  panelElem.style.height = "100%";
  panelElem.style.minHeight = "0";
  panelElem.style.display = "flex";
  panelElem.style.flexDirection = "column";
  panelElem.style.width = "100%";
  panelElem.style.boxSizing = "border-box";

  panelElem.innerHTML = `
    <div class="file-manager" style="width:100%;height:100%;min-width:0;min-height:0;display:flex;flex-direction:column;box-sizing:border-box;">
      <h3 style="flex:0 0 auto;">File Manager</h3>
      <div id="loading" style="display:none;">Loading...</div>
      <div id="error" style="flex:0 0 auto;"></div>
      <ul id="file-list" class="file-list" style="flex:1 1 auto;min-height:0;overflow:auto;"></ul>
      <div id="fm-path" style="flex:0 0 auto;margin-top:8px; font-size:0.9em;"></div>
    </div>
  `;

  panelElem.addEventListener('focus', () => {
    updateToolbarState({ activePanelType: 'FileManager' });
    window.NodevisionState.activeActionHandler = window.handleFileManagerAction;
    navigationState.setLastInfoPanelType('FileManager');
  }, true);

  panelElem.addEventListener('click', () => {
    updateToolbarState({ activePanelType: 'FileManager' });
    window.NodevisionState.activeActionHandler = window.handleFileManagerAction;
    navigationState.setLastInfoPanelType('FileManager');
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
