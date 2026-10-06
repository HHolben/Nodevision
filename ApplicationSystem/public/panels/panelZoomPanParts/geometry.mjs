// Nodevision/ApplicationSystem/public/panels/panelZoomPanParts/geometry.mjs
// This module computes viewport dimensions, fit axes, scroll offsets, and content transforms without changing zoom intent.

import { INLINE_FIT_ATTR, INLINE_FIT_ANCHOR_TOP_LEFT, clamp, MIN_ZOOM, MAX_ZOOM, INLINE_FIT_STRETCH_ON_ZOOM_OUT, INLINE_FIT_SCALE_CONTENT, round, APPLYING_SCROLL_KEY, parsePixelValue } from "./constants.mjs";
import { getPanelContent, getExistingViewportLayer } from "./layers.mjs";

export function findZoomInlineFitMarker(root) {
  if (!root) return null;
  if (root.nodeType === 1 && root.hasAttribute?.(INLINE_FIT_ATTR)) return root;
  return root.querySelector?.("[" + INLINE_FIT_ATTR + "]") || null;
}

export function getPanelZoomFitMode(panelContent, refs) {
  const marker = findZoomInlineFitMarker(refs?.layer) || findZoomInlineFitMarker(panelContent);
  return marker?.getAttribute?.(INLINE_FIT_ATTR) || "";
}

export function panelLocksZoomToTopLeft(panel) {
  const panelContent = getPanelContent(panel);
  if (!panelContent) return false;
  return getPanelZoomFitMode(panelContent, getExistingViewportLayer(panelContent)) === INLINE_FIT_ANCHOR_TOP_LEFT;
}

export function getPanelZoomAxes(panelContent, refs, zoom = 1) {
  const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM, 1);
  const fitMode = getPanelZoomFitMode(panelContent, refs);
  const stretchInline = z < 1 && fitMode === INLINE_FIT_STRETCH_ON_ZOOM_OUT;
  const scaleContent = fitMode === INLINE_FIT_SCALE_CONTENT;
  return {
    x: stretchInline ? 1 : z,
    y: z,
    stretchInline,
    scaleContent,
  };
}

export function measureLayerBaseSize(panelContent, refs, zoom = 1) {
  const viewportW = Math.max(1, refs.viewport.clientWidth || panelContent.clientWidth || 1);
  const viewportH = Math.max(1, refs.viewport.clientHeight || panelContent.clientHeight || 1);
  const effectiveZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM, 1);
  const axes = getPanelZoomAxes(panelContent, refs, effectiveZoom);
  const zoomedOutW = axes.scaleContent ? viewportW : Math.ceil(viewportW / axes.x);
  const zoomedOutH = axes.scaleContent ? viewportH : Math.ceil(viewportH / axes.y);

  refs.layer.style.width = `${Math.max(viewportW, zoomedOutW)}px`;
  refs.layer.style.height = `${Math.max(viewportH, zoomedOutH)}px`;

  return {
    width: Math.max(1, Math.ceil(refs.layer.scrollWidth || refs.layer.offsetWidth || viewportW), zoomedOutW),
    height: Math.max(1, Math.ceil(refs.layer.scrollHeight || refs.layer.offsetHeight || viewportH), zoomedOutH),
    viewportW,
    viewportH,
    scaleX: axes.x,
    scaleY: axes.y,
    scaleContent: axes.scaleContent,
  };
}

export function updateViewportGeometry(panelContent, refs, zoom, panX, panY) {
  if (!panelContent || !refs?.viewport || !refs?.spacer || !refs?.layer) {
    return { panX, panY };
  }

  const {
    width: baseW,
    height: baseH,
    viewportW,
    viewportH,
    scaleX,
    scaleY,
    scaleContent,
  } = measureLayerBaseSize(panelContent, refs, zoom);
  const scaledW = Math.max(1, Math.ceil(baseW * scaleX));
  const scaledH = Math.max(1, Math.ceil(baseH * scaleY));
  const lockTopLeft = getPanelZoomFitMode(panelContent, refs) === INLINE_FIT_ANCHOR_TOP_LEFT;
  const centerX = scaleContent && !lockTopLeft && scaledW <= viewportW + 1;
  const centerY = scaleContent && !lockTopLeft && scaledH <= viewportH + 1;
  const layerLeft = centerX ? (viewportW - scaledW) / 2 : (lockTopLeft ? 0 : Math.max(0, panX));
  const layerTop = centerY ? (viewportH - scaledH) / 2 : (lockTopLeft ? 0 : Math.max(0, panY));
  const maxScrollLeft = Math.max(0, Math.ceil(layerLeft + scaledW - viewportW));
  const maxScrollTop = Math.max(0, Math.ceil(layerTop + scaledH - viewportH));
  const desiredScrollLeft = centerX ? 0 : clamp(-panX, 0, maxScrollLeft, 0);
  const desiredScrollTop = centerY ? 0 : clamp(-panY, 0, maxScrollTop, 0);

  refs.layer.style.left = `${round(layerLeft, 3)}px`;
  refs.layer.style.top = `${round(layerTop, 3)}px`;
  refs.layer.style.width = `${baseW}px`;
  refs.layer.style.height = `${baseH}px`;
  refs.layer.style.setProperty("--nv-panel-content-width", String(baseW) + "px");
  refs.layer.style.setProperty("--nv-panel-content-height", String(baseH) + "px");
  refs.layer.style.setProperty("--nv-panel-viewport-width", String(viewportW) + "px");
  refs.layer.style.setProperty("--nv-panel-viewport-height", String(viewportH) + "px");
  refs.layer.style.setProperty("--nv-panel-visible-width", `${Math.ceil(viewportW / scaleX)}px`);
  refs.layer.style.setProperty("--nv-panel-visible-height", `${Math.ceil(viewportH / scaleY)}px`);
  refs.layer.style.transform = `scale(${round(scaleX, 5)}, ${round(scaleY, 5)})`;

  refs.spacer.style.width = `${Math.max(viewportW, Math.ceil(layerLeft + scaledW))}px`;
  refs.spacer.style.height = `${Math.max(viewportH, Math.ceil(layerTop + scaledH))}px`;

  refs.viewport[APPLYING_SCROLL_KEY] = true;
  refs.viewport.scrollLeft = desiredScrollLeft;
  refs.viewport.scrollTop = desiredScrollTop;
  const actualPanX = round(layerLeft - (refs.viewport.scrollLeft || 0), 2);
  const actualPanY = round(layerTop - (refs.viewport.scrollTop || 0), 2);
  requestAnimationFrame(() => {
    refs.viewport[APPLYING_SCROLL_KEY] = false;
  });
  return {
    panX: actualPanX,
    panY: actualPanY,
    baseW,
    baseH,
    viewportW,
    viewportH,
    visibleW: Math.ceil(viewportW / scaleX),
    visibleH: Math.ceil(viewportH / scaleY),
  };
}

export function getEffectivePanelPan(panelContent, state) {
  const refs = getExistingViewportLayer(panelContent);
  if (refs?.viewport && refs?.layer) {
    const layerLeft = parsePixelValue(refs.layer.style.left);
    const layerTop = parsePixelValue(refs.layer.style.top);
    return {
      panX: layerLeft - (refs.viewport.scrollLeft || 0),
      panY: layerTop - (refs.viewport.scrollTop || 0),
    };
  }

  return {
    panX: (Number.isFinite(Number(state?.panX)) ? Number(state.panX) : 0) - (panelContent?.scrollLeft || 0),
    panY: (Number.isFinite(Number(state?.panY)) ? Number(state.panY) : 0) - (panelContent?.scrollTop || 0),
  };
}
