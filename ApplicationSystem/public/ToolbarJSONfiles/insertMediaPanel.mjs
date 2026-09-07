// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaPanel.mjs
// Creates the Insert Media floating panel and preserves the workspace cell that invoked it.

import { createPanelDOM } from "/panels/panelFactory.mjs";

const ORIGIN_CONTEXT_KEY = "__nvInsertMediaOriginContext";
let originCellSequence = 0;

function normalizeIdPart(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "media";
}

function normalizeNotebookPath(value = "") {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/, "");
}

function asPanelCell(candidate) {
  if (candidate?.classList?.contains?.("panel-cell")) return candidate;
  return candidate?.closest?.(".panel-cell") || null;
}

function activeTabForCell(cell) {
  const state = cell?.__nvPanelTabs || null;
  return state?.tabs?.find?.((tab) => tab.tabId === state.activeTabId) || null;
}

function tabListForCell(cell) {
  return Array.from(cell?.__nvPanelTabs?.tabs || []);
}

function panelTypeForCell(cell) {
  const activeTab = activeTabForCell(cell);
  return String(activeTab?.panelType || cell?.dataset?.id || cell?.dataset?.panelId || "");
}

function panelClassForCell(cell) {
  const activeTab = activeTabForCell(cell);
  return String(activeTab?.panelClass || cell?.dataset?.panelClass || "");
}

function pathForCell(cell) {
  const activeTab = activeTabForCell(cell);
  return normalizeNotebookPath(
    activeTab?.resourcePath ||
    activeTab?.panelVars?.filePath ||
    activeTab?.contentElement?.dataset?.currentFilePath ||
    cell?.dataset?.currentFilePath ||
    ""
  );
}

function candidateEditorPaths() {
  const state = window.NodevisionState || {};
  return [
    state.activeEditorFilePath,
    window.__nvCodeEditorActivePath,
    window.__nvMarkdownActivePath,
    window.__nvWysiwygActivePath,
    window.__nvHtmlEditorActivePath,
    window.__nvSvgEditorActivePath,
    window.VRWorldContext?.currentWorldPath,
    window.currentActiveFilePath,
    window.selectedFilePath,
    state.selectedFile,
    state.activeFileViewPath,
    window.ActiveNode,
    window.filePath,
  ].map(normalizeNotebookPath).filter(Boolean);
}

function preferredPanelTypesForMode(mode = "") {
  const lower = String(mode || "").toLowerCase();
  if (lower.includes("virtual world") || lower.includes("vr world")) return new Set(["GameView"]);
  if (lower.includes("code")) return new Set(["CodeEditor", "CodeEditorPanel"]);
  if (lower.includes("svg")) return new Set(["GraphicalEditor", "SVGEditor", "SVGeditor"]);
  if (lower.includes("editing") || lower.includes("graphical") || lower.includes("html")) {
    return new Set(["GraphicalEditor", "SVGEditor", "SVGeditor"]);
  }
  return new Set(["GraphicalEditor", "CodeEditor", "CodeEditorPanel", "GameView", "SVGEditor", "SVGeditor"]);
}

function cellHasPanelType(cell, panelType) {
  const expected = String(panelType || "");
  if (!cell || !expected) return false;
  if (panelTypeForCell(cell) === expected) return true;
  return tabListForCell(cell).some((tab) => String(tab.panelType || tab.panelId || tab.id || "") === expected);
}

export function isInsertMediaBrowserCell(cell) {
  return cellHasPanelType(cell, "WebResourceBrowserPanel");
}

function cellLooksLikeInsertMediaTarget(cell, preferredTypes) {
  if (!cell?.isConnected || !cell.classList?.contains?.("panel-cell")) return false;
  if (isInsertMediaBrowserCell(cell)) return false;
  const type = panelTypeForCell(cell);
  const klass = panelClassForCell(cell).toLowerCase();
  return preferredTypes.has(type) || klass === "editorpanel" || type === "GameView";
}

function scoreOriginCell(cell, { targetMode = "", originEditorPath = "" } = {}) {
  if (!cellLooksLikeInsertMediaTarget(cell, preferredPanelTypesForMode(targetMode))) return -1;
  let score = 1;
  const type = panelTypeForCell(cell);
  const preferredTypes = preferredPanelTypesForMode(targetMode);
  if (preferredTypes.has(type)) score += 30;
  if (activeTabForCell(cell)) score += 10;
  const path = pathForCell(cell);
  const targetPath = normalizeNotebookPath(originEditorPath);
  if (targetPath && path && path === targetPath) score += 50;
  if (!targetPath && path && candidateEditorPaths().includes(path)) score += 20;
  if (asPanelCell(window.activeCell) === cell) score += 15;
  const rect = typeof cell.getBoundingClientRect === "function" ? cell.getBoundingClientRect() : null;
  if (rect && rect.width > 0 && rect.height > 0) score += 5;
  return score;
}

function findBestOriginCell({ originCell = null, targetMode = "", originEditorPath = "" } = {}) {
  const candidates = [];
  const push = (candidate) => {
    const cell = asPanelCell(candidate);
    if (cell && !candidates.includes(cell)) candidates.push(cell);
  };

  push(originCell);
  push(window.HTMLWysiwygTools?.getEditorElement?.());
  push(window.activeCell);
  push(document.querySelector?.(".panel-cell.active-panel"));
  document.querySelectorAll?.(".panel-cell")?.forEach?.(push);

  return candidates
    .map((cell) => ({ cell, score: scoreOriginCell(cell, { targetMode, originEditorPath }) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.cell || null;
}

export function ensureInsertMediaOriginCellId(cell) {
  const panelCell = asPanelCell(cell);
  if (!panelCell) return "";
  if (!panelCell.dataset.nvWorkspaceCellId) {
    originCellSequence += 1;
    panelCell.dataset.nvWorkspaceCellId = "workspace-cell-" + Date.now().toString(36) + "-" + originCellSequence.toString(36);
  }
  return panelCell.dataset.nvWorkspaceCellId;
}

export function snapshotInsertMediaOriginContext(cell, overrides = {}) {
  const originCell = asPanelCell(cell);
  const originCellId = ensureInsertMediaOriginCellId(originCell);
  const activeTab = activeTabForCell(originCell);
  return {
    originCellId,
    originTabId: String(overrides.originTabId || activeTab?.tabId || originCell?.dataset?.currentPanelTabId || ""),
    originPanelType: String(overrides.originPanelType || panelTypeForCell(originCell) || ""),
    originPanelClass: String(overrides.originPanelClass || panelClassForCell(originCell) || ""),
    originEditorPath: normalizeNotebookPath(overrides.originEditorPath || pathForCell(originCell) || candidateEditorPaths()[0] || ""),
    targetMode: String(overrides.targetMode || window.NodevisionState?.currentMode || ""),
    mediaFamily: String(overrides.mediaFamily || overrides.familyKey || ""),
  };
}

export function captureInsertMediaOriginContext(options = {}) {
  const targetMode = options.targetMode || window.NodevisionState?.currentMode || "";
  const originEditorPath = normalizeNotebookPath(options.originEditorPath || candidateEditorPaths()[0] || "");
  const originCell = findBestOriginCell({
    originCell: options.originCell,
    targetMode,
    originEditorPath,
  });
  const context = snapshotInsertMediaOriginContext(originCell, {
    ...options,
    targetMode,
    originEditorPath,
  });
  context.originCell = originCell || null;
  return context;
}

export function attachInsertMediaOriginContext(target, context = {}) {
  if (!target) return context || null;
  const normalized = { ...(context || {}) };
  if (normalized.originCell) ensureInsertMediaOriginCellId(normalized.originCell);
  target[ORIGIN_CONTEXT_KEY] = normalized;
  if (target.dataset) {
    if (normalized.originCellId) target.dataset.nvInsertMediaOriginCellId = normalized.originCellId;
    if (normalized.originTabId) target.dataset.nvInsertMediaOriginTabId = normalized.originTabId;
    if (normalized.originPanelType) target.dataset.nvInsertMediaOriginPanelType = normalized.originPanelType;
    if (normalized.originEditorPath) target.dataset.nvInsertMediaOriginEditorPath = normalized.originEditorPath;
    if (normalized.targetMode) target.dataset.nvInsertMediaOriginTargetMode = normalized.targetMode;
  }
  return normalized;
}

export function getInsertMediaOriginContext(target) {
  const direct = target?.[ORIGIN_CONTEXT_KEY] || null;
  const panel = target?.closest?.(".panel") || null;
  return direct || panel?.[ORIGIN_CONTEXT_KEY] || null;
}

export function resolveInsertMediaOriginCell(context = {}) {
  const liveCell = asPanelCell(context.originCell);
  if (liveCell?.isConnected && (!context.originCellId || liveCell.dataset?.nvWorkspaceCellId === context.originCellId)) return liveCell;
  if (context.originCellId) {
    const escaped = globalThis.CSS?.escape ? CSS.escape(context.originCellId) : String(context.originCellId).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    const byId = document.querySelector?.(`.panel-cell[data-nv-workspace-cell-id="${escaped}"]`);
    if (byId) return byId;
  }
  return findBestOriginCell({
    targetMode: context.targetMode,
    originEditorPath: context.originEditorPath,
  });
}

export function describeInsertMediaOriginCell(cell) {
  const panelCell = asPanelCell(cell);
  if (!panelCell) return { cellId: "", panelType: "", tabList: [], activeTab: "", path: "", rect: null, ancestry: [] };
  const rect = typeof panelCell.getBoundingClientRect === "function" ? panelCell.getBoundingClientRect() : null;
  const activeTab = activeTabForCell(panelCell);
  const ancestry = [];
  let node = panelCell;
  while (node) {
    const name = node.id ? `#${node.id}` : String(node.className || node.tagName || "node");
    ancestry.push(name);
    if (node.id === "workspace") break;
    node = node.parentElement;
  }
  return {
    cellId: ensureInsertMediaOriginCellId(panelCell),
    panelType: panelTypeForCell(panelCell),
    panelClass: panelClassForCell(panelCell),
    tabList: tabListForCell(panelCell).map((tab) => tab.panelType || tab.panelId || tab.id || ""),
    activeTab: activeTab?.panelType || "",
    path: pathForCell(panelCell),
    rect: rect ? {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    } : null,
    ancestry,
  };
}

export async function openInsertMediaPanel(title, familyKey = "", options = {}) {
  const originContext = options.originContext || captureInsertMediaOriginContext({
    familyKey,
    mediaFamily: familyKey,
    originEditorPath: options.originEditorPath,
    targetMode: options.targetMode,
    originCell: options.originCell,
  });
  const originCell = resolveInsertMediaOriginCell(originContext);
  if (originCell) {
    originContext.originCell = originCell;
    Object.assign(originContext, snapshotInsertMediaOriginContext(originCell, originContext));
  }

  const idPart = normalizeIdPart(familyKey || title);
  const instanceId = `nv-insert-media-${idPart}-panel`;
  const existing = document.querySelector(`.panel[data-instance-id="${instanceId}"]`);
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  const panelInst = await createPanelDOM(
    "InsertMediaFormPanel",
    instanceId,
    "GenericPanel",
    { displayName: title || "Insert Media" }
  );

  document.body.appendChild(panelInst.panel);
  panelInst.panel.__nvDefaultDockCell = originCell || null;
  attachInsertMediaOriginContext(panelInst.panel, originContext);

  if (panelInst.dockBtn && typeof panelInst.dockBtn.click === "function") {
    try {
      panelInst.dockBtn.dispatchEvent(new MouseEvent("click", { bubbles: false, cancelable: true, view: window }));
    } catch {
      panelInst.dockBtn.click();
    }
  }

  panelInst.panel.style.width = "min(620px, 92vw)";
  panelInst.panel.style.height = "auto";
  panelInst.panel.style.maxHeight = "min(700px, 82vh)";
  panelInst.panel.style.left = `${Math.max(20, Math.round(window.innerWidth * 0.2))}px`;
  panelInst.panel.style.top = `${Math.max(20, Math.round(window.innerHeight * 0.15))}px`;
  panelInst.panel.style.zIndex = "23000";
  panelInst.panel.style.pointerEvents = "auto";

  panelInst.content.style.padding = "10px";
  panelInst.content.style.background = "#f8f8f8";
  panelInst.content.style.overflow = "auto";
  panelInst.content.innerHTML = "";

  const topRow = document.createElement("div");
  topRow.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-bottom:8px;";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.style.cssText = "font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;";
  close.addEventListener("click", () => {
    if (panelInst.panel.parentNode) panelInst.panel.parentNode.removeChild(panelInst.panel);
  });

  topRow.appendChild(close);

  const mount = document.createElement("div");
  attachInsertMediaOriginContext(mount, originContext);
  panelInst.content.appendChild(topRow);
  panelInst.content.appendChild(mount);

  return { panelEl: panelInst.panel, body: panelInst.content, mount, closeBtn: close, originContext };
}
