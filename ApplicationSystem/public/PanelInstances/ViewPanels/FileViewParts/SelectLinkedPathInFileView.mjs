// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/SelectLinkedPathInFileView.mjs
// This module implements select Linked Path In File View behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { normalizeResolvedNotebookPath, sameNotebookPath } from "./RetainFileViewSelectionFollower.mjs";
import { setPendingFileViewAnchor, revealLinkedPathInOriginNavigator, scrollFileViewToAnchor } from "./RevealLinkedPathInOriginNavigator.mjs";
import { guardFileSwitch } from "/EditorSwitchGuard.mjs";
import { shouldHandleFileViewLinkClick, getAnchorFromClick, resolveNotebookDocumentLink, isNavigatorPanelOpen } from "./ResolveNotebookDocumentLink.mjs";
import { getActiveFilePath } from "./ShowGraphLinkInFileView.mjs";
import { toNotebookAssetUrl } from "/utils/notebookPath.mjs";
import { referenceToApiPath, resolveDirectoryIndexReference, createDirectoryReference } from "/NodevisionReference.mjs";
import { navigationState } from "./CancelScheduledSelectedFileViewRender.mjs";

// Select Linked Path In File View operations.
export function selectLinkedPathInFileView(targetPath, {
  hash = "",
  isDirectory = false
} = {}) {
  const cleanPath = normalizeResolvedNotebookPath(targetPath);
  if (!cleanPath) return;
  const applySelection = () => {
    setPendingFileViewAnchor(cleanPath, hash);
    window.__nvFileSwitchGuardBypass = true;
    try {
      window.selectedFilePath = cleanPath;
    } finally {
      window.__nvFileSwitchGuardBypass = false;
    }
    revealLinkedPathInOriginNavigator(cleanPath, {
      isDirectory
    }).catch(err => {
      console.warn("[FileView] Failed to reveal linked path:", err);
    });
  };
  if (typeof guardFileSwitch === "function") {
    guardFileSwitch(cleanPath, applySelection);
  } else if (typeof window.__nvGuardFileSwitch === "function") {
    window.__nvGuardFileSwitch(cleanPath, applySelection);
  } else {
    applySelection();
  }
}

export function navigateFileViewLink(resolvedLink) {
  if (!resolvedLink?.path) return;
  if (resolvedLink.isSameDocumentAnchor) {
    scrollFileViewToAnchor(resolvedLink.hash);
    revealLinkedPathInOriginNavigator(resolvedLink.path, {
      isDirectory: resolvedLink.isDirectory
    }).catch(err => {
      console.warn("[FileView] Failed to reveal same-document link:", err);
    });
    return;
  }
  selectLinkedPathInFileView(resolvedLink.path, {
    hash: resolvedLink.hash,
    isDirectory: resolvedLink.isDirectory
  });
}

export function handleFileViewLinkClick(event) {
  if (!shouldHandleFileViewLinkClick(event)) return;
  const anchor = getAnchorFromClick(event);
  if (!anchor || anchor.hasAttribute("download")) return;
  const rawHref = anchor.getAttribute("href") || "";
  const resolvedLink = resolveNotebookDocumentLink(rawHref, getActiveFilePath());
  if (!resolvedLink) return;
  event.preventDefault();
  navigateFileViewLink(resolvedLink);
}

export function installFileViewLinkNavigation(viewDiv) {
  if (!viewDiv || viewDiv.__nvFileViewLinkNavigationAttached) return;
  viewDiv.__nvFileViewLinkNavigationAttached = true;
  viewDiv.addEventListener("click", handleFileViewLinkClick, {
    capture: true
  });
}

export const LINK_TEXT_PREVIEW_EXTS = new Set(["txt", "md", "markdown", "html", "htm", "xhtml", "php", "css", "js", "mjs", "cjs", "json", "xml", "svg", "csv", "ts", "tsx", "jsx", "py", "java", "c", "cpp", "h", "hpp", "ino", "yml", "yaml", "toml", "ini", "log"]);

export const LINK_IMAGE_PREVIEW_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "svg"]);

export const LINK_AUDIO_PREVIEW_EXTS = new Set(["mp3", "wav", "ogg", "flac", "m4a", "aac"]);

export const LINK_VIDEO_PREVIEW_EXTS = new Set(["mp4", "webm", "ogv", "mov"]);

export function escapeLinkHtml(value = "") {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

export function pathExtension(pathValue = "") {
  const clean = normalizeResolvedNotebookPath(pathValue).toLowerCase();
  const last = clean.split("/").pop() || "";
  if (!last.includes(".")) return "";
  return last.split(".").pop() || "";
}

export function notebookAssetUrl(pathValue = "") {
  return toNotebookAssetUrl(normalizeResolvedNotebookPath(pathValue));
}

export function notebookIndexPathForDirectory(directoryPath = "") {
  const cleanDirectory = normalizeResolvedNotebookPath(directoryPath || "");
  return referenceToApiPath(resolveDirectoryIndexReference(createDirectoryReference({
    path: cleanDirectory
  })));
}

export function openNavigatorPanelTypes() {
  return ["FileManager", "GraphManager"].filter(panelType => isNavigatorPanelOpen(panelType));
}

export function defaultIndexDirectory() {
  const openPanels = openNavigatorPanelTypes();
  if (openPanels.length === 0) return "";
  const lastDirectoryPanelType = navigationState.getLastOpenedDirectoryPanelType?.() || navigationState.getLastInfoPanelType?.();
  if (lastDirectoryPanelType && !openPanels.includes(lastDirectoryPanelType)) {
    return openPanels.includes("FileManager") ? normalizeResolvedNotebookPath(window.currentDirectoryPath || "") : "";
  }
  const rememberedDirectory = normalizeResolvedNotebookPath(navigationState.getSearchRoot?.() || "");
  if (rememberedDirectory || !openPanels.includes("FileManager")) return rememberedDirectory;
  return normalizeResolvedNotebookPath(window.currentDirectoryPath || "");
}

export function selectedPathMatchesDirectoryRequest(pathValue = "") {
  const cleanPath = normalizeResolvedNotebookPath(pathValue || "");
  if (!cleanPath) return false;
  const pending = window.__nvPendingSelectedFileMetadata;
  if (pending && sameNotebookPath(pending.path, cleanPath)) {
    return Boolean(pending.isDirectory);
  }
  const state = window.NodevisionState || {};
  const selectedPath = normalizeResolvedNotebookPath(state.selectedFile || window.selectedFilePath || "");
  return Boolean(state.selectedFileIsDirectory && selectedPath && sameNotebookPath(selectedPath, cleanPath));
}

export function selectedPathMatchesFileRequest(pathValue = "") {
  const cleanPath = normalizeResolvedNotebookPath(pathValue || "");
  if (!cleanPath) return false;
  const pending = window.__nvPendingSelectedFileMetadata;
  if (pending && sameNotebookPath(pending.path, cleanPath)) {
    return pending.isDirectory === false;
  }
  const state = window.NodevisionState || {};
  const selectedPath = normalizeResolvedNotebookPath(state.selectedFile || window.selectedFilePath || "");
  return Boolean(selectedPath && sameNotebookPath(selectedPath, cleanPath) && state.selectedFileIsDirectory === false);
}
