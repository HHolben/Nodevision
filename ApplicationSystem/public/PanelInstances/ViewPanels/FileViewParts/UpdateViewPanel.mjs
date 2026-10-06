// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/UpdateViewPanel.mjs
// This module implements update View Panel behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { cancelScheduledSelectedFileViewRender, FileViewModuleState, syncFileViewTabReference, navigationState } from "./CancelScheduledSelectedFileViewRender.mjs";
import { getViewPanelElement, setFileViewStatus, resolveExtension } from "./GetViewPanelElement.mjs";
import { createNotebookReference, referenceToApiPath, createDirectoryReference, resolveDirectoryIndexReference, createFileReference } from "/NodevisionReference.mjs";
import { getActiveFilePath } from "./ShowGraphLinkInFileView.mjs";
import { selectedPathMatchesDirectoryRequest, openNavigatorPanelTypes, selectedPathMatchesFileRequest } from "./SelectLinkedPathInFileView.mjs";
import { resolveDefaultIndexTarget, notebookFileExists } from "./NotebookFileExists.mjs";
import { renderCreateIndexButton } from "./RenderCreateIndexButton.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { cleanupViewIframeActivation } from "./InstallFileViewFocusHandler.mjs";
import { getNodevisionRouteBase } from "/utils/notebookPath.mjs";
import { getLiveFileContentForPath } from "/LiveFileContent.mjs";
import { renderFile } from "./RenderFile.mjs";
import { tryScrollToPendingFileViewAnchor } from "./RevealLinkedPathInOriginNavigator.mjs";

// Update View Panel operations.
export async function updateViewPanel(element, {
  force = false,
  selectionReference = null,
  viewPanel: requestedViewPanel = null
} = {}) {
  cancelScheduledSelectedFileViewRender();
  const viewPanel = requestedViewPanel || getViewPanelElement();
  if (!viewPanel) {
    console.error("View panel element not found.");
    setFileViewStatus("File Viewer", "Render failed: panel not found");
    return false;
  }
  const requestedReference = selectionReference ? createNotebookReference(selectionReference) : null;
  let renderReference = requestedReference?.kind === "file" ? requestedReference : null;
  let filename = referenceToApiPath(requestedReference) || getActiveFilePath(element);
  if (filename && selectedPathMatchesDirectoryRequest(filename) && openNavigatorPanelTypes().length === 0) {
    filename = "";
  }
  let preserveSelectedFolder = false;
  let selectedFolderPath = "";
  if (!filename) {
    const defaultTarget = await resolveDefaultIndexTarget();
    if (!defaultTarget.exists) {
      console.warn("⚠️ FileView default index missing:", defaultTarget.indexPath);
      renderCreateIndexButton(viewPanel, defaultTarget.directoryPath, {
        selectCreatedFile: true
      });
      return false;
    }
    filename = defaultTarget.indexPath;
  }
  FileViewModuleState.currentLinkViewSelection = null;
  viewPanel.closest(".panel-cell")?.removeAttribute("data-current-link-id");
  console.log("📍 FileView resolved path:", filename);
  viewPanel.closest(".panel-cell")?.setAttribute("data-current-file-path", filename);
  let ext = resolveExtension(filename);
  const lowerFilename = filename.toLowerCase();
  const selectedDirectoryRequest = requestedReference?.kind === "directory" || selectedPathMatchesDirectoryRequest(filename);
  const selectedFileRequest = requestedReference?.kind === "file" || selectedPathMatchesFileRequest(filename);
  const shouldResolveDirectoryIndex = selectedDirectoryRequest || !selectedFileRequest && (!ext || lowerFilename === ext || !filename.includes("."));
  if (shouldResolveDirectoryIndex) {
    const directoryReference = requestedReference?.kind === "directory" ? requestedReference : createDirectoryReference({
      path: filename
    });
    const directoryPath = referenceToApiPath(directoryReference);
    const indexReference = resolveDirectoryIndexReference(directoryReference);
    const indexPath = referenceToApiPath(indexReference);
    if (!(await notebookFileExists(indexPath))) {
      console.log("📁 Directory index missing:", indexPath);
      FileViewModuleState.lastRenderedPath = directoryPath;
      viewPanel.dataset.currentFilePath = directoryPath;
      viewPanel.dataset.nvFileViewRenderedPath = directoryPath;
      viewPanel.dataset.nvFileViewSelectionPath = directoryPath;
      viewPanel.dataset.nvFileViewSelectionIsDirectory = "true";
      viewPanel.closest(".nv-panel-tab-content")?.setAttribute("data-current-file-path", directoryPath);
      syncFileViewTabReference(viewPanel, directoryReference);
      renderCreateIndexButton(viewPanel, directoryPath, {
        selectCreatedFile: !selectedDirectoryRequest
      });
      return false;
    }
    preserveSelectedFolder = selectedDirectoryRequest;
    selectedFolderPath = directoryPath;
    navigationState.setLastOpenedDirectory(directoryPath, navigationState.getLastFileSelectionPanelType?.() || navigationState.getLastInfoPanelType?.());
    filename = indexPath;
    renderReference = indexReference;
    ext = resolveExtension(filename);
    viewPanel.closest(".panel-cell")?.setAttribute("data-current-file-path", filename);
    console.log("📁 FileView directory index resolved:", filename);
  }

  // Prevent redundant rerenders unless forced
  if (!force && filename === FileViewModuleState.lastRenderedPath) {
    console.log("🔁 File already displayed:", filename);
    setFileViewStatus("File Viewer", filename);
    return true;
  }
  if (!renderReference) renderReference = createFileReference({
    path: filename
  });
  const toolbarSelectedPath = preserveSelectedFolder ? selectedFolderPath : filename;
  FileViewModuleState.lastRenderedPath = filename;
  viewPanel.dataset.currentFilePath = filename;
  viewPanel.dataset.nvFileViewRenderedPath = filename;
  viewPanel.dataset.nvFileViewSelectionPath = toolbarSelectedPath;
  viewPanel.dataset.nvFileViewSelectionIsDirectory = String(preserveSelectedFolder);
  viewPanel.closest(".nv-panel-tab-content")?.setAttribute("data-current-file-path", filename);
  syncFileViewTabReference(viewPanel, renderReference);
  console.log("🧭 Updating view panel for file:", filename);
  window.currentActiveFilePath = filename;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.selectedFile = toolbarSelectedPath;
  window.NodevisionState.selectedFileIsDirectory = preserveSelectedFolder;
  window.NodevisionState.activeFileViewPath = filename;
  window.NodevisionModelExportContext = null;
  updateToolbarState({
    currentMode: "Default",
    selectedFile: toolbarSelectedPath,
    modelCanExportSTL: false,
    modelCanExport2DPattern: false,
    liveFileViewerEnabled: FileViewModuleState.liveFileViewerEnabled
  });
  setFileViewStatus("File Viewer", filename);
  if (typeof viewPanel._dispose === "function") {
    try {
      viewPanel._dispose();
    } catch (err) {
      console.warn("[FileView] Previous viewer cleanup failed:", err);
    }
    viewPanel._dispose = null;
  }
  cleanupViewIframeActivation(viewPanel);
  viewPanel.innerHTML = "";
  delete viewPanel.dataset.nvZoomInlineFit;

  // Determine server base depending on file type
  const isPHP = ext === "php";
  const serverBase = getNodevisionRouteBase({
    route: isPHP ? "php" : "Notebook"
  });
  const liveContent = FileViewModuleState.liveFileViewerEnabled ? getLiveFileContentForPath(filename) : null;
  if (liveContent) {
    viewPanel.dataset.nvLiveFileViewer = "true";
    viewPanel.dataset.nvLiveFileViewerSource = liveContent.sourceLabel || liveContent.sourceId || "Editor";
  } else {
    delete viewPanel.dataset.nvLiveFileViewer;
    delete viewPanel.dataset.nvLiveFileViewerSource;
  }
  const success = await renderFile(filename, viewPanel, serverBase, {
    liveContent,
    liveFileViewerEnabled: FileViewModuleState.liveFileViewerEnabled,
    selectionPath: toolbarSelectedPath,
    selectionIsDirectory: preserveSelectedFolder
  });
  if (success) {
    setFileViewStatus(liveContent ? "Live File Viewer" : "File Viewer", (liveContent ? "Live: " : "Loaded: ") + filename);
    tryScrollToPendingFileViewAnchor(filename);
  } else {
    setFileViewStatus("File Viewer", `Render failed: ${filename}`);
  }
  return success;
}
