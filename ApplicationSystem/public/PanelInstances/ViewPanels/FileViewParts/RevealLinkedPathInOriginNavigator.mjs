// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/RevealLinkedPathInOriginNavigator.mjs
// This module implements reveal Linked Path In Origin Navigator behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { normalizeResolvedNotebookPath, decodeHashSafely, sameNotebookPath } from "./RetainFileViewSelectionFollower.mjs";
import { getLinkNavigatorCandidates, isNavigatorPanelOpen } from "./ResolveNotebookDocumentLink.mjs";
import { navigationState, FileViewModuleState } from "./CancelScheduledSelectedFileViewRender.mjs";
import { incrementPerformanceCounter } from "/PerformanceDiagnostics.mjs";
import { getViewPanelElement } from "./GetViewPanelElement.mjs";
import { getActiveFilePath } from "./ShowGraphLinkInFileView.mjs";

// Reveal Linked Path In Origin Navigator operations.
export async function revealLinkedPathInOriginNavigator(path, {
  isDirectory = false
} = {}) {
  const cleanPath = normalizeResolvedNotebookPath(path);
  if (!cleanPath) return false;
  for (const panelType of getLinkNavigatorCandidates()) {
    if (!isNavigatorPanelOpen(panelType)) continue;
    try {
      if (panelType === "FileManager") {
        const opened = await window.revealPathInFileManager(cleanPath, {
          isDirectory,
          selectFile: false
        });
        if (opened) {
          navigationState.setLastFileSelectionPanelType?.("FileManager");
          return true;
        }
      }
      if (panelType === "GraphManager") {
        const opened = await window.revealPathInGraphManager(cleanPath, {
          isDirectory,
          selectFile: false
        });
        if (opened) {
          navigationState.setLastFileSelectionPanelType?.("GraphManager");
          return true;
        }
      }
    } catch (err) {
      console.warn("[FileView] Failed to reveal linked path in " + panelType + ":", err);
    }
  }
  return false;
}

export function setPendingFileViewAnchor(path, hash) {
  if (!hash) {
    FileViewModuleState.pendingFileViewAnchor = null;
    if (FileViewModuleState.pendingFileViewAnchorTimer) {
      window.clearTimeout(FileViewModuleState.pendingFileViewAnchorTimer);
      FileViewModuleState.pendingFileViewAnchorTimer = null;
      incrementPerformanceCounter("FileView.pendingAnchorTimersCleared");
    }
    return;
  }
  FileViewModuleState.pendingFileViewAnchor = {
    path: normalizeResolvedNotebookPath(path),
    hash,
    attempts: 0
  };
}

export function findNamedAnchorInRoot(root, hash) {
  if (!root || typeof root.querySelectorAll !== "function") return null;
  for (const candidate of root.querySelectorAll("[name]")) {
    if (candidate.getAttribute("name") === hash) return candidate;
  }
  return null;
}

export function findAnchorTargetInRoot(root, hash) {
  if (!root || !hash) return null;
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const byId = doc?.getElementById?.(hash);
  if (byId && (root.nodeType === 9 || root.contains(byId))) return byId;
  return findNamedAnchorInRoot(root, hash);
}

export function scrollElementIntoView(target) {
  if (!target) return false;
  try {
    target.scrollIntoView({
      block: "start",
      inline: "nearest"
    });
  } catch {
    target.scrollIntoView?.();
  }
  return true;
}

export function scrollFileViewToAnchor(hash) {
  const cleanHash = decodeHashSafely(hash).trim();
  if (!cleanHash) return false;
  const viewPanel = getViewPanelElement();
  if (!viewPanel) return false;
  const target = findAnchorTargetInRoot(viewPanel, cleanHash);
  if (scrollElementIntoView(target)) return true;
  const iframes = viewPanel.querySelectorAll("iframe");
  for (const iframe of iframes) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      const iframeTarget = findAnchorTargetInRoot(doc, cleanHash);
      if (scrollElementIntoView(iframeTarget)) return true;
    } catch {
      // Cross-origin iframe documents cannot be inspected.
    }
  }
  return false;
}

export function tryScrollToPendingFileViewAnchor(renderedPath = getActiveFilePath()) {
  if (!FileViewModuleState.pendingFileViewAnchor) return;
  if (!sameNotebookPath(renderedPath, FileViewModuleState.pendingFileViewAnchor.path)) return;
  if (scrollFileViewToAnchor(FileViewModuleState.pendingFileViewAnchor.hash)) {
    FileViewModuleState.pendingFileViewAnchor = null;
    if (FileViewModuleState.pendingFileViewAnchorTimer) {
      window.clearTimeout(FileViewModuleState.pendingFileViewAnchorTimer);
      FileViewModuleState.pendingFileViewAnchorTimer = null;
    }
    return;
  }
  FileViewModuleState.pendingFileViewAnchor.attempts += 1;
  if (FileViewModuleState.pendingFileViewAnchor.attempts >= 10) {
    FileViewModuleState.pendingFileViewAnchor = null;
    return;
  }
  if (!FileViewModuleState.pendingFileViewAnchorTimer) {
    FileViewModuleState.pendingFileViewAnchorTimer = window.setTimeout(() => {
      FileViewModuleState.pendingFileViewAnchorTimer = null;
      tryScrollToPendingFileViewAnchor(renderedPath);
    }, 80);
  }
}
