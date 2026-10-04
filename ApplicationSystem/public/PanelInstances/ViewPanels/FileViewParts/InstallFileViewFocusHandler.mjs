// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/InstallFileViewFocusHandler.mjs
// This module implements install File View Focus Handler behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { fileViewRootFromTarget, activateFileViewHost } from "./ActivateFileViewPanel.mjs";
import { normalizeResolvedNotebookPath } from "./RetainFileViewSelectionFollower.mjs";
import { FileViewModuleState } from "./CancelScheduledSelectedFileViewRender.mjs";
import { getActiveFilePath } from "./ShowGraphLinkInFileView.mjs";
import { activeFileViewCanRefreshPath } from "./GetViewPanelElement.mjs";
import { updateViewPanel } from "./UpdateViewPanel.mjs";
import { installIframeActivation } from "./InstallIframeActivation.mjs";
import { incrementPerformanceCounter } from "/PerformanceDiagnostics.mjs";

// Install File View Focus Handler operations.
export function installFileViewFocusHandler() {
  if (window.__nvFileViewFocusHandlerInstalled) return;
  const focusHandler = event => {
    const root = fileViewRootFromTarget(event?.target);
    if (root) activateFileViewHost(root);
  };
  document.addEventListener("focusin", focusHandler, true);
  window.__nvFileViewFocusHandlerInstalled = true;
}

export function scheduleLiveFileViewRefresh(path, reason = "live-content") {
  const targetPath = normalizeResolvedNotebookPath(path || FileViewModuleState.lastRenderedPath || getActiveFilePath());
  if (!targetPath) return;
  window.clearTimeout(FileViewModuleState.liveFileViewRefreshTimer);
  FileViewModuleState.liveFileViewRefreshTimer = window.setTimeout(() => {
    FileViewModuleState.liveFileViewRefreshTimer = null;
    if (!activeFileViewCanRefreshPath(targetPath)) return;
    console.log("📡 FileViewer live-buffer refresh for:", targetPath, reason);
    updateViewPanel(targetPath, {
      force: true
    }).catch(err => {
      console.error("❌ Live-buffer updateViewPanel failed:", err);
    });
  }, 350);
}

export function handleLiveFileContentChanged(event) {
  if (!FileViewModuleState.liveFileViewerEnabled) return;
  const changedPath = event?.detail?.normalizedPath || event?.detail?.filePath || "";
  if (!changedPath || !FileViewModuleState.lastRenderedPath) return;
  if (normalizeResolvedNotebookPath(changedPath) !== normalizeResolvedNotebookPath(FileViewModuleState.lastRenderedPath)) return;
  if (!activeFileViewCanRefreshPath(FileViewModuleState.lastRenderedPath)) return;
  scheduleLiveFileViewRefresh(FileViewModuleState.lastRenderedPath, event?.detail?.reason || "live-content");
}

export function handleFileSavedForView(event) {
  try {
    const savedPath = event?.detail?.filePath;
    if (!savedPath) return;
    if (savedPath === FileViewModuleState.lastRenderedPath) {
      console.log("📡 FileViewer live-refresh for:", savedPath);
      updateViewPanel(savedPath, {
        force: true
      }).catch(err => {
        console.error("❌ Live-refresh updateViewPanel failed:", err);
      });
    }
  } catch (err) {
    console.error("❌ Live-refresh handler error:", err);
  }
}

export function installFileViewLiveRefresh() {
  if (window.__nvFileViewLiveRefreshInstalled) return;
  window.addEventListener("nodevision-file-saved", handleFileSavedForView);
  window.addEventListener("nodevision-live-file-content-changed", handleLiveFileContentChanged);
  window.__nvFileViewLiveRefreshInstalled = true;
}

export function attachIframeActivation(node, ownerRoot = null) {
  if (!node) return;
  const root = ownerRoot || fileViewRootFromTarget(node);
  if (node instanceof HTMLIFrameElement) {
    installIframeActivation(node, root);
  } else if (node.querySelectorAll) {
    node.querySelectorAll("iframe").forEach(iframe => installIframeActivation(iframe, root || fileViewRootFromTarget(iframe)));
  }
}

export function observeViewIframes(viewDiv) {
  if (!viewDiv) return;
  if (viewDiv.__nvIframeObserver) return;
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        attachIframeActivation(node, viewDiv);
      }
      for (const node of record.removedNodes || []) {
        cleanupViewIframeActivation(node);
      }
    }
  });
  viewDiv.__nvIframeObserver = observer;
  observer.observe(viewDiv, {
    childList: true,
    subtree: true
  });
  incrementPerformanceCounter("FileView.iframeObserversAdded");
  attachIframeActivation(viewDiv, viewDiv);
}

export function cleanupViewIframeActivation(viewDiv, options = {}) {
  if (!viewDiv) return;
  const iframes = [];
  if (viewDiv instanceof HTMLIFrameElement) iframes.push(viewDiv);
  viewDiv.querySelectorAll?.("iframe").forEach(iframe => iframes.push(iframe));
  if (iframes.length) incrementPerformanceCounter("FileView.iframeActivationCleanupCalls", iframes.length);
  for (const iframe of iframes) {
    try {
      iframe.__nvFileViewActivationBridge?.cleanup?.();
    } catch (err) {
      console.warn?.("[FileView] iframe activation cleanup failed:", err);
    }
  }
  if (options.disconnectObserver && viewDiv.__nvIframeObserver) {
    viewDiv.__nvIframeObserver.disconnect();
    viewDiv.__nvIframeObserver = null;
    incrementPerformanceCounter("FileView.iframeObserversDisconnected");
  }
}
