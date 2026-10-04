// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/NotebookFileExists.mjs
// This module implements notebook File Exists behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { normalizeResolvedNotebookPath } from "./RetainFileViewSelectionFollower.mjs";
import { notebookAssetUrl, defaultIndexDirectory, notebookIndexPathForDirectory } from "./SelectLinkedPathInFileView.mjs";
import { cleanupViewIframeActivation } from "./InstallFileViewFocusHandler.mjs";
import { FileViewModuleState } from "./CancelScheduledSelectedFileViewRender.mjs";

// Notebook File Exists operations.
export async function notebookFileExists(pathValue = "") {
  const cleanPath = normalizeResolvedNotebookPath(pathValue || "");
  if (!cleanPath) return false;
  const url = notebookAssetUrl(cleanPath);
  try {
    const head = await fetch(url, {
      method: "HEAD",
      cache: "no-store"
    });
    if (head.ok) return true;
    if (head.status !== 405) return false;
  } catch {
    // Some static handlers do not support HEAD; the GET probe below covers those.
  }
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Range: "bytes=0-0"
      }
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function resolveDefaultIndexTarget() {
  const directoryPath = defaultIndexDirectory();
  const indexPath = notebookIndexPathForDirectory(directoryPath);
  return {
    directoryPath,
    indexPath,
    exists: await notebookFileExists(indexPath)
  };
}

export function prepareViewPanelForInlineState(viewPanel) {
  if (typeof viewPanel?._dispose === "function") {
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
  FileViewModuleState.lastRenderedPath = null;
  FileViewModuleState.currentLinkViewSelection = null;
  viewPanel.closest(".panel-cell")?.removeAttribute("data-current-link-id");
}

export function setSelectedFilePathFromFileView(pathValue = "", isDirectory = false) {
  const cleanPath = normalizeResolvedNotebookPath(pathValue || "");
  if (!cleanPath) return false;
  window.__nvFileSwitchGuardBypass = true;
  window.__nvPendingSelectedFileMetadata = {
    path: cleanPath,
    isDirectory: Boolean(isDirectory)
  };
  try {
    window.selectedFilePath = cleanPath;
  } finally {
    window.__nvFileSwitchGuardBypass = false;
    if (window.__nvPendingSelectedFileMetadata?.path === cleanPath) {
      window.__nvPendingSelectedFileMetadata = null;
    }
  }
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.selectedFile = cleanPath;
  window.NodevisionState.selectedFileIsDirectory = Boolean(isDirectory);
  return true;
}

export async function createNotebookFile(relativePath = "") {
  const cleanPath = normalizeResolvedNotebookPath(relativePath || "");
  if (!cleanPath) throw new Error("File path is required.");
  const response = await fetch("/api/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      path: cleanPath
    })
  });
  if (response.ok || response.status === 409) {
    return {
      path: cleanPath,
      existed: response.status === 409
    };
  }
  const message = await response.text().catch(() => "");
  throw new Error(message || "Failed to create " + cleanPath + ".");
}

export async function refreshNavigatorsForDirectory(directoryPath = "") {
  const cleanDirectory = normalizeResolvedNotebookPath(directoryPath || "");
  const tasks = [];
  if (typeof window.refreshFileManager === "function") {
    tasks.push(window.refreshFileManager(cleanDirectory));
  }
  if (typeof window.refreshGraphManager === "function") {
    tasks.push(window.refreshGraphManager({
      fit: false,
      reason: "create-index-html"
    }));
  }
  await Promise.allSettled(tasks);
}
