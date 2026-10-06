// Nodevision/ApplicationSystem/public/panels/panelZoomPanParts/viewport.mjs
// This module applies panel viewport state and coordinates geometry updates with viewport lifecycle changes.

import { getActivePanelElement } from "./ownership.mjs";
import { syncStateFromViewport, ensureState, disconnectResizeObserver, scheduleContentBoundsChanged, bindViewportScroll, ensureResizeObserver, dispatchPanelViewportUpdated } from "./state.mjs";
import { round, clamp, MIN_ZOOM, MAX_ZOOM, ORIGINAL_OVERFLOW_KEY, ORIGINAL_POSITION_KEY } from "./constants.mjs";
import { getPanelContent, unwrapViewportLayer, ensureViewportLayer } from "./layers.mjs";
import { updateViewportGeometry } from "./geometry.mjs";

export function getPanelViewportState(panel = null) {
  const target = panel || getActivePanelElement();
  const state = syncStateFromViewport(target) || ensureState(target);
  if (!state) return null;
  return {
    zoom: round(state.zoom, 4),
    panX: round(state.panX, 2),
    panY: round(state.panY, 2),
  };
}

export function applyPanelViewport(panel = null) {
  const target = panel || getActivePanelElement();
  if (!target) return null;
  const panelContent = getPanelContent(target);
  if (!panelContent) return null;
  const state = ensureState(target);
  if (!state) return null;

  const zoom = clamp(state.zoom, MIN_ZOOM, MAX_ZOOM, 1);
  const panX = Number.isFinite(Number(state.panX)) ? Number(state.panX) : 0;
  const panY = Number.isFinite(Number(state.panY)) ? Number(state.panY) : 0;

  if (panelContent[ORIGINAL_OVERFLOW_KEY] === undefined) {
    panelContent[ORIGINAL_OVERFLOW_KEY] = panelContent.style.overflow || "";
  }
  if (panelContent[ORIGINAL_POSITION_KEY] === undefined) {
    panelContent[ORIGINAL_POSITION_KEY] = panelContent.style.position || "";
  }

  const isIdentity = Math.abs(zoom - 1) < 0.0001 && Math.abs(panX) < 0.0001 && Math.abs(panY) < 0.0001;
  if (isIdentity) {
    panelContent.style.overflow = panelContent[ORIGINAL_OVERFLOW_KEY] || "auto";
    panelContent.style.position = panelContent[ORIGINAL_POSITION_KEY] || "";
    unwrapViewportLayer(panelContent);
    disconnectResizeObserver(target);
    scheduleContentBoundsChanged(panelContent, target, {
      zoom: 1,
      contentWidth: panelContent.clientWidth || 0,
      contentHeight: panelContent.clientHeight || 0,
      viewportWidth: panelContent.clientWidth || 0,
      viewportHeight: panelContent.clientHeight || 0,
      visibleContentWidth: panelContent.clientWidth || 0,
      visibleContentHeight: panelContent.clientHeight || 0,
    });
  } else {
    if (window.getComputedStyle(panelContent).position === "static") {
      panelContent.style.position = "relative";
    }
    panelContent.style.overflow = "hidden";
    const refs = ensureViewportLayer(panelContent);
    if (!refs?.layer) return null;
    bindViewportScroll(target, refs);
    ensureResizeObserver(target, panelContent, applyPanelViewport);
    const actualPan = updateViewportGeometry(panelContent, refs, zoom, panX, panY);
    state.panX = actualPan.panX;
    state.panY = actualPan.panY;
    scheduleContentBoundsChanged(panelContent, target, {
      zoom,
      contentWidth: actualPan.baseW,
      contentHeight: actualPan.baseH,
      viewportWidth: actualPan.viewportW,
      viewportHeight: actualPan.viewportH,
      visibleContentWidth: actualPan.visibleW,
      visibleContentHeight: actualPan.visibleH,
    });
  }
  state.zoom = zoom;
  if (isIdentity) {
    state.panX = panX;
    state.panY = panY;
  }

  return dispatchPanelViewportUpdated(target, state);
}

export function setPanelViewportState(next = {}, panel = null) {
  const target = panel || getActivePanelElement();
  if (!target) return null;
  const state = syncStateFromViewport(target) || ensureState(target);
  if (!state) return null;

  if (next.zoom !== undefined) {
    state.zoom = clamp(next.zoom, MIN_ZOOM, MAX_ZOOM, state.zoom || 1);
  }
  if (next.panX !== undefined) {
    state.panX = Number.isFinite(Number(next.panX)) ? Number(next.panX) : state.panX;
  }
  if (next.panY !== undefined) {
    state.panY = Number.isFinite(Number(next.panY)) ? Number(next.panY) : state.panY;
  }
  return applyPanelViewport(target);
}
