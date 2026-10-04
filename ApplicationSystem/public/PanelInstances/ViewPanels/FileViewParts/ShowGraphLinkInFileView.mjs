// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/ShowGraphLinkInFileView.mjs
// This module implements show Graph Link In File View behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { selectedGraphLink, summarizeLinkRecord } from "/PanelInstances/InfoPanels/GraphManagerDependencies/LinkRecords.mjs";
import { getViewPanelElement, setFileViewStatus } from "./GetViewPanelElement.mjs";
import { cleanupViewIframeActivation } from "./InstallFileViewFocusHandler.mjs";
import { FileViewModuleState } from "./CancelScheduledSelectedFileViewRender.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { activateFileViewHost, fileViewRootFromFrameWindow } from "./ActivateFileViewPanel.mjs";
import { linkFileViewCss, renderPreviewSection, renderDestinationPreview } from "./RenderDestinationPreview.mjs";
import { linkTargetDisplay, renderLinkOccurrenceSelector } from "./RenderCreateIndexButton.mjs";
import { renderLinkDescription } from "./RenderLinkDescription.mjs";
import { renderLinkEditor, renderSourcePreview } from "./RenderLinkEditor.mjs";

// Show Graph Link In File View operations.
export async function showGraphLinkInFileView(selection = selectedGraphLink()) {
  const viewPanel = getViewPanelElement();
  const record = selection?.record || null;
  if (!viewPanel || !record) return false;
  if (typeof viewPanel._dispose === "function") {
    try {
      viewPanel._dispose();
    } catch (err) {
      console.warn("[FileView] Previous viewer cleanup failed:", err);
    }
    viewPanel._dispose = null;
  }
  cleanupViewIframeActivation(viewPanel);
  FileViewModuleState.currentLinkViewSelection = selection;
  FileViewModuleState.lastRenderedPath = null;
  viewPanel.innerHTML = "";
  delete viewPanel.dataset.nvZoomInlineFit;
  const owningCell = viewPanel.closest(".panel-cell");
  owningCell?.removeAttribute("data-current-file-path");
  owningCell?.setAttribute("data-current-link-id", selection.edgeId || record.id || "link");
  setFileViewStatus("Link Viewer", summarizeLinkRecord(record));
  updateToolbarState({
    currentMode: "LinkViewing",
    selectedGraphLink: selection
  });
  activateFileViewHost(viewPanel);
  const style = document.createElement("style");
  style.textContent = linkFileViewCss();
  const shell = document.createElement("div");
  shell.className = "nv-link-file-view";
  const header = document.createElement("header");
  header.className = "nv-link-file-header";
  const headerText = document.createElement("div");
  const title = document.createElement("h2");
  title.className = "nv-link-file-title";
  title.textContent = summarizeLinkRecord(record);
  const subtitle = document.createElement("div");
  subtitle.className = "nv-link-file-subtitle";
  subtitle.textContent = (record.sourcePath || "Unknown source") + " -> " + linkTargetDisplay(record);
  headerText.append(title, subtitle);
  header.appendChild(headerText);
  shell.appendChild(header);
  renderLinkOccurrenceSelector(shell, selection);
  renderLinkDescription(shell, selection);
  renderLinkEditor(shell, selection);
  const previews = document.createElement("div");
  previews.className = "nv-link-file-previews";
  shell.appendChild(previews);
  const sourceBody = renderPreviewSection(previews, "Source File", record.sourcePath || "", "source");
  const destinationBody = renderPreviewSection(previews, "Destination File", linkTargetDisplay(record), "destination");
  viewPanel.append(style, shell);
  renderSourcePreview(sourceBody, record);
  renderDestinationPreview(destinationBody, record);
  return true;
}

export function handleFileViewWindowMessage(event) {
  if (event.data?.type === "activatePanel" && event.data?.id === "FileView") {
    const root = fileViewRootFromFrameWindow(event.source);
    if (root) {
      activateFileViewHost(root);
      console.log("Active panel via postMessage:", window.activePanel);
    }
  }
}

export function installFileViewMessageListener() {
  if (window.__nvFileViewMessageListenerInstalled) return;
  window.addEventListener("message", handleFileViewWindowMessage);
  window.__nvFileViewMessageListenerInstalled = true;
}

export function installGraphLinkFileViewHandler() {
  if (window.__nvGraphLinkFileViewHandlerInstalled) return;
  window.__nvGraphLinkFileViewHandlerInstalled = true;
  window.showGraphLinkInFileView = showGraphLinkInFileView;
  window.addEventListener("nodevision-graph-link-selected", event => {
    const selection = event.detail?.selection || null;
    if (selection?.record) {
      showGraphLinkInFileView(selection).catch(err => console.warn("[FileView] Link view render failed:", err));
    }
  });
}

export function normalizeNotebookPath(value) {
  let cleaned = String(value || "").trim();
  if (!cleaned) return "";
  try {
    const parsed = new URL(cleaned, window.location.origin);
    cleaned = parsed.pathname || cleaned;
  } catch {
    // Keep raw value when it is not a URL.
  }
  cleaned = cleaned.replace(/\\/g, "/").replace(/[?#].*$/, "").replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "");
  if (cleaned.toLowerCase().startsWith("notebook/")) {
    cleaned = cleaned.slice("Notebook/".length);
  }
  return cleaned.trim();
}

export function getActiveFilePath(preferredPath = null) {
  const candidates = [preferredPath, window.currentActiveFilePath, window.NodevisionState?.activeEditorFilePath, window.selectedFilePath, window.NodevisionState?.selectedFile, window.ActiveNode, window.filePath];
  for (const candidate of candidates) {
    const normalized = normalizeNotebookPath(candidate);
    if (normalized) return normalized;
  }
  return "";
}

export function claimFileViewHost(viewDiv) {
  if (!viewDiv) return null;
  document.querySelectorAll("#element-view").forEach(node => {
    if (node !== viewDiv) {
      node.dataset.nvInactiveElementId = "element-view";
      node.removeAttribute("id");
    }
  });
  viewDiv.id = "element-view";
  viewDiv.dataset.nvFileViewRoot = "true";
  FileViewModuleState.viewDivRef = viewDiv;
  return viewDiv;
}

export function activeFileViewRoot() {
  const activeContent = document.querySelector(".panel-cell.active-panel .nv-panel-tab-content:not([hidden])");
  return activeContent?.querySelector?.("[data-nv-file-view-root=\"true\"], #element-view") || null;
}
