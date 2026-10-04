// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/ResolveNotebookDocumentLink.mjs
// This module implements resolve Notebook Document Link behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { isUnsupportedLinkProtocol, normalizeResolvedNotebookPath, dirnamePath, decodeHashSafely, splitHrefParts, decodeUriSafely, stripNotebookLinkRoot, sameNotebookPath, uniqueValues } from "./RetainFileViewSelectionFollower.mjs";
import { getActiveFilePath } from "./ShowGraphLinkInFileView.mjs";
import { navigationState } from "./CancelScheduledSelectedFileViewRender.mjs";

// Resolve Notebook Document Link operations.
export function resolveNotebookDocumentLink(rawHref, sourcePath) {
  const href = String(rawHref || "").trim();
  if (!href || isUnsupportedLinkProtocol(href)) return null;
  const currentPath = normalizeResolvedNotebookPath(sourcePath || getActiveFilePath());
  const sourceDir = dirnamePath(currentPath);
  if (href.startsWith("#")) {
    return currentPath ? {
      path: currentPath,
      hash: decodeHashSafely(href.slice(1)),
      isDirectory: false,
      isSameDocumentAnchor: true
    } : null;
  }
  let pathPart = "";
  let hash = "";
  let isRootRelative = false;
  let explicitlyDirectory = false;
  if (/^https?:\/\//i.test(href)) {
    let parsed = null;
    try {
      parsed = new URL(href);
    } catch {
      return null;
    }
    if (parsed.origin !== window.location.origin) return null;
    const lowerPath = parsed.pathname.toLowerCase();
    if (!lowerPath.startsWith("/notebook/") && !lowerPath.startsWith("/php/") && !parsed.pathname.includes(".") && !parsed.pathname.endsWith("/")) {
      return null;
    }
    pathPart = parsed.pathname;
    hash = parsed.hash ? decodeHashSafely(parsed.hash.slice(1)) : "";
    isRootRelative = true;
    explicitlyDirectory = pathPart.endsWith("/");
  } else {
    const parts = splitHrefParts(href);
    pathPart = parts.path;
    hash = parts.hash;
    isRootRelative = pathPart.startsWith("/") || pathPart.toLowerCase().startsWith("notebook/") || pathPart.toLowerCase().startsWith("php/");
    explicitlyDirectory = pathPart.endsWith("/");
  }
  if (!pathPart) {
    return currentPath && hash ? {
      path: currentPath,
      hash,
      isDirectory: false,
      isSameDocumentAnchor: true
    } : null;
  }
  let candidate = decodeUriSafely(pathPart).replace(/\\/g, "/");
  if (candidate.startsWith("/")) {
    const lowerCandidate = candidate.toLowerCase();
    if (lowerCandidate.startsWith("/notebook/") || lowerCandidate.startsWith("/php/")) {
      candidate = stripNotebookLinkRoot(candidate);
    } else {
      const rootCandidate = candidate.replace(/^\/+/, "");
      if (!rootCandidate || !rootCandidate.includes(".") && !candidate.endsWith("/")) {
        return null;
      }
      candidate = rootCandidate;
    }
  } else if (isRootRelative) {
    candidate = stripNotebookLinkRoot(candidate);
  } else {
    candidate = sourceDir ? sourceDir + "/" + candidate : candidate;
  }
  const targetPath = normalizeResolvedNotebookPath(candidate).replace(/\/+$/, "");
  if (!targetPath) return null;
  return {
    path: targetPath,
    hash,
    isDirectory: explicitlyDirectory || !targetPath.includes("."),
    isSameDocumentAnchor: sameNotebookPath(targetPath, currentPath) && Boolean(hash)
  };
}

export function getAnchorFromClick(event) {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  for (const node of path) {
    if (!node || node.nodeType !== 1) continue;
    if (typeof node.matches === "function" && node.matches("a[href]")) return node;
    if (typeof node.closest === "function") {
      const anchor = node.closest("a[href]");
      if (anchor) return anchor;
    }
  }
  return event.target?.closest?.("a[href]") || null;
}

export function shouldHandleFileViewLinkClick(event) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function isNavigatorPanelOpen(panelType) {
  if (panelType === "FileManager") {
    return Boolean(document.getElementById("file-list") && typeof window.revealPathInFileManager === "function");
  }
  if (panelType === "GraphManager") {
    return Boolean(document.getElementById("cy") && typeof window.revealPathInGraphManager === "function");
  }
  return false;
}

export function getLinkNavigatorCandidates() {
  const selectionSource = navigationState.getLastFileSelectionPanelType?.();
  if (selectionSource) return [selectionSource];
  const activeInfoPanel = window.NodevisionState?.activePanelType;
  return uniqueValues([navigationState.getLastInfoPanelType?.(), activeInfoPanel === "FileManager" || activeInfoPanel === "GraphManager" ? activeInfoPanel : null, "FileManager", "GraphManager"]);
}
