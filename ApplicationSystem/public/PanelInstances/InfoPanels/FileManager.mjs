// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManager.mjs
// This module initializes the File Manager panel, loads the FileManagerCore implementation, and exposes toolbar integration through panel capabilities.

import { bindFileManagerFollowSelection } from './FileManagerFollowSelection.mjs';
import { updateToolbarState } from '/panels/createToolbar.mjs';
import { getNodevisionNavigationState } from '/NodevisionNavigationState.mjs';

import { installFileManagerZoom } from './FileManagerZoom.mjs';

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
  panelElem.cleanup?.();
  let disposed = false, cleanupFollow = null;
  console.log("Initializing FileManager panel...", panelVars);

  panelElem.style.height = "100%";
  panelElem.style.minHeight = "0";
  panelElem.style.display = "flex";
  panelElem.style.flexDirection = "column";
  panelElem.style.width = "100%";
  panelElem.style.boxSizing = "border-box";

  panelElem.innerHTML = `
    <div class="file-manager">
      <h3>File Manager</h3>
      <div id="loading" style="display:none;">Loading...</div>
      <div id="error"></div>
      <ul id="file-list" class="file-list"></ul>
      <div id="fm-path"></div>
    </div>
  `;

  const cleanupZoom = installFileManagerZoom(panelElem);
  const handleFocus = () => {
    updateToolbarState({ activePanelType: 'FileManager' });
    window.NodevisionState.activeActionHandler = window.handleFileManagerAction;
    navigationState.setLastInfoPanelType('FileManager');
    window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
      detail: { heading: "File Manager", force: false, toggle: false }
    }));
  };

  panelElem.addEventListener('focus', handleFocus, true);
  panelElem.addEventListener('click', handleFocus);

  panelElem.cleanup = () => {
    disposed = true; cleanupFollow?.(); cleanupZoom();
    panelElem.removeEventListener('focus', handleFocus, true);
    panelElem.removeEventListener('click', handleFocus);
  };
  import("/PanelInstances/InfoPanels/FileManagerCore.mjs")
    .then(async mod => {
      if (disposed) return;
      await mod.initFileView(panelVars.currentDirectory || '');
      if (!disposed) cleanupFollow = bindFileManagerFollowSelection(panelElem, { ...mod, highlight: mod.markSelectedFileItemVisualOnly });
    })
    .catch(err => {
      console.error("Failed to load FileManagerCore.mjs:", err);
      const errElem = panelElem.querySelector("#error");
      if (errElem) errElem.textContent = "Failed to initialize File Manager.";
    });
}
