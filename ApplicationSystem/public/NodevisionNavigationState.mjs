// Nodevision/ApplicationSystem/public/NodevisionNavigationState.mjs
// Shared, notebook-relative navigation state for FileManager/GraphManager/search interactions.

import { normalizeNotebookRelativePath } from "/utils/notebookPath.mjs";

const VALID_INFO_PANEL_TYPES = new Set(["FileManager", "GraphManager"]);

function normalizeInfoPanelType(panelType) {
  const clean = String(panelType || "").trim();
  return VALID_INFO_PANEL_TYPES.has(clean) ? clean : null;
}

function normalizeDirectoryPath(directoryPath) {
  const clean = normalizeNotebookRelativePath(directoryPath || "");
  if (!clean || clean === "." || clean.toLowerCase() === "notebook") {
    return "";
  }
  return clean.replace(/\/+$/, "");
}

function attachStateMethods(state) {
  if (typeof state.setLastOpenedDirectory !== "function") {
    state.setLastOpenedDirectory = (directoryPath = "", panelType = null) => {
      state.lastOpenedDirectory = normalizeDirectoryPath(directoryPath);
      const cleanPanelType = normalizeInfoPanelType(panelType);
      if (cleanPanelType) {
        state.lastInfoPanelType = cleanPanelType;
      }
      return state.lastOpenedDirectory;
    };
  }

  if (typeof state.getSearchRoot !== "function") {
    state.getSearchRoot = () => normalizeDirectoryPath(state.lastOpenedDirectory);
  }

  if (typeof state.getLastInfoPanelType !== "function") {
    state.getLastInfoPanelType = () => normalizeInfoPanelType(state.lastInfoPanelType);
  }

  if (typeof state.setLastInfoPanelType !== "function") {
    state.setLastInfoPanelType = (panelType = null) => {
      const cleanPanelType = normalizeInfoPanelType(panelType);
      if (cleanPanelType) {
        state.lastInfoPanelType = cleanPanelType;
      }
      return state.lastInfoPanelType;
    };
  }

  if (typeof state.lastOpenedDirectory !== "string") {
    state.lastOpenedDirectory = "";
  }
  state.lastOpenedDirectory = normalizeDirectoryPath(state.lastOpenedDirectory);
  state.lastInfoPanelType = normalizeInfoPanelType(state.lastInfoPanelType);

  return state;
}

export function getNodevisionNavigationState() {
  const existing = window.NodevisionNavigationState;
  if (existing && typeof existing === "object") {
    return attachStateMethods(existing);
  }

  const created = {
    lastOpenedDirectory: "",
    lastInfoPanelType: null,
  };
  window.NodevisionNavigationState = attachStateMethods(created);
  return window.NodevisionNavigationState;
}

const NodevisionNavigationState = getNodevisionNavigationState();
export default NodevisionNavigationState;
