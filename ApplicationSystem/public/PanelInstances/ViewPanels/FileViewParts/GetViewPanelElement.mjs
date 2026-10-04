// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/GetViewPanelElement.mjs
// This module implements get View Panel Element behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { activeFileViewRoot, claimFileViewHost, normalizeNotebookPath } from "./ShowGraphLinkInFileView.mjs";
import { FileViewModuleState, fileViewRootIsVisible } from "./CancelScheduledSelectedFileViewRender.mjs";
import { getFileViewCell } from "./ActivateFileViewPanel.mjs";
import { normalizeResolvedNotebookPath } from "./RetainFileViewSelectionFollower.mjs";
import { setStatus } from "/StatusBar.mjs";
import { loadModuleMap as loadSharedModuleMap } from "/PanelInstances/ModuleMapLoader.mjs";

// Get View Panel Element operations.
export function getViewPanelElement() {
  const activeRoot = activeFileViewRoot();
  if (activeRoot) return claimFileViewHost(activeRoot);
  if (FileViewModuleState.viewDivRef && document.body.contains(FileViewModuleState.viewDivRef) && (!window.__nvPanelTabContentIsActive || window.__nvPanelTabContentIsActive(FileViewModuleState.viewDivRef))) {
    return claimFileViewHost(FileViewModuleState.viewDivRef);
  }
  const cell = getFileViewCell();
  const fromCell = cell?.querySelector?.("#element-view, [data-nv-file-view-root=\"true\"]");
  if (fromCell && (!window.__nvPanelTabContentIsActive || window.__nvPanelTabContentIsActive(fromCell))) return claimFileViewHost(fromCell);
  const byId = document.getElementById("element-view");
  if (byId && (!window.__nvPanelTabContentIsActive || window.__nvPanelTabContentIsActive(byId))) return claimFileViewHost(byId);
  return null;
}

export function fileViewRootPath(viewDiv) {
  return normalizeNotebookPath(viewDiv?.dataset?.nvFileViewRenderedPath || viewDiv?.dataset?.currentFilePath || viewDiv?.closest?.(".nv-panel-tab-content")?.dataset?.currentFilePath || viewDiv?.closest?.(".panel-cell")?.dataset?.currentFilePath || "");
}

export function activeFileViewCanRefreshPath(path) {
  const targetPath = normalizeResolvedNotebookPath(path || "");
  if (!targetPath) return false;
  const activeRoot = activeFileViewRoot() || (fileViewRootIsVisible(FileViewModuleState.viewDivRef) ? FileViewModuleState.viewDivRef : null);
  if (!activeRoot) return false;
  const activePath = fileViewRootPath(activeRoot) || FileViewModuleState.lastRenderedPath;
  return Boolean(activePath && normalizeResolvedNotebookPath(activePath) === targetPath);
}

export function setFileViewStatus(message, detail = "") {
  try {
    setStatus(message, detail);
  } catch (err) {
    console.warn("[FileView] Failed to update status bar:", err);
  }
}

export async function loadModuleMap() {
  try {
    return await loadSharedModuleMap();
  } catch (err) {
    console.error("❌ Error loading ModuleMap.csv:", err);
    return {};
  }
}

export function stableModuleImportUrl(modulePath, queryName = "v") {
  if (typeof window !== "undefined") {
    if (!window.__nvModuleCacheBust) window.__nvModuleCacheBust = Date.now();
    const separator = modulePath.includes("?") ? "&" : "?";
    return modulePath + separator + queryName + "=" + window.__nvModuleCacheBust;
  }
  return modulePath;
}

export function resolveExtension(filename) {
  const raw = String(filename || "").trim();
  if (!raw) return "";
  const readExtensionFromPathLike = (pathLike = "") => {
    const clean = String(pathLike || "").trim().replace(/\\/g, "/").replace(/[?#].*$/, "");
    if (!clean) return "";
    if (clean.endsWith(".NodevisionSession.js") || clean.endsWith(".NodevisionSession")) return "nodevisionsession";
    if (clean.toLowerCase().endsWith(".nodevisionsession.js") || clean.toLowerCase().endsWith(".nodevisionsession")) return "";
    const lower = clean.toLowerCase().replace(/%2e/gi, ".");
    if (lower.endsWith(".alto.xml")) return "alto";
    if (lower.endsWith(".musicxml.xml")) return "musicxml"; // future-proofing
    if (lower.endsWith(".td.json")) return "td.json";
    if (lower.endsWith(".terrain.json")) return "terrain.json";
    if (lower.endsWith(".tar.gz")) return "tar.gz"; // optional

    const lastSegment = lower.split("/").pop() || lower;
    if (lastSegment.includes(".")) {
      const token = (lastSegment.split(".").pop() || "").trim().toLowerCase();
      const sanitized = token.replace(/[^a-z0-9_+-]/g, "");
      if (sanitized) return sanitized;
    }
    if (/\.ico(?=$|[^a-z0-9_+-])/i.test(lower)) return "ico";
    return "";
  };
  const candidates = [];
  const pushCandidate = value => {
    if (!value) return;
    const text = String(value).trim();
    if (!text) return;
    candidates.push(text);
    try {
      const decoded = decodeURIComponent(text);
      if (decoded && decoded !== text) candidates.push(decoded);
    } catch {
      // Keep undecoded candidate only.
    }
  };
  pushCandidate(raw);
  try {
    const parsed = new URL(raw, window.location.origin);
    pushCandidate(parsed.pathname || "");
    ["path", "file", "filename", "filepath", "selectedFilePath"].forEach(key => pushCandidate(parsed.searchParams.get(key) || ""));
    for (const value of parsed.searchParams.values()) {
      pushCandidate(value);
    }
  } catch {
    const [withoutHash] = raw.split("#");
    const [pathPart, queryPart = ""] = withoutHash.split("?");
    pushCandidate(pathPart);
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      ["path", "file", "filename", "filepath", "selectedFilePath"].forEach(key => pushCandidate(params.get(key) || ""));
      for (const value of params.values()) {
        pushCandidate(value);
      }
    }
  }
  for (const candidate of [...new Set(candidates)]) {
    const ext = readExtensionFromPathLike(candidate);
    if (ext) return ext;
  }
  return "";
}

export function fileViewActivePanelElement(cell) {
  const activeTabContent = cell?.querySelector?.(".nv-panel-tab-content:not([hidden])");
  return activeTabContent?.querySelector?.(".panel") || activeTabContent || cell?.querySelector?.(".panel") || cell || null;
}
