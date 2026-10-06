// Nodevision/ApplicationSystem/public/panels/panelZoomPanParts/constants.mjs
// This module defines shared viewport limits, private state keys, and numeric normalization helpers.



export const VIEWPORT_CLASS = "nv-panel-zoom-viewport";

export const SPACER_CLASS = "nv-panel-zoom-spacer";

export const LAYER_CLASS = "nv-panel-zoom-layer";

export const STATE_KEY = "__nvPanelZoomPanState";

export const ORIGINAL_OVERFLOW_KEY = "__nvPanelZoomPanOriginalOverflow";

export const ORIGINAL_POSITION_KEY = "__nvPanelZoomPanOriginalPosition";

export const LAST_PANEL_KEY = "__nvLastActiveZoomPanPanel";

export const ACTIVE_PANEL_MEMORY_KEY = "__nvPanelZoomPanActivePanelMemory";

export const SCROLL_BOUND_KEY = "__nvPanelZoomPanScrollBound";

export const APPLYING_SCROLL_KEY = "__nvPanelZoomPanApplyingScroll";

export const RESIZE_OBSERVER_KEY = "__nvPanelZoomPanResizeObserver";

export const RESIZE_FRAME_KEY = "__nvPanelZoomPanResizeFrame";

export const CONTENT_RESIZE_FRAME_KEY = "__nvPanelZoomPanContentResizeFrame";

export const INLINE_FIT_ATTR = "data-nv-zoom-inline-fit";

export const INLINE_FIT_STRETCH_ON_ZOOM_OUT = "stretch-on-zoom-out";

export const INLINE_FIT_SCALE_CONTENT = "scale-content";

export const INLINE_FIT_ANCHOR_TOP_LEFT = "anchor-top-left";

export const LOCAL_ZOOM_SCOPE_SELECTOR = "[data-nv-panel-zoom-scope=\"local\"]";

export const MIN_ZOOM = 0.1;

export const MAX_ZOOM = 8;

export function clamp(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function round(value, digits = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

export function parsePixelValue(value) {
  const n = Number.parseFloat(String(value || ""));
  return Number.isFinite(n) ? n : 0;
}
