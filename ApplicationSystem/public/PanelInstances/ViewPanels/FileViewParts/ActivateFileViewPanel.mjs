// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/ActivateFileViewPanel.mjs
// This module implements activate File View Panel behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { fileViewActivePanelElement, setFileViewStatus } from "./GetViewPanelElement.mjs";
import { claimFileViewHost, normalizeNotebookPath } from "./ShowGraphLinkInFileView.mjs";
import { rememberSelectionFollowingFileView, FileViewModuleState } from "./CancelScheduledSelectedFileViewRender.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

// Activate File View Panel operations.
export function activateFileViewPanel(cell = getFileViewCell()) {
  if (!cell) return;
  window.activeCell = cell;
  window.activePanel = "FileView";
  window.activePanelClass = cell.dataset.panelClass || "ViewPanel";
  window.__nvActivePanelElement = fileViewActivePanelElement(cell);
  if (window.NodevisionState) {
    window.NodevisionState.activePanelType = window.activePanelClass;
  }
  if (window.highlightActiveCell) {
    window.highlightActiveCell(cell);
  }
  window.dispatchEvent(new CustomEvent("activePanelChanged", {
    detail: {
      panel: "FileView",
      cell,
      panelClass: window.activePanelClass
    }
  }));
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: {
      heading: "File View",
      force: false,
      toggle: false
    }
  }));
}

export function activateFileViewHost(host) {
  const viewDiv = host?.matches?.("[data-nv-file-view-root=\"true\"]") ? host : host?.querySelector?.("[data-nv-file-view-root=\"true\"], #element-view");
  if (!claimFileViewHost(viewDiv)) return false;
  rememberSelectionFollowingFileView(viewDiv);
  activateFileViewPanel(viewDiv.closest?.(".panel-cell") || getFileViewCell());
  const path = normalizeNotebookPath(viewDiv.dataset.nvFileViewRenderedPath || viewDiv.dataset.currentFilePath || viewDiv.closest(".nv-panel-tab-content")?.dataset?.currentFilePath || viewDiv.closest(".panel-cell")?.dataset?.currentFilePath || "");
  if (path) {
    const selectedPath = normalizeNotebookPath(viewDiv.dataset.nvFileViewSelectionPath || path);
    const selectedIsDirectory = viewDiv.dataset.nvFileViewSelectionIsDirectory === "true";
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.selectedFile = selectedPath;
    window.NodevisionState.selectedFileIsDirectory = selectedIsDirectory;
    window.NodevisionState.activeFileViewPath = path;
    window.currentActiveFilePath = path;
    try {
      updateToolbarState({
        currentMode: "Default",
        selectedFile: selectedPath,
        activeFileViewPath: path,
        liveFileViewerEnabled: FileViewModuleState.liveFileViewerEnabled
      });
    } catch (err) {
      console.warn("Failed to update toolbar state for FileView tab activation:", err);
    }
    setFileViewStatus("File Viewer", path);
  }
  return true;
}

export function enableViewActivation(viewDiv) {
  if (!viewDiv) return;
  const handler = () => activateFileViewHost(viewDiv);
  viewDiv.addEventListener("pointerdown", handler, {
    capture: true
  });
  viewDiv.addEventListener("mousedown", handler, {
    capture: true
  });
  viewDiv.addEventListener("click", handler, {
    capture: true
  });
  viewDiv.addEventListener("focusin", handler, {
    capture: true
  });
}

export function getFileViewCell() {
  if (FileViewModuleState.viewDivRef) {
    const cell = FileViewModuleState.viewDivRef.closest?.(".panel-cell");
    if (cell && document.body.contains(cell)) {
      return cell;
    }
  }
  return document.querySelector(`[data-id="FileView"]`);
}

export function fileViewRootFromTarget(target) {
  if (!target) return null;
  if (target.matches?.("[data-nv-file-view-root=\"true\"], #element-view")) return target;
  return target.closest?.("[data-nv-file-view-root=\"true\"], #element-view") || null;
}

export function fileViewRootFromFrameWindow(frameWindow) {
  if (!frameWindow) return null;
  const roots = document.querySelectorAll("[data-nv-file-view-root=\"true\"], #element-view");
  for (const root of roots) {
    for (const iframe of root.querySelectorAll?.("iframe") || []) {
      try {
        if (iframe.contentWindow === frameWindow) return root;
      } catch {
        // Cross-origin frame handles are still safe to compare when available, but access can fail.
      }
    }
  }
  return null;
}

export function fileViewIframeDebugEnabled() {
  try {
    return Boolean(window.__nvFileViewIframeDebug || window.NodevisionState?.debugFileViewIframes || window.localStorage?.getItem?.("nodevision.fileView.iframeDebug") === "true");
  } catch {
    return false;
  }
}

export function describeFileViewElement(element) {
  if (!element) return null;
  return {
    tag: element.tagName || element.nodeName || "",
    id: element.id || "",
    className: typeof element.className === "string" ? element.className : "",
    panelId: element.dataset?.id || element.dataset?.panelId || "",
    panelClass: element.dataset?.panelClass || "",
    tabId: element.dataset?.nvPanelTabId || element.closest?.(".nv-panel-tab-content")?.dataset?.nvPanelTabId || "",
    filePath: element.dataset?.nvFileViewRenderedPath || element.dataset?.currentFilePath || "",
    connected: Boolean(element.isConnected)
  };
}
