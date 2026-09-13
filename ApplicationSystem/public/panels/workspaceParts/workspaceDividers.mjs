// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspaceDividers.mjs
// This module creates resizable dividers for Nodevision workspace rows and lets split-drag behavior register itself without circular imports.

import { setProportionalFlex } from "./workspacePrimitives.mjs";
import { startResizePlaceholderMode } from "./workspacePlaceholders.mjs";
import { isPanelSplitGesture } from "./workspaceEdgeHandles.mjs";

let focusLayoutControlsForPanels = () => null;
let startPanelSplitDrag = () => null;

export function configureDividerCallbacks(callbacks = {}) {
  if (callbacks.focusLayoutControlsForPanels) focusLayoutControlsForPanels = callbacks.focusLayoutControlsForPanels;
  if (callbacks.startPanelSplitDrag) startPanelSplitDrag = callbacks.startPanelSplitDrag;
}

function finishResize(divider, state, e, isVertical) {
  state.activePointerId = null;
  if (state.leftEl) state.leftEl.style.transition = "";
  if (state.rightEl) state.rightEl.style.transition = "";
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
  state.stopPlaceholderMode?.();
  state.stopPlaceholderMode = null;
  if (e?.pointerId !== undefined) divider.releasePointerCapture?.(e.pointerId);
  document.removeEventListener("pointermove", state.onPointerMove);
  document.removeEventListener("pointerup", state.onPointerUp);
  document.removeEventListener("pointercancel", state.onPointerUp);
}

export function createDivider(leftCell, rightCell) {
  const divider = document.createElement("div");
  divider.className = "divider";
  Object.assign(divider.style, { width: "10px", cursor: "col-resize", background: "#aaa", zIndex: "10", touchAction: "none", userSelect: "none" });
  const state = { activePointerId: null };
  state.onPointerMove = (e) => {
    if (state.activePointerId !== (e.pointerId ?? "mouse")) return;
    e.preventDefault();
    const dx = e.clientX - state.startX;
    const min = 5;
    const leftWidth = Math.max(min, state.startLeftWidth + dx);
    const rightWidth = Math.max(min, state.startRightWidth - dx);
    setProportionalFlex(leftCell, (leftWidth / state.totalWidth) * 100);
    setProportionalFlex(rightCell, (rightWidth / state.totalWidth) * 100);
  };
  state.onPointerUp = (e) => {
    if (state.activePointerId !== null && e?.pointerId !== undefined && state.activePointerId !== e.pointerId) return;
    finishResize(divider, state, e, false);
  };
  divider.addEventListener("pointerdown", (e) => {
    if ((e.button !== undefined && e.button !== 0) || state.activePointerId !== null) return;
    focusLayoutControlsForPanels(leftCell, rightCell);
    if (isPanelSplitGesture(e)) return startPanelSplitDrag(rightCell || leftCell, "left", e);
    e.preventDefault();
    state.activePointerId = e.pointerId ?? "mouse";
    state.startX = e.clientX;
    const leftRect = leftCell.getBoundingClientRect();
    const rightRect = rightCell.getBoundingClientRect();
    state.startLeftWidth = leftRect.width;
    state.startRightWidth = rightRect.width;
    state.totalWidth = Math.max(1, state.startLeftWidth + state.startRightWidth);
    leftCell.style.transition = "none";
    rightCell.style.transition = "none";
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    state.stopPlaceholderMode = startResizePlaceholderMode([leftCell, rightCell]);
    divider.setPointerCapture?.(e.pointerId);
    document.addEventListener("pointermove", state.onPointerMove);
    document.addEventListener("pointerup", state.onPointerUp);
    document.addEventListener("pointercancel", state.onPointerUp);
  });
  return divider;
}

function createLayoutDivider(leftCell, rightCell, isVertical = false) {
  const divider = document.createElement("div");
  divider.className = "layout-divider";
  divider._leftCell = leftCell;
  divider._rightCell = rightCell;
  Object.assign(divider.style, { flexShrink: "0", flexGrow: "0", zIndex: "100", transition: "background 0.2s", touchAction: "none", userSelect: "none", ...(isVertical ? { height: "10px", minHeight: "10px", maxHeight: "10px", cursor: "row-resize", width: "100%", display: "block" } : { width: "10px", minWidth: "10px", maxWidth: "10px", cursor: "col-resize", height: "100%", display: "block" }) });
  const state = { activePointerId: null, leftEl: leftCell, rightEl: rightCell };
  state.onPointerMove = (e) => {
    if (state.activePointerId !== (e.pointerId ?? "mouse") || !state.leftEl || !state.rightEl) return;
    e.preventDefault();
    const currentPos = isVertical ? e.clientY : e.clientX;
    const delta = currentPos - state.startPos;
    const min = 50;
    const leftSize = Math.max(min, state.startLeftSize + delta);
    const rightSize = Math.max(min, state.startRightSize - delta);
    setProportionalFlex(state.leftEl, (leftSize / state.totalSize) * 100);
    setProportionalFlex(state.rightEl, (rightSize / state.totalSize) * 100);
  };
  state.onPointerUp = (e) => {
    if (state.activePointerId !== null && e?.pointerId !== undefined && state.activePointerId !== e.pointerId) return;
    finishResize(divider, state, e, isVertical);
  };
  divider.addEventListener("pointerdown", (e) => {
    if ((e.button !== undefined && e.button !== 0) || state.activePointerId !== null) return;
    state.leftEl = divider._leftCell;
    state.rightEl = divider._rightCell;
    if (!state.leftEl || !state.rightEl) return;
    focusLayoutControlsForPanels(state.leftEl, state.rightEl);
    if (isPanelSplitGesture(e)) return startPanelSplitDrag(state.rightEl || state.leftEl, isVertical ? "top" : "left", e);
    e.preventDefault();
    state.activePointerId = e.pointerId ?? "mouse";
    const leftRect = state.leftEl.getBoundingClientRect();
    const rightRect = state.rightEl.getBoundingClientRect();
    state.startPos = isVertical ? e.clientY : e.clientX;
    state.startLeftSize = isVertical ? leftRect.height : leftRect.width;
    state.startRightSize = isVertical ? rightRect.height : rightRect.width;
    state.totalSize = Math.max(1, state.startLeftSize + state.startRightSize);
    state.leftEl.style.transition = "none";
    state.rightEl.style.transition = "none";
    document.body.style.cursor = isVertical ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
    state.stopPlaceholderMode = startResizePlaceholderMode([state.leftEl, state.rightEl]);
    divider.setPointerCapture?.(e.pointerId);
    document.addEventListener("pointermove", state.onPointerMove);
    document.addEventListener("pointerup", state.onPointerUp);
    document.addEventListener("pointercancel", state.onPointerUp);
  });
  return divider;
}

export function rebuildLayoutDividersForContainer(container, isVerticalOverride) {
  if (!container) return 0;
  const isVerticalFlag = container.dataset?.isVertical?.toLowerCase?.();
  const isVertical = typeof isVerticalOverride === "boolean" ? isVerticalOverride : (isVerticalFlag === "1" || isVerticalFlag === "true" || container.dataset?.direction === "column");
  Array.from(container.children).filter((child) => child.classList?.contains("layout-divider") || child.classList?.contains("divider")).forEach((divider) => divider.remove());
  const panels = Array.from(container.children).filter((child) => child.classList?.contains("panel-cell") || child.classList?.contains("panel-row"));
  if (panels.length < 2) return 0;
  for (let i = panels.length - 1; i > 0; i -= 1) container.insertBefore(createLayoutDivider(panels[i - 1], panels[i], isVertical), panels[i]);
  return panels.length - 1;
}
