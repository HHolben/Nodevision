// Nodevision/ApplicationSystem/public/panels/panelZoomPanParts/commands.mjs
// This module implements generic geometric zoom, pan, reset, and fit operations in panel coordinates.

import { getActivePanelElement } from "./ownership.mjs";
import { syncStateFromViewport, ensureState } from "./state.mjs";
import { clamp, MIN_ZOOM, MAX_ZOOM } from "./constants.mjs";
import { panelLocksZoomToTopLeft, getEffectivePanelPan, getPanelZoomAxes } from "./geometry.mjs";
import { setPanelViewportState } from "./viewport.mjs";
import { getPanelContent, getExistingViewportLayer, ensureViewportLayer } from "./layers.mjs";

export function zoomPanelBy(delta = 0, panel = null) {
  const target = panel || getActivePanelElement();
  if (!target) return null;
  const state = syncStateFromViewport(target) || ensureState(target);
  if (!state) return null;
  const currentZoom = Number.isFinite(Number(state.zoom)) ? Number(state.zoom) : 1;
  const nextZoom = clamp(currentZoom + Number(delta || 0), MIN_ZOOM, MAX_ZOOM, currentZoom);
  if (panelLocksZoomToTopLeft(target)) {
    return setPanelViewportState({ zoom: nextZoom, panX: 0, panY: 0 }, target);
  }
  const factor = currentZoom > 0 ? nextZoom / currentZoom : 1;
  return zoomPanelAtCenter(target, factor);
}

export function zoomPanelAt(panel = null, clientX = null, clientY = null, factor = 1) {
  const target = panel || getActivePanelElement();
  if (!target) return null;

  const state = syncStateFromViewport(target) || ensureState(target);
  if (!state) return null;

  const currentZoom = Number.isFinite(Number(state.zoom)) ? Number(state.zoom) : 1;
  const rawFactor = Number(factor);
  const nextZoom = clamp(
    currentZoom * (Number.isFinite(rawFactor) && rawFactor > 0 ? rawFactor : 1),
    MIN_ZOOM,
    MAX_ZOOM,
    currentZoom
  );

  if (panelLocksZoomToTopLeft(target)) {
    return setPanelViewportState({ zoom: nextZoom, panX: 0, panY: 0 }, target);
  }

  const content = getPanelContent(target);
  if (!content || !Number.isFinite(Number(clientX)) || !Number.isFinite(Number(clientY))) {
    return setPanelViewportState({ zoom: nextZoom }, target);
  }

  const rect = content.getBoundingClientRect?.();
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return setPanelViewportState({ zoom: nextZoom }, target);
  }

  const localX = Number(clientX) - rect.left;
  const localY = Number(clientY) - rect.top;
  const effectivePan = getEffectivePanelPan(content, state);
  const refs = getExistingViewportLayer(content);
  const currentAxes = getPanelZoomAxes(content, refs, currentZoom);
  const nextAxes = getPanelZoomAxes(content, refs, nextZoom);
  const contentX = (localX - effectivePan.panX) / currentAxes.x;
  const contentY = (localY - effectivePan.panY) / currentAxes.y;

  return setPanelViewportState(
    {
      zoom: nextZoom,
      panX: localX - contentX * nextAxes.x,
      panY: localY - contentY * nextAxes.y,
    },
    target
  );
}

export function panPanelBy(dx = 0, dy = 0, panel = null) {
  const target = panel || getActivePanelElement();
  if (!target) return null;
  const state = syncStateFromViewport(target) || ensureState(target);
  if (!state) return null;
  return setPanelViewportState({
    panX: (state.panX || 0) + Number(dx || 0),
    panY: (state.panY || 0) + Number(dy || 0),
  }, target);
}

export function resetPanelViewport(panel = null) {
  return setPanelViewportState({ zoom: 1, panX: 0, panY: 0 }, panel);
}

export function fitPanelViewport(panel = null, options = {}) {
  const target = panel || getActivePanelElement();
  if (!target) return null;
  const panelContent = getPanelContent(target);
  if (!panelContent) return null;
  const refs = ensureViewportLayer(panelContent);
  if (!refs?.layer) return null;

  const padding = clamp(options.padding ?? 16, 0, 160, 16);
  const srcW = Math.max(1, refs.layer.scrollWidth || refs.layer.offsetWidth || 1);
  const srcH = Math.max(1, refs.layer.scrollHeight || refs.layer.offsetHeight || 1);
  const dstW = Math.max(1, panelContent.clientWidth - padding * 2);
  const dstH = Math.max(1, panelContent.clientHeight - padding * 2);
  const zoom = clamp(Math.min(dstW / srcW, dstH / srcH), MIN_ZOOM, MAX_ZOOM, 1);
  const scaledW = srcW * zoom;
  const scaledH = srcH * zoom;
  const lockTopLeft = panelLocksZoomToTopLeft(target);
  const panX = lockTopLeft ? 0 : (panelContent.clientWidth - scaledW) / 2;
  const panY = lockTopLeft ? 0 : (panelContent.clientHeight - scaledH) / 2;
  return setPanelViewportState({ zoom, panX, panY }, target);
}

export function getPanelCenter(panel) {
  const content = getPanelContent(panel);
  const rect = content?.getBoundingClientRect?.();
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function zoomPanelAtCenter(panel, factor) {
  const center = getPanelCenter(panel);
  if (!center) return zoomPanelAt(panel, null, null, factor);
  return zoomPanelAt(panel, center.x, center.y, factor);
}
