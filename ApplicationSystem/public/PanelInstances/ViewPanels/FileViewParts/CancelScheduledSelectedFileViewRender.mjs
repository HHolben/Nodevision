// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/CancelScheduledSelectedFileViewRender.mjs
// This module implements cancel Scheduled Selected File View Render behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { getNodevisionNavigationState } from "/NodevisionNavigationState.mjs";
import { incrementPerformanceCounter } from "/PerformanceDiagnostics.mjs";
import { createNotebookReference, serializeNodevisionReference, referenceToApiPath } from "/NodevisionReference.mjs";
import { getViewPanelElement } from "./GetViewPanelElement.mjs";
import { updateViewPanel } from "./UpdateViewPanel.mjs";
import { claimFileViewHost, activeFileViewRoot } from "./ShowGraphLinkInFileView.mjs";
import { refreshPanelTabMetadata } from "/panels/panelTabMetadata.mjs";
import { renderPanelTabs } from "/panels/panelTabs.mjs";

// Cancel Scheduled Selected File View Render operations.
export const FileViewModuleState = {};

export const LIVE_FILE_VIEWER_STORAGE_KEY = "nodevision.fileView.liveViewerEnabled.v1";

export const loadedViewerModuleUrls = new Set();

export const navigationState = getNodevisionNavigationState();

export const SELECTED_FILE_VIEW_RENDER_DELAY_MS = 40;

export function cancelScheduledSelectedFileViewRender() {
  if (FileViewModuleState.selectedFileViewRenderTimer) {
    window.clearTimeout(FileViewModuleState.selectedFileViewRenderTimer);
    FileViewModuleState.selectedFileViewRenderTimer = null;
    incrementPerformanceCounter("FileView.selectedRenderTimersCleared");
  }
  FileViewModuleState.selectedFileViewRenderToken += 1;
}

export function scheduleSelectedFileViewRender(path, options = {}) {
  const selectionReference = options.selectionReference ? createNotebookReference(options.selectionReference) : null;
  const explicitViewPanel = options.viewPanel || null;
  const token = ++FileViewModuleState.selectedFileViewRenderToken;
  if (FileViewModuleState.selectedFileViewRenderTimer) {
    window.clearTimeout(FileViewModuleState.selectedFileViewRenderTimer);
  }
  FileViewModuleState.selectedFileViewRenderTimer = window.setTimeout(() => {
    FileViewModuleState.selectedFileViewRenderTimer = null;
    if (token !== FileViewModuleState.selectedFileViewRenderToken) return;
    const viewPanel = explicitViewPanel || getViewPanelElement();
    if (!viewPanel) return;
    if (window.__nvPanelTabContentIsActive && !window.__nvPanelTabContentIsActive(viewPanel)) return;
    updateViewPanel(path, {
      force: true,
      selectionReference,
      viewPanel
    }).catch(err => {
      console.error("❌ Error updating view panel:", err);
    });
  }, SELECTED_FILE_VIEW_RENDER_DELAY_MS);
}

export function nodevisionReferenceFromSelectionDetail(detail = {}) {
  if (detail?.reference?.path) return createNotebookReference(detail.reference);
  const path = detail?.path || detail?.filePath || "";
  if (!path) return null;
  return createNotebookReference({
    path,
    rootId: detail?.rootId,
    kind: detail?.isDirectory ? "directory" : "file"
  });
}

export function currentWorkspaceSelectionReference() {
  const selection = window.NodevisionSelection?.get?.();
  if (selection?.path) return createNotebookReference(selection);
  const state = window.NodevisionState || {};
  if (state.selectedReference?.path) return createNotebookReference(state.selectedReference);
  const path = state.selectedFile || window.selectedFilePath || "";
  if (!path) return null;
  return createNotebookReference({
    path,
    kind: state.selectedFileIsDirectory ? "directory" : "file"
  });
}

export function fileViewRootIsVisible(root) {
  if (!root?.isConnected) return false;
  const tabContent = root.closest?.(".nv-panel-tab-content") || null;
  if (tabContent?.hidden || tabContent?.style?.display === "none") return false;
  const cell = root.closest?.(".panel-cell") || null;
  if (cell?.hidden || cell?.style?.display === "none") return false;
  if (typeof window.__nvPanelTabContentIsActive === "function" && !window.__nvPanelTabContentIsActive(root)) return false;
  return true;
}

export function rememberSelectionFollowingFileView(viewPanel) {
  const root = viewPanel?.matches?.("[data-nv-file-view-root=\"true\"], #element-view") ? viewPanel : viewPanel?.querySelector?.("[data-nv-file-view-root=\"true\"], #element-view");
  if (!fileViewRootIsVisible(root)) return null;
  FileViewModuleState.selectionFollowingFileViewRootRef = root;
  return root;
}

export function clearSelectionFollowingFileView(viewPanel) {
  const root = viewPanel?.matches?.("[data-nv-file-view-root=\"true\"], #element-view") ? viewPanel : viewPanel?.querySelector?.("[data-nv-file-view-root=\"true\"], #element-view");
  if (root && FileViewModuleState.selectionFollowingFileViewRootRef === root) FileViewModuleState.selectionFollowingFileViewRootRef = null;
}

export function getSelectionFollowingFileViewRoot() {
  if (fileViewRootIsVisible(FileViewModuleState.selectionFollowingFileViewRootRef)) {
    return claimFileViewHost(FileViewModuleState.selectionFollowingFileViewRootRef);
  }
  FileViewModuleState.selectionFollowingFileViewRootRef = null;
  const activeRoot = activeFileViewRoot();
  if (fileViewRootIsVisible(activeRoot)) return rememberSelectionFollowingFileView(claimFileViewHost(activeRoot));
  if (fileViewRootIsVisible(FileViewModuleState.viewDivRef)) return rememberSelectionFollowingFileView(claimFileViewHost(FileViewModuleState.viewDivRef));
  const visibleRoot = [...document.querySelectorAll("[data-nv-file-view-root=\"true\"], #element-view")].find(root => fileViewRootIsVisible(root));
  return visibleRoot ? rememberSelectionFollowingFileView(claimFileViewHost(visibleRoot)) : null;
}

export function syncFileViewTabReference(viewPanel, reference) {
  if (!viewPanel || !reference?.path) return null;
  const renderReference = createNotebookReference(reference);
  const tabContent = viewPanel.closest?.(".nv-panel-tab-content") || null;
  const cell = viewPanel.closest?.(".panel-cell") || null;
  if (tabContent) {
    tabContent.__nvNodevisionReference = renderReference;
    tabContent.dataset.currentFilePath = renderReference.path;
  }
  if (cell) cell.dataset.currentFilePath = renderReference.path;
  const tab = cell?.__nvPanelTabs?.tabs?.find?.(candidate => candidate.contentElement === tabContent) || null;
  if (tab) {
    tab.panelVars = {
      ...(tab.panelVars || {}),
      filePath: renderReference.path,
      isDirectory: renderReference.kind === "directory",
      reference: serializeNodevisionReference(renderReference)
    };
    tab.resourcePath = renderReference.path;
    tab.reference = renderReference;
    refreshPanelTabMetadata(tab, cell);
    renderPanelTabs(cell);
  }
  return renderReference;
}

export function handleNodevisionSelectionChanged(event) {
  if (event?.detail?.source === "active-panel") return;
  const selectionReference = nodevisionReferenceFromSelectionDetail(event?.detail);
  const selectedPath = referenceToApiPath(selectionReference);
  if (!selectedPath) return;
  const viewPanel = getSelectionFollowingFileViewRoot();
  if (!viewPanel) return;
  scheduleSelectedFileViewRender(selectedPath, {
    selectionReference,
    viewPanel
  });
}
