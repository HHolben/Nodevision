// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspaceModeLayouts.mjs
// This module materializes specialized Nodevision editor mode layouts around the active editor cell.

import { highlightActiveCell } from "./workspaceActivePanels.mjs";
import { makePanelCell } from "./workspaceCells.mjs";
import { loadPanelIntoSpecificCell } from "./workspacePanelLoader.mjs";
import { rebuildLayoutDividersForContainer } from "./workspaceDividers.mjs";
import { createPanelRow, normalizePanelIdentifier, resolvePanelCell, setCellIdentity } from "./workspacePrimitives.mjs";

async function importModeLayout({ userModulePath, defaultModulePath, fallbackModulePaths = [] }) {
  const cacheBust = Date.now();
  const candidates = [userModulePath, defaultModulePath, ...fallbackModulePaths].filter(Boolean);
  let lastError = null;
  for (const candidate of candidates) {
    try {
      const mod = await import(`${candidate}${candidate.includes("?") ? "&" : "?"}v=${cacheBust}`);
      const layout = mod.default || mod.layout || mod.SVG_EDITOR_MODE_LAYOUT || mod.MID_EDITOR_MODE_LAYOUT || mod.HANDWRITING_OCR_MODE_LAYOUT || mod.GIF_EDITOR_MODE_LAYOUT;
      if (layout) return layout;
    } catch (err) {
      lastError = err;
      console.warn(`Mode layout import failed: ${candidate}`, err);
    }
  }
  if (lastError) throw lastError;
  return null;
}

function findExistingModeCell(id, excludeCell = null) {
  const normalizedId = normalizePanelIdentifier(id) || id;
  if (!normalizedId) return null;
  return Array.from(document.querySelectorAll(".panel-cell")).find((cell) => cell !== excludeCell && !cell.contains(excludeCell) && (cell.dataset?.id === normalizedId || cell.dataset?.panelId === normalizedId)) || null;
}

function findReplacementContainer(editorCell) {
  const parent = editorCell?.parentElement;
  if (!parent) return null;
  const modeRoot = editorCell.closest?.(".panel-row[data-nv-mode-layout-id]");
  if (modeRoot) return modeRoot;
  if (parent.classList?.contains?.("panel-row") && parent.dataset?.nvModeLayoutId) return parent;
  const rowWithFileManager = editorCell.closest?.(".panel-row") || parent;
  return rowWithFileManager?.classList?.contains?.("panel-row") ? rowWithFileManager : editorCell;
}

async function materializeModeLayoutNode(node, { editorCell, cellsById, panelsToLoad }) {
  if (!node) return null;
  const direction = node.direction || (node.type === "column" || node.type === "vertical" ? "column" : null);
  const isContainer = direction || node.type === "row" || node.type === "vertical" || node.children;
  if (isContainer && node.children) {
    const row = createPanelRow(direction === "column" ? "column" : "row", node.flex || "1 1 auto");
    if (node.id) row.dataset.id = node.id;
    for (const child of node.children) {
      const childEl = await materializeModeLayoutNode(child, { editorCell, cellsById, panelsToLoad });
      if (childEl) row.appendChild(childEl);
    }
    rebuildLayoutDividersForContainer(row, row.dataset.direction === "column");
    return row;
  }
  if (node.role === "activeEditor") {
    setCellIdentity(editorCell, { id: node.id || editorCell.dataset?.id || "GraphicalEditor", panelClass: node.panelClass || "EditorPanel", flex: node.flex || "1 1 auto" });
    return editorCell;
  }
  const id = normalizePanelIdentifier(node.id || node.panelType || node.instanceName) || node.id || node.panelType || node.instanceName;
  let cell = cellsById.get(id) || findExistingModeCell(id, editorCell) || makePanelCell(node.flex || "1 1 0");
  cellsById.set(id, cell);
  setCellIdentity(cell, { id, panelClass: node.panelClass || "InfoPanel", flex: node.flex || "1 1 0" });
  const panelType = normalizePanelIdentifier(node.panelType || node.instanceName || id) || node.panelType || node.instanceName || id;
  if (!cell.isConnected || node.forceReload || !cell.childElementCount) {
    panelsToLoad.push({ cell, panelType, panelVars: { id, displayName: node.displayName || id, ...(node.panelVars || {}) } });
  }
  return cell;
}

function cloneModeLayoutWithPanelVars(layout, panelId, panelVars = {}) {
  const normalizedTarget = normalizePanelIdentifier(panelId) || panelId;
  if (!layout || !panelVars || !Object.keys(panelVars).length) return layout;
  const cloneNode = (node) => {
    if (!node || typeof node !== "object") return node;
    const clone = { ...node };
    if (Array.isArray(node.children)) clone.children = node.children.map(cloneNode);
    const nodeId = normalizePanelIdentifier(node.id || node.panelType || node.instanceName) || node.id || node.panelType || node.instanceName;
    const nodePanelType = normalizePanelIdentifier(node.panelType || node.instanceName) || node.panelType || node.instanceName;
    if (nodeId === normalizedTarget || nodePanelType === normalizedTarget) {
      clone.forceReload = true;
      clone.panelVars = { ...(node.panelVars || {}), ...panelVars };
    }
    return clone;
  };
  return cloneNode(layout);
}

export async function ensureEditorModeLayout({ editorCell, layout, modeId = layout?.id || "EditorMode", preserveExistingPanelIds = [] } = {}) {
  const cell = resolvePanelCell(editorCell || window.activeCell);
  if (!cell || !layout?.children?.length) return null;
  const replacementTarget = findReplacementContainer(cell);
  const targetParent = replacementTarget?.parentElement;
  if (!replacementTarget || !targetParent) return null;
  const existingCells = new Map();
  Array.from(document.querySelectorAll(".panel-cell")).forEach((candidate) => {
    const id = candidate.dataset?.id || candidate.dataset?.panelId;
    if (id && candidate !== cell && !candidate.contains(cell)) existingCells.set(id, candidate);
  });
  const panelsToLoad = [];
  const root = await materializeModeLayoutNode(layout, { editorCell: cell, cellsById: existingCells, panelsToLoad });
  if (!root) return null;
  root.dataset.nvModeLayoutId = modeId;
  let rootToInsert = root;
  const preserveIds = new Set((preserveExistingPanelIds || []).map((id) => normalizePanelIdentifier(id) || id).filter(Boolean));
  const preservedCells = preserveIds.size ? Array.from(replacementTarget.querySelectorAll?.(".panel-cell") || []).filter((candidate) => preserveIds.has(normalizePanelIdentifier(candidate.dataset?.id || candidate.dataset?.panelId) || candidate.dataset?.id || candidate.dataset?.panelId) && candidate !== cell && !root.contains(candidate)) : [];
  if (preservedCells.length) {
    const wrapper = createPanelRow("row", replacementTarget.style?.flex || root.style.flex || "1 1 auto");
    wrapper.dataset.nvModeLayoutId = modeId;
    delete root.dataset.nvModeLayoutId;
    preservedCells.forEach((preservedCell) => wrapper.appendChild(preservedCell));
    wrapper.appendChild(root);
    rebuildLayoutDividersForContainer(wrapper, false);
    rootToInsert = wrapper;
  }
  if (replacementTarget === cell) {
    const marker = document.createComment(`Nodevision ${modeId} insertion point`);
    targetParent.replaceChild(marker, cell);
    targetParent.replaceChild(rootToInsert, marker);
  } else targetParent.replaceChild(rootToInsert, replacementTarget);
  rebuildLayoutDividersForContainer(root, root.dataset.direction === "column");
  rebuildLayoutDividersForContainer(rootToInsert, rootToInsert.dataset.direction === "column");
  rebuildLayoutDividersForContainer(targetParent);
  for (const panel of panelsToLoad) await loadPanelIntoSpecificCell(panel.cell, panel.panelType, panel.panelVars);
  window.activeCell = cell;
  highlightActiveCell(cell);
  return { root, editorCell: cell, cellsById: existingCells };
}

async function ensureNamedModeLayout(name, editorCell, options = {}) {
  const layout = await importModeLayout(options);
  return ensureEditorModeLayout({ editorCell, layout, modeId: layout?.id || name, preserveExistingPanelIds: options.preserveExistingPanelIds || [] });
}

export const ensureSvgEditorModeLayout = ({ editorCell } = {}) => ensureNamedModeLayout("SVGEditorMode", editorCell, { userModulePath: "/UserSettings/ModeLayouts/SVGEditorMode.mjs", defaultModulePath: "/Layouts/ModeLayouts/DefualtSVGEditorMode.mjs" });
export const ensureMidEditorModeLayout = ({ editorCell } = {}) => ensureNamedModeLayout("MidEditorMode", editorCell, { userModulePath: "/UserSettings/ModeLayouts/MidEditorMode.mjs", defaultModulePath: "/Layouts/ModeLayouts/MidEditorMode.mjs" });
export const ensureScadEditorModeLayout = ({ editorCell } = {}) => ensureNamedModeLayout("ScadEditorMode", editorCell, { userModulePath: "/UserSettings/ModeLayouts/ScadEditorMode.mjs", defaultModulePath: "/Layouts/ModeLayouts/ScadEditorMode.mjs", preserveExistingPanelIds: ["FileManager"] });
export const ensureGifEditorModeLayout = ({ editorCell } = {}) => ensureNamedModeLayout("GifEditorMode", editorCell, { userModulePath: "/UserSettings/ModeLayouts/GifEditorMode.mjs", defaultModulePath: "/Layouts/ModeLayouts/GifEditorMode.mjs", preserveExistingPanelIds: ["FileManager"] });
export const ensureKMLViewerModeLayout = ({ viewerCell } = {}) => ensureNamedModeLayout("KMLviewerMode", viewerCell, { userModulePath: "/UserSettings/ModeLayouts/KMLviewerMode.mjs", defaultModulePath: "/Layouts/ModeLayouts/KMLviewerMode.mjs" });
export const ensureKMLEditingModeLayout = ({ editorCell } = {}) => ensureNamedModeLayout("KMLeditorMode", editorCell, { userModulePath: "/UserSettings/ModeLayouts/KMLeditorMode.mjs", defaultModulePath: "/Layouts/ModeLayouts/KMLeditorMode.mjs", fallbackModulePaths: ["/UserSettings/ModeLayouts/KMLeditingMode.mjs"] });
export const ensureKMLEditorModeLayout = (options = {}) => ensureKMLEditingModeLayout(options);

export async function ensureHandwritingOcrModeLayout({ editorCell, panelVars = {} } = {}) {
  const layout = await importModeLayout({ userModulePath: "/UserSettings/ModeLayouts/HandwritingOcrMode.mjs", defaultModulePath: "/Layouts/ModeLayouts/HandwritingOcrMode.mjs" });
  const layoutWithVars = cloneModeLayoutWithPanelVars(layout, "HandwritingOcrPanel", panelVars);
  return ensureEditorModeLayout({ editorCell, layout: layoutWithVars, modeId: layoutWithVars?.id || "HandwritingOcrMode" });
}
