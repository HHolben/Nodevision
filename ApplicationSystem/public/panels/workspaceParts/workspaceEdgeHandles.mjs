// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspaceEdgeHandles.mjs
// This module owns edge split handles and modifier-key tracking for Nodevision workspace panel splitting.

import { collectPanelCells } from "./workspacePrimitives.mjs";

export const PANEL_EDGE_SPLIT_HOTZONE_PX = 12;
export const PANEL_EDGE_SPLIT_MIN_DRAG_PX = 18;
export const PANEL_SPLIT_MIN_PERCENT = 10;
export const PANEL_SPLIT_MAX_PERCENT = 90;
export const PANEL_EDGE_SPLIT_HANDLE_CLASS = "panel-edge-split-handle";
export const WORKSPACE_EDGE_SPLIT_HANDLE_CLASS = "workspace-edge-split-handle";
export const PANEL_EDGE_SPLIT_MODIFIER_CLASS = "nv-panel-split-modifier-active";

export function ensurePanelEdgeSplitHandleStyles() {
  if (document.getElementById("nv-panel-edge-split-handle-styles")) return;
  const style = document.createElement("style");
  style.id = "nv-panel-edge-split-handle-styles";
  style.textContent = `
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}, #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS} { position:absolute; z-index:120; pointer-events:none; background:transparent; opacity:0; transition:opacity 120ms ease, background 120ms ease; }
    body.${PANEL_EDGE_SPLIT_MODIFIER_CLASS} .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}, body.${PANEL_EDGE_SPLIT_MODIFIER_CLASS} #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS} { pointer-events:auto; }
    body.${PANEL_EDGE_SPLIT_MODIFIER_CLASS} .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}:hover, body.${PANEL_EDGE_SPLIT_MODIFIER_CLASS} #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}:hover { opacity:1; background:rgba(74,144,226,0.16); }
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="left"], .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="right"], #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="left"], #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="right"] { top:0; bottom:0; width:${PANEL_EDGE_SPLIT_HOTZONE_PX}px; cursor:col-resize; }
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="left"], #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="left"] { left:0; }
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="right"], #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="right"] { right:0; }
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="top"], .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="bottom"], #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="top"], #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="bottom"] { left:0; right:0; height:${PANEL_EDGE_SPLIT_HOTZONE_PX}px; cursor:row-resize; }
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="top"], #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="top"] { top:0; }
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="bottom"], #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="bottom"] { bottom:0; }
  `;
  document.head.appendChild(style);
}

export function ensurePanelEdgeSplitHandles(cell) {
  if (!cell?.classList?.contains?.("panel-cell")) return;
  ensurePanelEdgeSplitHandleStyles();
  if (!cell.style.position) cell.style.position = "relative";
  for (const edge of ["left", "right", "top", "bottom"]) {
    let handle = Array.from(cell.children).find((child) => child.classList?.contains(PANEL_EDGE_SPLIT_HANDLE_CLASS) && child.dataset?.edge === edge);
    if (!handle) {
      handle = document.createElement("div");
      handle.className = PANEL_EDGE_SPLIT_HANDLE_CLASS;
      handle.dataset.edge = edge;
      handle.setAttribute("aria-hidden", "true");
      cell.appendChild(handle);
    }
  }
}

export function ensureWorkspaceEdgeSplitHandles(workspace) {
  if (!workspace) return;
  ensurePanelEdgeSplitHandleStyles();
  if (!workspace.style.position) workspace.style.position = "relative";
  for (const edge of ["left", "right", "top", "bottom"]) {
    let handle = Array.from(workspace.children).find((child) => child.classList?.contains(WORKSPACE_EDGE_SPLIT_HANDLE_CLASS) && child.dataset?.edge === edge);
    if (!handle) {
      handle = document.createElement("div");
      handle.className = WORKSPACE_EDGE_SPLIT_HANDLE_CLASS;
      handle.dataset.edge = edge;
      handle.setAttribute("aria-hidden", "true");
      workspace.appendChild(handle);
    }
  }
}

export function updatePanelSplitModifierClass(event = null) {
  document.body?.classList?.toggle(PANEL_EDGE_SPLIT_MODIFIER_CLASS, Boolean(event?.ctrlKey || event?.metaKey));
}

export function installPanelSplitModifierTracking() {
  if (window.__nvPanelSplitModifierTrackingInstalled) return;
  window.__nvPanelSplitModifierTrackingInstalled = true;
  window.addEventListener("keydown", updatePanelSplitModifierClass, true);
  window.addEventListener("keyup", updatePanelSplitModifierClass, true);
  window.addEventListener("blur", () => document.body?.classList?.remove(PANEL_EDGE_SPLIT_MODIFIER_CLASS));
}

export function isPanelSplitGesture(event) {
  return Boolean(event?.ctrlKey || event?.metaKey);
}

export function clampPanelSplitPercent(value) {
  return Math.max(PANEL_SPLIT_MIN_PERCENT, Math.min(PANEL_SPLIT_MAX_PERCENT, value));
}

export function getPanelEdgeFromPointer(cell, event) {
  if (!cell || !event) return null;
  const rect = cell.getBoundingClientRect();
  const distances = { left: Math.abs(event.clientX - rect.left), right: Math.abs(rect.right - event.clientX), top: Math.abs(event.clientY - rect.top), bottom: Math.abs(rect.bottom - event.clientY) };
  const [edge, distance] = Object.entries(distances).sort((a, b) => a[1] - b[1])[0] || [];
  return distance <= PANEL_EDGE_SPLIT_HOTZONE_PX ? edge : null;
}

function pointWithinRect(rect, x, y, padding = 0) {
  return x >= rect.left - padding && x <= rect.right + padding && y >= rect.top - padding && y <= rect.bottom + padding;
}

export function findWorkspaceOuterEdgeSplitTarget(event, forcedEdge = null) {
  const workspace = document.getElementById("workspace");
  if (!workspace || !event) return null;
  const x = Number(event.clientX);
  const y = Number(event.clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const workspaceRect = workspace.getBoundingClientRect();
  if (!pointWithinRect(workspaceRect, x, y, PANEL_EDGE_SPLIT_HOTZONE_PX)) return null;
  const distances = { left: Math.abs(x - workspaceRect.left), right: Math.abs(workspaceRect.right - x), top: Math.abs(y - workspaceRect.top), bottom: Math.abs(workspaceRect.bottom - y) };
  const [nearestEdge, nearestDistance] = Object.entries(distances).sort((a, b) => a[1] - b[1])[0] || [];
  const edge = forcedEdge || nearestEdge;
  if (!edge || (!forcedEdge && nearestDistance > PANEL_EDGE_SPLIT_HOTZONE_PX)) return null;
  const records = collectPanelCells(workspace).map((cell) => ({ cell, rect: cell.getBoundingClientRect() })).filter(({ rect }) => rect.width > 0 && rect.height > 0);
  let candidates = [];
  if (edge === "left" || edge === "right") {
    candidates = records.filter(({ rect }) => y >= rect.top && y <= rect.bottom);
    candidates.sort((a, b) => edge === "left" ? a.rect.left - b.rect.left : b.rect.right - a.rect.right);
  } else {
    candidates = records.filter(({ rect }) => x >= rect.left && x <= rect.right);
    candidates.sort((a, b) => edge === "top" ? a.rect.top - b.rect.top : b.rect.bottom - a.rect.bottom);
  }
  return candidates[0] ? { cell: candidates[0].cell, edge } : null;
}
