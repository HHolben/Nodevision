// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/SetupPanel.mjs
// This module implements setup Panel behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { claimFileViewHost, installGraphLinkFileViewHandler, installFileViewMessageListener, showGraphLinkInFileView, normalizeNotebookPath } from "./ShowGraphLinkInFileView.mjs";
import { rememberSelectionFollowingFileView, cancelScheduledSelectedFileViewRender, FileViewModuleState, clearSelectionFollowingFileView, currentWorkspaceSelectionReference } from "./CancelScheduledSelectedFileViewRender.mjs";
import { enableViewActivation, activateFileViewHost } from "./ActivateFileViewPanel.mjs";
import { installFileViewLinkNavigation, selectedPathMatchesDirectoryRequest, openNavigatorPanelTypes } from "./SelectLinkedPathInFileView.mjs";
import { observeViewIframes, cleanupViewIframeActivation, installFileViewFocusHandler, installFileViewLiveRefresh } from "./InstallFileViewFocusHandler.mjs";
import { retainFileViewSelectionFollower, dispatchLiveFileViewerState } from "./RetainFileViewSelectionFollower.mjs";
import { incrementPerformanceCounter } from "/PerformanceDiagnostics.mjs";
import { installFileViewPointerTracking } from "./DescribeFileViewOwner.mjs";
import { selectedGraphLink } from "/PanelInstances/InfoPanels/GraphManagerDependencies/LinkRecords.mjs";
import { createNotebookReference, referenceToApiPath } from "/NodevisionReference.mjs";
import { resolveDefaultIndexTarget } from "./NotebookFileExists.mjs";
import { getViewPanelElement, setFileViewStatus } from "./GetViewPanelElement.mjs";
import { renderCreateIndexButton } from "./RenderCreateIndexButton.mjs";
import { updateViewPanel } from "./UpdateViewPanel.mjs";

// Setup Panel operations.
export async function setupPanel(panel, instanceVars = {}) {
  // Create container for view content
  const viewDiv = document.createElement("div");
  viewDiv.style.width = "100%";
  viewDiv.style.height = "100%";
  viewDiv.style.overflow = "auto";
  viewDiv.dataset.nvFileViewRoot = "true";
  panel.appendChild(viewDiv);
  claimFileViewHost(viewDiv);
  rememberSelectionFollowingFileView(viewDiv);
  enableViewActivation(viewDiv);
  installFileViewLinkNavigation(viewDiv);
  observeViewIframes(viewDiv);
  const releaseFileViewSelectionFollower = retainFileViewSelectionFollower();
  const quietFileViewPanel = () => {
    incrementPerformanceCounter("FileView.lifecycleDeactivateCalls");
    cancelScheduledSelectedFileViewRender();
    if (FileViewModuleState.pendingFileViewAnchorTimer) {
      window.clearTimeout(FileViewModuleState.pendingFileViewAnchorTimer);
      FileViewModuleState.pendingFileViewAnchorTimer = null;
      incrementPerformanceCounter("FileView.pendingAnchorTimersCleared");
    }
    if (FileViewModuleState.liveFileViewRefreshTimer) {
      window.clearTimeout(FileViewModuleState.liveFileViewRefreshTimer);
      FileViewModuleState.liveFileViewRefreshTimer = null;
      incrementPerformanceCounter("FileView.liveRefreshTimersCleared");
    }
    cleanupViewIframeActivation(viewDiv);
  };
  const cleanupFileViewPanel = () => {
    quietFileViewPanel();
    clearSelectionFollowingFileView(viewDiv);
    releaseFileViewSelectionFollower();
    cleanupViewIframeActivation(viewDiv, {
      disconnectObserver: true
    });
  };
  if (typeof panel.cleanup === "function") {
    const previousCleanup = panel.cleanup;
    panel.cleanup = () => {
      cleanupFileViewPanel();
      previousCleanup();
    };
  } else {
    panel.cleanup = cleanupFileViewPanel;
  }
  const fileViewLifecycle = {
    activate: () => {
      claimFileViewHost(viewDiv);
      observeViewIframes(viewDiv);
      activateFileViewHost(viewDiv);
    },
    deactivate: quietFileViewPanel,
    destroy: cleanupFileViewPanel
  };
  installFileViewPointerTracking();
  installFileViewFocusHandler();
  installFileViewLiveRefresh();
  installGraphLinkFileViewHandler();
  dispatchLiveFileViewerState();
  installFileViewMessageListener();
  const activeGraphLinkSelection = selectedGraphLink();
  if (activeGraphLinkSelection?.record) {
    await showGraphLinkInFileView(activeGraphLinkSelection);
    return fileViewLifecycle;
  }
  const explicitInitialReference = instanceVars.reference ? createNotebookReference(instanceVars.reference) : null;
  const selectedInitialReference = explicitInitialReference ? null : currentWorkspaceSelectionReference();
  const initialReference = explicitInitialReference || selectedInitialReference;
  const explicitInitialPath = normalizeNotebookPath(instanceVars.filePath || referenceToApiPath(explicitInitialReference) || "");
  const selectedInitialPath = normalizeNotebookPath(referenceToApiPath(selectedInitialReference) || window.selectedFilePath || window.NodevisionState?.selectedFile || "");
  let initialPath = explicitInitialPath || selectedInitialPath;
  if (initialPath && selectedPathMatchesDirectoryRequest(initialPath) && openNavigatorPanelTypes().length === 0) {
    initialPath = "";
  }
  if (!initialPath) {
    const defaultTarget = await resolveDefaultIndexTarget();
    const viewPanel = getViewPanelElement();
    if (!defaultTarget.exists) {
      console.warn("⚠️ FileView default index missing:", defaultTarget.indexPath);
      renderCreateIndexButton(viewPanel, defaultTarget.directoryPath, {
        selectCreatedFile: true
      });
      return fileViewLifecycle;
    }
    initialPath = defaultTarget.indexPath;
  }
  console.log("📂 FileView activation resolved path:", initialPath);
  setFileViewStatus("File Viewer", initialPath);
  const initialPathIsDirectory = initialReference?.kind === "directory" || selectedPathMatchesDirectoryRequest(initialPath);
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.selectedFile = initialPath;
  window.NodevisionState.selectedFileIsDirectory = initialPathIsDirectory;
  window.currentActiveFilePath = initialPath;
  panel.dataset.currentFilePath = initialPath;
  FileViewModuleState.lastRenderedPath = null;
  try {
    await updateViewPanel(initialPath, {
      force: true,
      selectionReference: initialReference,
      viewPanel: viewDiv
    });
  } catch (err) {
    console.error("❌ Initial updateViewPanel error:", err);
    setFileViewStatus("File Viewer", `Render failed: ${err?.message || err}`);
  }
  return fileViewLifecycle;
}
