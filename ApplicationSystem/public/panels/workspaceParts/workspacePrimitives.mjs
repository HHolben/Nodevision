// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspacePrimitives.mjs
// This module defines panel identifiers, flex allocation helpers, and DOM primitives shared by Nodevision workspace layout modules.

const PANEL_ALIASES = Object.freeze({ ViewPanel: "FileView", FileViewer: "FileView", FileViewerPanel: "FileView", CodeEditorPanel: "CodeEditor" });

export function normalizePanelIdentifier(value) {
  const raw = String(value || "").trim();
  return raw ? PANEL_ALIASES[raw] || raw : raw;
}

export function toPanelCssSlug(value) {
  return String(value || "panel").trim().replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "panel";
}

export function toFlexValue(value) {
  if (value === undefined || value === null || value === "") return "";
  const raw = String(value).trim();
  return raw && !/\s/.test(raw) ? `${raw} 1 0` : raw;
}

export function numericFlexPart(value) {
  const n = Number.parseFloat(String(value || ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function flexAllocationWeight(element, axis = "row") {
  const raw = String(element?.style?.flex || "").trim();
  if (raw) {
    const parts = raw.split(/\s+/);
    const grow = numericFlexPart(parts[0]);
    if (grow) return grow;
    const percent = raw.match(/(?:^|\s|calc\()([0-9]+(?:\.[0-9]+)?)%/);
    if (percent) return numericFlexPart(percent[1]);
    const px = raw.match(/(?:^|\s)([0-9]+(?:\.[0-9]+)?)px(?:\s|$|\))/);
    if (px) return numericFlexPart(px[1]);
  }
  const rect = typeof element?.getBoundingClientRect === "function" ? element.getBoundingClientRect() : null;
  return numericFlexPart(axis === "column" ? rect?.height : rect?.width) || 1;
}

export function setProportionalFlex(element, weight) {
  if (!element?.style) return;
  element.style.flex = `${Math.max(0.001, Number(weight) || 1)} 1 0px`;
  element.style.minWidth = "0";
  element.style.minHeight = "0";
}

export function directLayoutChildren(container) {
  return Array.from(container?.children || []).filter((child) => child.classList?.contains?.("panel-cell") || child.classList?.contains?.("panel-row"));
}

export function normalizeSiblingFlexAllocations(container, axis = "row") {
  const children = directLayoutChildren(container);
  children.forEach((child) => setProportionalFlex(child, flexAllocationWeight(child, axis)));
  return children;
}

export function collectPanelCells(root) {
  if (!root) return [];
  if (root.classList?.contains("panel-cell")) return [root];
  return Array.from(root.querySelectorAll?.(".panel-cell") || []);
}

export function resolvePanelCell(candidate) {
  if (candidate?.classList?.contains?.("panel-cell")) return candidate;
  return candidate?.closest?.(".panel-cell") || null;
}

export function setCellIdentity(cell, { id, panelClass = "InfoPanel", flex = null } = {}) {
  if (!cell) return cell;
  const normalizedId = normalizePanelIdentifier(id) || id;
  if (normalizedId) {
    cell.dataset.id = normalizedId;
    cell.dataset.panelId = normalizedId;
    cell.dataset.panelSlug = toPanelCssSlug(normalizedId);
  }
  cell.dataset.panelClass = panelClass || "InfoPanel";
  if (flex) cell.style.flex = toFlexValue(flex) || flex;
  cell.style.minHeight = "0";
  cell.style.minWidth = "0";
  return cell;
}

export function createPanelRow(direction = "row", flex = "1 1 auto") {
  const row = document.createElement("div");
  const isVertical = direction === "column";
  row.className = "panel-row";
  Object.assign(row.style, { display: "flex", flexDirection: direction, overflow: "hidden", flex: toFlexValue(flex) || flex || "1 1 auto", alignItems: "stretch", minHeight: "0", minWidth: "0" });
  row.dataset.direction = direction;
  row.dataset.isVertical = isVertical ? "1" : "0";
  return row;
}
