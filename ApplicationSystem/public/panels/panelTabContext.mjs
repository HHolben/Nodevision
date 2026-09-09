// Nodevision/ApplicationSystem/public/panels/panelTabContext.mjs
// This module reapplies Nodevision's active panel and toolbar context when a workspace panel tab becomes selected. It bridges the new tab session model to older viewer and editor modules that still use singleton globals.

import { setStatus, setWordCountVisibility } from "/StatusBar.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

function normalizePath(value = "") {
  return String(value || "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/, "");
}

function tabResourcePath(tab = {}) {
  return normalizePath(tab.resourcePath || tab.panelVars?.filePath || tab.contentElement?.dataset?.currentFilePath || "");
}

export function removeDuplicateActiveIds(cell, tab) {
  const fixedIds = ["element-view", "graphical-editor"];
  for (const id of fixedIds) {
    document.querySelectorAll(`#${id}`).forEach((node) => {
      if (!tab.contentElement?.contains?.(node)) {
        node.dataset.nvInactiveElementId = id;
        node.removeAttribute("id");
      }
    });
  }
  cell?.querySelectorAll?.(".nv-panel-tab-content[data-id]").forEach((node) => {
    if (node !== tab.contentElement) {
      node.dataset.nvInactiveDataId = node.dataset.id || "";
      delete node.dataset.id;
    }
  });
  if (tab.contentElement?.dataset?.nvInactiveDataId) {
    tab.contentElement.dataset.id = tab.contentElement.dataset.nvInactiveDataId;
    delete tab.contentElement.dataset.nvInactiveDataId;
  }
}

function setCellContext(cell, tab) {
  if (!cell || !tab) return;
  cell.dataset.id = tab.panelType;
  cell.dataset.panelId = tab.panelType;
  cell.dataset.panelClass = tab.panelClass || "InfoPanel";
  cell.dataset.currentPanelTabId = tab.tabId;
  const path = tabResourcePath(tab);
  if (path) cell.dataset.currentFilePath = path;
  else delete cell.dataset.currentFilePath;
  window.activeCell = cell;
  window.activePanel = tab.panelType;
  window.activePanelClass = tab.panelClass || "InfoPanel";
  window.__nvActivePanelElement = cell.querySelector?.(".panel") || null;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = window.activePanelClass;
}

function applyFileViewContext(tab) {
  const host = tab.contentElement?.querySelector?.("[data-nv-file-view-root], #element-view");
  window.__nvActivateFileViewHost?.(host);
  const path = tabResourcePath(tab);
  if (!path) return;
  window.currentActiveFilePath = path;
  window.NodevisionState.activeFileViewPath = path;
  window.NodevisionState.selectedFile = path;
  window.NodevisionState.currentMode = "Default";
  updateToolbarState({ currentMode: "Default", selectedFile: path, activeFileViewPath: path });
  setStatus("File Viewer", path);
}

function applyGraphicalEditorContext(tab) {
  const host = tab.contentElement?.querySelector?.("[data-nv-graphical-editor-root], #graphical-editor");
  window.__nvActivateGraphicalEditorHost?.(host);
  const path = tabResourcePath(tab);
  window.currentActiveFilePath = path || null;
  window.filePath = path || null;
  window.NodevisionState.currentMode = "GraphicalEditing";
  window.NodevisionState.selectedFile = path || null;
  window.NodevisionState.selectedFileIsDirectory = false;
  window.NodevisionState.activeEditorFilePath = path || null;
  updateToolbarState({ currentMode: "GraphicalEditing", selectedFile: path || null, activeEditorFilePath: path || null });
  const svgContext = host?.__nvSvgEditorContext || tab.contentElement?.__nvSvgEditorContext || tab.contentElement?.querySelector?.("[data-nv-graphical-editor-root]")?.__nvSvgEditorContext || null;
  if (svgContext?.kind === "svg" && typeof svgContext.activate === "function" && svgContext.activate()) {
    return;
  }
  const htmlContext = host?.__nvHtmlEditorContext || tab.contentElement?.__nvHtmlEditorContext || null;
  if (htmlContext?.kind === "html" && typeof htmlContext.activate === "function") {
    htmlContext.activate();
  }
}

function applyCodeEditorContext(tab) {
  const activated = window.__nvActivateCodeEditorHost?.(tab.contentElement);
  const path = tabResourcePath(tab);
  if (path) {
    window.currentActiveFilePath = path;
    window.filePath = path;
    window.__nvCodeEditorActivePath = path;
  }
  setWordCountVisibility(false);
  window.NodevisionState.currentMode = "CodeEditing";
  window.NodevisionState.selectedFile = path || null;
  window.NodevisionState.selectedFileIsDirectory = false;
  window.NodevisionState.activeEditorFilePath = path || null;
  updateToolbarState({ currentMode: "CodeEditing", selectedFile: path || null, activeEditorFilePath: path || null });
  return activated;
}

function applyGenericContext(tab) {
  const path = tabResourcePath(tab);
  if (path) {
    window.currentActiveFilePath = path;
    window.NodevisionState.selectedFile = path;
  }
  updateToolbarState({ selectedFile: path || window.NodevisionState.selectedFile || null });
}

export function applyPanelTabContext(cell, tab, { announce = true } = {}) {
  if (!cell || !tab) return null;
  removeDuplicateActiveIds(cell, tab);
  setCellContext(cell, tab);
  const type = String(tab.panelType || "");
  if (type === "FileView") applyFileViewContext(tab);
  else if (type === "GraphicalEditor") applyGraphicalEditorContext(tab);
  else if (type === "CodeEditor" || type === "CodeEditorPanel") applyCodeEditorContext(tab);
  else applyGenericContext(tab);
  window.highlightActiveCell?.(cell);
  if (announce) setStatus("Active tab", tab.displayName || type);
  window.dispatchEvent(new CustomEvent("activePanelChanged", {
    detail: { panel: type, cell, panelClass: tab.panelClass || "InfoPanel", tab },
  }));
  window.dispatchEvent(new CustomEvent("nv-panel-tab-activated", { detail: { cell, tab } }));
  return tab;
}
