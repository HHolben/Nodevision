// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/RetainFileViewSelectionFollower.mjs
// This module implements retain File View Selection Follower behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { FileViewModuleState, handleNodevisionSelectionChanged, LIVE_FILE_VIEWER_STORAGE_KEY } from "./CancelScheduledSelectedFileViewRender.mjs";
import { getActiveFilePath } from "./ShowGraphLinkInFileView.mjs";
import { normalizeNotebookRelativePath } from "/utils/notebookPath.mjs";

// Retain File View Selection Follower operations.
export function retainFileViewSelectionFollower() {
  FileViewModuleState.fileViewSelectionFollowerRefs += 1;
  if (!FileViewModuleState.fileViewSelectionFollowerInstalled) {
    window.addEventListener("nodevision-selection-changed", handleNodevisionSelectionChanged);
    FileViewModuleState.fileViewSelectionFollowerInstalled = true;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    FileViewModuleState.fileViewSelectionFollowerRefs = Math.max(0, FileViewModuleState.fileViewSelectionFollowerRefs - 1);
    if (FileViewModuleState.fileViewSelectionFollowerRefs === 0 && FileViewModuleState.fileViewSelectionFollowerInstalled) {
      window.removeEventListener("nodevision-selection-changed", handleNodevisionSelectionChanged);
      FileViewModuleState.fileViewSelectionFollowerInstalled = false;
    }
  };
}

export function readLiveFileViewerEnabled() {
  try {
    return window.localStorage?.getItem?.(LIVE_FILE_VIEWER_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeLiveFileViewerEnabled(enabled) {
  try {
    window.localStorage?.setItem?.(LIVE_FILE_VIEWER_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Keep runtime state even if storage is unavailable.
  }
}

export function dispatchLiveFileViewerState() {
  window.dispatchEvent(new CustomEvent("nodevision-live-file-viewer-state", {
    detail: {
      enabled: FileViewModuleState.liveFileViewerEnabled
    }
  }));
}

export function isLiveFileViewerEnabled() {
  return Boolean(FileViewModuleState.liveFileViewerEnabled);
}

export function setLiveFileViewerEnabled(enabled, options = {}) {
  FileViewModuleState.liveFileViewerEnabled = Boolean(enabled);
  writeLiveFileViewerEnabled(FileViewModuleState.liveFileViewerEnabled);
  dispatchLiveFileViewerState();
  if (options.refresh !== false) {
    const path = FileViewModuleState.lastRenderedPath || getActiveFilePath();
    if (path && typeof window.updateViewPanel === "function") {
      window.updateViewPanel(path, {
        force: true
      }).catch(err => {
        console.warn("[FileView] Live viewer refresh failed:", err);
      });
    }
  }
  return FileViewModuleState.liveFileViewerEnabled;
}

export function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export function decodeUriSafely(value = "") {
  try {
    return decodeURI(String(value || ""));
  } catch {
    return String(value || "");
  }
}

export function decodeHashSafely(value = "") {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

export function normalizeResolvedNotebookPath(value = "") {
  const clean = normalizeNotebookRelativePath(value || "");
  const parts = [];
  clean.split("/").forEach(part => {
    if (!part || part === ".") return;
    if (part === "..") {
      if (parts.length > 0) parts.pop();
      return;
    }
    parts.push(part);
  });
  return parts.join("/");
}

export function dirnamePath(pathValue = "") {
  const clean = normalizeResolvedNotebookPath(pathValue);
  if (!clean.includes("/")) return "";
  return clean.slice(0, clean.lastIndexOf("/"));
}

export function sameNotebookPath(a, b) {
  return normalizeResolvedNotebookPath(a).toLowerCase() === normalizeResolvedNotebookPath(b).toLowerCase();
}

export function splitHrefParts(rawHref = "") {
  const text = String(rawHref || "").trim();
  const hashIndex = text.indexOf("#");
  const beforeHash = hashIndex >= 0 ? text.slice(0, hashIndex) : text;
  const hash = hashIndex >= 0 ? decodeHashSafely(text.slice(hashIndex + 1)) : "";
  const queryIndex = beforeHash.indexOf("?");
  const path = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  return {
    path,
    hash
  };
}

export function isUnsupportedLinkProtocol(rawHref = "") {
  const text = String(rawHref || "").trim().toLowerCase();
  return text.startsWith("//") || text.startsWith("mailto:") || text.startsWith("tel:") || text.startsWith("javascript:") || text.startsWith("data:") || text.startsWith("blob:");
}

export function stripNotebookLinkRoot(pathPart = "") {
  let candidate = decodeUriSafely(pathPart).replace(/\\/g, "/").trim();
  candidate = candidate.replace(/^\/+/, "");
  const lower = candidate.toLowerCase();
  if (lower.startsWith("notebook/")) {
    return candidate.slice("Notebook/".length);
  }
  if (lower.startsWith("php/")) {
    return candidate.slice("php/".length);
  }
  return candidate;
}
