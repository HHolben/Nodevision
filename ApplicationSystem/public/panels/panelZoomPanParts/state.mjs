// Nodevision/ApplicationSystem/public/panels/panelZoomPanParts/state.mjs
// This module maintains panel viewport state and schedules scroll, resize, and content bounds notifications.

import { STATE_KEY, round, parsePixelValue, SCROLL_BOUND_KEY, APPLYING_SCROLL_KEY, RESIZE_OBSERVER_KEY, RESIZE_FRAME_KEY, CONTENT_RESIZE_FRAME_KEY } from "./constants.mjs";
import { getPanelContent, getExistingViewportLayer } from "./layers.mjs";

export function ensureState(panel) {
  if (!panel) return null;
  if (!panel[STATE_KEY]) {
    panel[STATE_KEY] = {
      zoom: 1,
      panX: 0,
      panY: 0,
    };
  }
  return panel[STATE_KEY];
}

export function getPanelPayloadId(target) {
  return target?.dataset?.instanceId ||
    target?.dataset?.instanceName ||
    target?.dataset?.id ||
    target?.dataset?.panelClass ||
    "";
}

export function dispatchPanelViewportUpdated(target, state) {
  const payload = {
    panel: target,
    panelId: getPanelPayloadId(target),
    zoom: round(state?.zoom ?? 1, 4),
    panX: round(state?.panX ?? 0, 2),
    panY: round(state?.panY ?? 0, 2),
  };
  window.dispatchEvent(new CustomEvent("nv-panel-zoom-pan-updated", { detail: payload }));
  return payload;
}

export function syncStateFromViewport(panel, refs = null) {
  const state = ensureState(panel);
  if (!state) return null;
  const panelContent = getPanelContent(panel);
  const activeRefs = refs || getExistingViewportLayer(panelContent);
  if (!activeRefs?.viewport || !activeRefs?.layer) return state;

  const layerLeft = parsePixelValue(activeRefs.layer.style.left);
  const layerTop = parsePixelValue(activeRefs.layer.style.top);
  state.panX = round(layerLeft - (activeRefs.viewport.scrollLeft || 0), 2);
  state.panY = round(layerTop - (activeRefs.viewport.scrollTop || 0), 2);
  return state;
}

export function bindViewportScroll(panel, refs) {
  if (!panel || !refs?.viewport || refs.viewport[SCROLL_BOUND_KEY]) return;
  refs.viewport[SCROLL_BOUND_KEY] = true;
  refs.viewport.addEventListener("scroll", () => {
    if (refs.viewport[APPLYING_SCROLL_KEY]) return;
    const state = syncStateFromViewport(panel, refs);
    if (state) dispatchPanelViewportUpdated(panel, state);
  }, { passive: true });
}

export function disconnectResizeObserver(panel) {
  if (!panel) return;
  panel[RESIZE_OBSERVER_KEY]?.disconnect?.();
  panel[RESIZE_OBSERVER_KEY] = null;
  if (panel[RESIZE_FRAME_KEY]) {
    cancelAnimationFrame(panel[RESIZE_FRAME_KEY]);
    panel[RESIZE_FRAME_KEY] = 0;
  }
}

export function ensureResizeObserver(panel, panelContent, applyViewport) {
  if (!panel || !panelContent || typeof ResizeObserver !== "function") return;
  if (panel[RESIZE_OBSERVER_KEY]?.__nvObservedPanelContent === panelContent) return;
  disconnectResizeObserver(panel);
  const observer = new ResizeObserver(() => {
    if (!panel.isConnected || !panel[STATE_KEY]) {
      disconnectResizeObserver(panel);
      return;
    }
    if (panel[RESIZE_FRAME_KEY]) cancelAnimationFrame(panel[RESIZE_FRAME_KEY]);
    panel[RESIZE_FRAME_KEY] = requestAnimationFrame(() => {
      panel[RESIZE_FRAME_KEY] = 0;
      applyViewport(panel);
    });
  });
  observer.__nvObservedPanelContent = panelContent;
  observer.observe(panelContent);
  panel[RESIZE_OBSERVER_KEY] = observer;
}

export function scheduleContentBoundsChanged(panelContent, target, bounds) {
  if (!panelContent || !target) return;
  if (target[CONTENT_RESIZE_FRAME_KEY]) {
    cancelAnimationFrame(target[CONTENT_RESIZE_FRAME_KEY]);
  }
  target[CONTENT_RESIZE_FRAME_KEY] = requestAnimationFrame(() => {
    target[CONTENT_RESIZE_FRAME_KEY] = 0;
    const detail = {
      panel: target,
      panelId: getPanelPayloadId(target),
      ...bounds,
    };
    panelContent.dispatchEvent(new CustomEvent("nv-panel-content-bounds-changed", {
      bubbles: true,
      detail,
    }));
    window.dispatchEvent(new CustomEvent("nv-panel-content-bounds-changed", { detail }));
    window.dispatchEvent(new Event("resize"));
  });
}
