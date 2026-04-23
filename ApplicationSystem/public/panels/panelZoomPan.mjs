// Nodevision/ApplicationSystem/public/panels/panelZoomPan.mjs
// Panel-scoped zoom/pan utilities. Applies transforms only inside the active panel content.

const VIEWPORT_CLASS = "nv-panel-zoom-viewport";
const LAYER_CLASS = "nv-panel-zoom-layer";
const STATE_KEY = "__nvPanelZoomPanState";
const ORIGINAL_OVERFLOW_KEY = "__nvPanelZoomPanOriginalOverflow";
const ORIGINAL_POSITION_KEY = "__nvPanelZoomPanOriginalPosition";
const LAST_PANEL_KEY = "__nvLastActiveZoomPanPanel";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

function clamp(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function round(value, digits = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function isTargetElement(el) {
  if (!el?.isConnected || !el.classList) return false;
  return el.classList.contains("panel") ||
    el.classList.contains("panel-cell") ||
    el.classList.contains("panel-content");
}

function getDirectChildByClass(parent, className) {
  if (!parent?.children?.length || !className) return null;
  return Array.from(parent.children).find((child) => child?.classList?.contains(className)) || null;
}

function queryPanelFromActiveCell() {
  const activeRef = window.activeCell;
  if (activeRef?.isConnected) {
    if (isTargetElement(activeRef) && !activeRef.classList?.contains("panel-cell")) {
      return activeRef;
    }
    const nearestPanel = activeRef.closest?.(".panel");
    if (nearestPanel?.isConnected) {
      return nearestPanel;
    }
    const activeCell = activeRef.classList?.contains("panel-cell")
      ? activeRef
      : activeRef.closest?.(".panel-cell");
    if (activeCell?.isConnected) {
      const panelInCell = getDirectChildByClass(activeCell, "panel");
      if (panelInCell?.isConnected) {
        return panelInCell;
      }
      return activeCell;
    }
  }

  const highlightedCell = document.querySelector(".panel-cell.active-panel");
  if (highlightedCell?.isConnected) {
    const panel = getDirectChildByClass(highlightedCell, "panel");
    if (panel?.isConnected) return panel;
    return highlightedCell;
  }
  return null;
}

function rememberPanel(panel) {
  if (!isTargetElement(panel)) return;
  window[LAST_PANEL_KEY] = panel;
}

export function getActivePanelElement() {
  const fromCell = queryPanelFromActiveCell();
  if (fromCell) {
    rememberPanel(fromCell);
    return fromCell;
  }
  const explicit = window.__nvActivePanelElement;
  if (isTargetElement(explicit)) {
    rememberPanel(explicit);
    return explicit;
  }
  const activePanelName = window.activePanel;
  if (typeof activePanelName === "string" && activePanelName.trim()) {
    const fallback = Array.from(document.querySelectorAll(".panel"))
      .find((panel) => panel?.dataset?.instanceName === activePanelName);
    if (fallback?.isConnected) {
      rememberPanel(fallback);
      return fallback;
    }
    const fallbackCell = Array.from(document.querySelectorAll(".panel-cell"))
      .find((cell) => cell?.dataset?.id === activePanelName);
    if (fallbackCell?.isConnected) {
      rememberPanel(fallbackCell);
      return fallbackCell;
    }
  }
  const cached = window[LAST_PANEL_KEY];
  if (isTargetElement(cached)) {
    return cached;
  }
  return null;
}

function getPanelContent(panel) {
  if (!panel?.isConnected) return null;
  if (panel.classList?.contains("panel-cell")) return panel;
  if (panel.classList?.contains("panel-content")) return panel;
  const direct = getDirectChildByClass(panel, "panel-content");
  if (direct?.isConnected) return direct;

  // Fallback for non-standard panel roots: use the element itself.
  return panel;
}

function ensureViewportLayer(panelContent) {
  if (!panelContent) return null;

  let viewport = getDirectChildByClass(panelContent, VIEWPORT_CLASS);
  if (!viewport) {
    viewport = document.createElement("div");
    viewport.className = VIEWPORT_CLASS;
    Object.assign(viewport.style, {
      position: "absolute",
      inset: "0",
      overflow: "hidden",
      minWidth: "0",
      minHeight: "0",
    });

    const layer = document.createElement("div");
    layer.className = LAYER_CLASS;
    Object.assign(layer.style, {
      position: "absolute",
      left: "0",
      top: "0",
      minWidth: "100%",
      minHeight: "100%",
      transformOrigin: "0 0",
      willChange: "transform",
    });

    const existing = Array.from(panelContent.childNodes);
    existing.forEach((node) => {
      if (node === viewport) return;
      layer.appendChild(node);
    });

    viewport.appendChild(layer);
    panelContent.appendChild(viewport);
    return { viewport, layer };
  }

  let layer = getDirectChildByClass(viewport, LAYER_CLASS);
  if (!layer) {
    layer = document.createElement("div");
    layer.className = LAYER_CLASS;
    Object.assign(layer.style, {
      position: "absolute",
      left: "0",
      top: "0",
      minWidth: "100%",
      minHeight: "100%",
      transformOrigin: "0 0",
      willChange: "transform",
    });
    const existing = Array.from(viewport.childNodes);
    existing.forEach((node) => {
      if (node === layer) return;
      layer.appendChild(node);
    });
    viewport.appendChild(layer);
  }

  return { viewport, layer };
}

function unwrapViewportLayer(panelContent) {
  if (!panelContent) return false;
  const viewport = getDirectChildByClass(panelContent, VIEWPORT_CLASS);
  if (!viewport) return false;
  const layer = getDirectChildByClass(viewport, LAYER_CLASS);
  const source = layer || viewport;
  const children = Array.from(source.childNodes);
  viewport.remove();
  children.forEach((node) => panelContent.appendChild(node));
  return true;
}

function ensureState(panel) {
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

export function getPanelViewportState(panel = null) {
  const target = panel || getActivePanelElement();
  const state = ensureState(target);
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
  } else {
    if (window.getComputedStyle(panelContent).position === "static") {
      panelContent.style.position = "relative";
    }
    panelContent.style.overflow = "hidden";
    const refs = ensureViewportLayer(panelContent);
    if (!refs?.layer) return null;
    refs.layer.style.transform = `translate(${round(panX, 3)}px, ${round(panY, 3)}px) scale(${round(zoom, 5)})`;
  }
  state.zoom = zoom;
  state.panX = panX;
  state.panY = panY;

  const payload = {
    panel: target,
    panelId:
      target.dataset?.instanceId ||
      target.dataset?.instanceName ||
      target.dataset?.id ||
      target.dataset?.panelClass ||
      "",
    zoom: round(zoom, 4),
    panX: round(panX, 2),
    panY: round(panY, 2),
  };
  window.dispatchEvent(new CustomEvent("nv-panel-zoom-pan-updated", { detail: payload }));
  return payload;
}

export function setPanelViewportState(next = {}, panel = null) {
  const target = panel || getActivePanelElement();
  if (!target) return null;
  const state = ensureState(target);
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

export function zoomPanelBy(delta = 0, panel = null) {
  const target = panel || getActivePanelElement();
  if (!target) return null;
  const state = ensureState(target);
  if (!state) return null;
  return setPanelViewportState({ zoom: (state.zoom || 1) + Number(delta || 0) }, target);
}

export function panPanelBy(dx = 0, dy = 0, panel = null) {
  const target = panel || getActivePanelElement();
  if (!target) return null;
  const state = ensureState(target);
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
  const panX = (panelContent.clientWidth - scaledW) / 2;
  const panY = (panelContent.clientHeight - scaledH) / 2;
  return setPanelViewportState({ zoom, panX, panY }, target);
}

window.NodevisionPanelViewportTools = {
  getActivePanelElement,
  getPanelViewportState,
  setPanelViewportState,
  applyPanelViewport,
  zoomPanelBy,
  panPanelBy,
  resetPanelViewport,
  fitPanelViewport,
};
