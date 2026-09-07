// Nodevision/ApplicationSystem/public/panels/panelTabMetadata.mjs
// This module builds compact panel tab labels and stable content-session identities for Nodevision workspace panels. It keeps display names separate from full resource identities so panel tabs can stay small while still distinguishing files, tools, and future content sessions.

export const PANEL_TAB_ORIENTATIONS = Object.freeze(["top", "bottom", "left", "right"]);

const CONTENT_LABELS = Object.freeze({
  FileView: "File Viewer",
  FileViewer: "File Viewer",
  GraphicalEditor: "Graphical Editor",
  CodeEditor: "Code Editor",
  CodeEditorPanel: "Code Editor",
  SVGEditor: "SVG Editor",
  SVGeditor: "SVG Editor",
  GraphManager: "Graph View",
  FileManager: "File Manager",
  GameView: "Virtual World",
  NodevisionConsole: "Console",
});

const FILE_BACKED_PANEL_TYPES = new Set([
  "FileView",
  "FileViewer",
  "GraphicalEditor",
  "CodeEditor",
  "CodeEditorPanel",
  "SVGEditor",
  "SVGeditor",
  "GameView",
]);

export function normalizeTabOrientation(value = "top") {
  const clean = String(value || "").trim().toLowerCase();
  return PANEL_TAB_ORIENTATIONS.includes(clean) ? clean : "top";
}

export function normalizeNotebookPath(value = "") {
  let cleaned = String(value || "").trim();
  if (!cleaned) return "";
  try {
    const origin = typeof window !== "undefined" ? window.location?.origin : "http://localhost";
    const parsed = new URL(cleaned, origin || "http://localhost");
    cleaned = parsed.pathname || cleaned;
  } catch {
    // Non-URL values are already path-like.
  }
  cleaned = cleaned
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "");
  if (cleaned.toLowerCase().startsWith("notebook/")) cleaned = cleaned.slice("Notebook/".length);
  return cleaned.replace(/\/+/g, "/").trim();
}

export function panelContentLabel(panelType = "") {
  const clean = String(panelType || "").trim();
  if (CONTENT_LABELS[clean]) return CONTENT_LABELS[clean];
  return clean
    .replace(/Panel$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim() || "Panel";
}

function compactResourceName(resourcePath = "", fallback = "") {
  const clean = normalizeNotebookPath(resourcePath || fallback);
  if (!clean) return "";
  return clean.split("/").filter(Boolean).pop() || clean;
}

function activePanelLooksLikeEditor() {
  if (typeof window === "undefined") return false;
  const activePanel = String(window.activePanel || "").toLowerCase();
  const activePanelClass = String(window.activePanelClass || "").toLowerCase();
  return activePanel.includes("codeeditor") ||
    activePanelClass === "editorpanel";
}

function editorResourcePathCandidates(state = {}) {
  const activeEditorCandidates = [
    state.activeEditorFilePath,
    window.__nvCodeEditorActivePath,
    window.__nvMarkdownActivePath,
    window.__nvWysiwygActivePath,
    window.__nvHtmlEditorActivePath,
    window.__nvSvgEditorActivePath,
  ];
  const selectedCandidates = [
    window.selectedFilePath,
    state.selectedFile,
  ];
  const renderedCandidates = [
    window.currentActiveFilePath,
    state.activeFileViewPath,
    window.ActiveNode,
    window.filePath,
  ];
  return activePanelLooksLikeEditor()
    ? [...activeEditorCandidates, ...renderedCandidates, ...selectedCandidates]
    : [...selectedCandidates, ...activeEditorCandidates, ...renderedCandidates];
}

function firstResourcePath(panelVars = {}, panelType = "") {
  const explicitPath = normalizeNotebookPath(
    panelVars.filePath ||
    panelVars.path ||
    panelVars.resourcePath ||
    panelVars.currentDirectory ||
    ""
  );
  if (explicitPath) return explicitPath;
  if (!FILE_BACKED_PANEL_TYPES.has(panelType) || typeof window === "undefined") return "";
  const state = window.NodevisionState || {};
  const candidates = panelType === "CodeEditor" || panelType === "CodeEditorPanel" || panelType === "GraphicalEditor"
    ? editorResourcePathCandidates(state)
    : [
        state.activeFileViewPath,
        window.currentActiveFilePath,
        window.selectedFilePath,
        state.selectedFile,
        state.activeEditorFilePath,
        window.ActiveNode,
        window.filePath,
      ];
  for (const candidate of candidates) {
    const normalized = normalizeNotebookPath(candidate);
    if (normalized) return normalized;
  }
  return "";
}

function objectNameForPanel(panelType, panelVars = {}) {
  if (panelVars.objectName) return String(panelVars.objectName);
  if (panelVars.displayName && panelVars.displayName !== panelType) return String(panelVars.displayName);
  if (panelType === "GraphManager") return "Notebook";
  return "";
}

export function buildPanelTabMetadata({ panelType, panelClass = "", panelVars = {}, tabId = "" } = {}) {
  const cleanType = String(panelType || "").trim() || "Panel";
  const contentName = panelContentLabel(cleanType);
  const resourcePath = firstResourcePath(panelVars, cleanType);
  const objectName = objectNameForPanel(cleanType, panelVars);
  const shortName = compactResourceName(resourcePath, objectName);
  const displayName = shortName ? `${contentName}: ${shortName}` : contentName;
  const fullDisplayName = resourcePath ? `${contentName}: ${resourcePath}` : displayName;
  const identityParts = [
    cleanType,
    normalizeNotebookPath(resourcePath || objectName || panelVars.id || ""),
    String(panelVars.mode || panelVars.renderMode || panelVars.editorMode || ""),
  ];
  return {
    tabId,
    panelType: cleanType,
    panelClass: String(panelClass || "InfoPanel"),
    resourcePath,
    displayName,
    fullDisplayName,
    identityKey: identityParts.map((part) => String(part || "").toLowerCase()).join("::"),
  };
}

export function refreshPanelTabMetadata(tab, cell = null) {
  if (!tab) return tab;
  const contentPath = normalizeNotebookPath(tab.contentElement?.dataset?.currentFilePath || "");
  const cellPath = normalizeNotebookPath(cell?.dataset?.currentFilePath || "");
  const resourcePath = contentPath || cellPath || tab.resourcePath || "";
  if (!resourcePath) return tab;
  const contentName = panelContentLabel(tab.panelType);
  tab.resourcePath = resourcePath;
  tab.displayName = `${contentName}: ${compactResourceName(resourcePath)}`;
  tab.fullDisplayName = `${contentName}: ${resourcePath}`;
  tab.identityKey = [tab.panelType, resourcePath, tab.panelVars?.mode || tab.panelVars?.renderMode || ""]
    .map((part) => String(part || "").toLowerCase())
    .join("::");
  tab.panelVars = { ...(tab.panelVars || {}), filePath: resourcePath };
  return tab;
}

export function serializePanelTab(tab) {
  return {
    tabId: tab.tabId,
    panelType: tab.panelType,
    panelClass: tab.panelClass,
    panelVars: { ...(tab.panelVars || {}), filePath: tab.resourcePath || tab.panelVars?.filePath || null },
    displayName: tab.displayName,
    fullDisplayName: tab.fullDisplayName,
    resourcePath: tab.resourcePath || "",
  };
}
