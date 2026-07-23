// Nodevision/ApplicationSystem/public/panels/panelZoomPan.mjs
// Panel-scoped zoom/pan utilities. Applies transforms only inside the active panel content.

const VIEWPORT_CLASS = "nv-panel-zoom-viewport";
const SPACER_CLASS = "nv-panel-zoom-spacer";
const LAYER_CLASS = "nv-panel-zoom-layer";
const STATE_KEY = "__nvPanelZoomPanState";
const ORIGINAL_OVERFLOW_KEY = "__nvPanelZoomPanOriginalOverflow";
const ORIGINAL_POSITION_KEY = "__nvPanelZoomPanOriginalPosition";
const LAST_PANEL_KEY = "__nvLastActiveZoomPanPanel";
const SCROLL_BOUND_KEY = "__nvPanelZoomPanScrollBound";
const APPLYING_SCROLL_KEY = "__nvPanelZoomPanApplyingScroll";
const RESIZE_OBSERVER_KEY = "__nvPanelZoomPanResizeObserver";
const RESIZE_FRAME_KEY = "__nvPanelZoomPanResizeFrame";
const CONTENT_RESIZE_FRAME_KEY = "__nvPanelZoomPanContentResizeFrame";

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

function parsePixelValue(value) {
  const n = Number.parseFloat(String(value || ""));
  return Number.isFinite(n) ? n : 0;
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

export function getPanelElementFromElement(element) {
  const start = element?.nodeType === 1 ? element : null;
  if (!start) return null;

  const panel = start.closest?.(".panel");
  if (isTargetElement(panel)) return panel;

  const cell = start.closest?.(".panel-cell");
  if (!isTargetElement(cell)) return null;

  return getDirectChildByClass(cell, "panel") || cell;
}

export function getPanelElementFromEvent(event) {
  return getPanelElementFromElement(event?.target);
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

function applyViewportStyles(viewport) {
  Object.assign(viewport.style, {
    position: "absolute",
    inset: "0",
    overflow: "auto",
    minWidth: "0",
    minHeight: "0",
  });
}

function applySpacerStyles(spacer) {
  Object.assign(spacer.style, {
    position: "relative",
    width: "100%",
    height: "100%",
    minWidth: "100%",
    minHeight: "100%",
    pointerEvents: "none",
  });
}

function applyLayerStyles(layer) {
  Object.assign(layer.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
    minWidth: "0",
    minHeight: "0",
    boxSizing: "border-box",
    transformOrigin: "0 0",
    willChange: "transform",
  });
}

function getExistingViewportLayer(panelContent) {
  if (!panelContent) return null;
  const viewport = getDirectChildByClass(panelContent, VIEWPORT_CLASS);
  if (!viewport) return null;
  return {
    viewport,
    spacer: getDirectChildByClass(viewport, SPACER_CLASS),
    layer: getDirectChildByClass(viewport, LAYER_CLASS),
  };
}

function ensureViewportLayer(panelContent) {
  if (!panelContent) return null;

  let viewport = getDirectChildByClass(panelContent, VIEWPORT_CLASS);
  if (!viewport) {
    viewport = document.createElement("div");
    viewport.className = VIEWPORT_CLASS;
    applyViewportStyles(viewport);

    const spacer = document.createElement("div");
    spacer.className = SPACER_CLASS;
    applySpacerStyles(spacer);

    const layer = document.createElement("div");
    layer.className = LAYER_CLASS;
    applyLayerStyles(layer);

    const existing = Array.from(panelContent.childNodes);
    existing.forEach((node) => {
      if (node === viewport) return;
      layer.appendChild(node);
    });

    viewport.appendChild(spacer);
    viewport.appendChild(layer);
    panelContent.appendChild(viewport);
    return { viewport, spacer, layer };
  }

  applyViewportStyles(viewport);
  let spacer = getDirectChildByClass(viewport, SPACER_CLASS);
  if (!spacer) {
    spacer = document.createElement("div");
    spacer.className = SPACER_CLASS;
    applySpacerStyles(spacer);
    viewport.insertBefore(spacer, viewport.firstChild);
  } else {
    applySpacerStyles(spacer);
  }

  let layer = getDirectChildByClass(viewport, LAYER_CLASS);
  if (!layer) {
    layer = document.createElement("div");
    layer.className = LAYER_CLASS;
    applyLayerStyles(layer);
    const existing = Array.from(viewport.childNodes);
    existing.forEach((node) => {
      if (node === layer || node === spacer) return;
      layer.appendChild(node);
    });
    viewport.appendChild(layer);
  } else {
    applyLayerStyles(layer);
    Array.from(viewport.childNodes).forEach((node) => {
      if (node === layer || node === spacer) return;
      layer.appendChild(node);
    });
  }

  return { viewport, spacer, layer };
}

function unwrapViewportLayer(panelContent) {
  if (!panelContent) return false;
  const viewport = getDirectChildByClass(panelContent, VIEWPORT_CLASS);
  if (!viewport) return false;
  const layer = getDirectChildByClass(viewport, LAYER_CLASS);
  const source = layer || viewport;
  const children = Array.from(source.childNodes).filter((node) => {
    return !node?.classList?.contains?.(SPACER_CLASS);
  });
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

function getPanelPayloadId(target) {
  return target?.dataset?.instanceId ||
    target?.dataset?.instanceName ||
    target?.dataset?.id ||
    target?.dataset?.panelClass ||
    "";
}

function dispatchPanelViewportUpdated(target, state) {
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

function syncStateFromViewport(panel, refs = null) {
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

function bindViewportScroll(panel, refs) {
  if (!panel || !refs?.viewport || refs.viewport[SCROLL_BOUND_KEY]) return;
  refs.viewport[SCROLL_BOUND_KEY] = true;
  refs.viewport.addEventListener("scroll", () => {
    if (refs.viewport[APPLYING_SCROLL_KEY]) return;
    const state = syncStateFromViewport(panel, refs);
    if (state) dispatchPanelViewportUpdated(panel, state);
  }, { passive: true });
}

function disconnectResizeObserver(panel) {
  if (!panel) return;
  panel[RESIZE_OBSERVER_KEY]?.disconnect?.();
  panel[RESIZE_OBSERVER_KEY] = null;
  if (panel[RESIZE_FRAME_KEY]) {
    cancelAnimationFrame(panel[RESIZE_FRAME_KEY]);
    panel[RESIZE_FRAME_KEY] = 0;
  }
}

function ensureResizeObserver(panel, panelContent) {
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
      applyPanelViewport(panel);
    });
  });
  observer.__nvObservedPanelContent = panelContent;
  observer.observe(panelContent);
  panel[RESIZE_OBSERVER_KEY] = observer;
}

function scheduleContentBoundsChanged(panelContent, target, bounds) {
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

function measureLayerBaseSize(panelContent, refs, zoom = 1) {
  const viewportW = Math.max(1, refs.viewport.clientWidth || panelContent.clientWidth || 1);
  const viewportH = Math.max(1, refs.viewport.clientHeight || panelContent.clientHeight || 1);
  const effectiveZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM, 1);
  const zoomedOutW = Math.ceil(viewportW / effectiveZoom);
  const zoomedOutH = Math.ceil(viewportH / effectiveZoom);

  refs.layer.style.width = `${Math.max(viewportW, zoomedOutW)}px`;
  refs.layer.style.height = `${Math.max(viewportH, zoomedOutH)}px`;

  return {
    width: Math.max(1, Math.ceil(refs.layer.scrollWidth || refs.layer.offsetWidth || viewportW), zoomedOutW),
    height: Math.max(1, Math.ceil(refs.layer.scrollHeight || refs.layer.offsetHeight || viewportH), zoomedOutH),
    viewportW,
    viewportH,
  };
}

function updateViewportGeometry(panelContent, refs, zoom, panX, panY) {
  if (!panelContent || !refs?.viewport || !refs?.spacer || !refs?.layer) {
    return { panX, panY };
  }

  const { width: baseW, height: baseH, viewportW, viewportH } = measureLayerBaseSize(panelContent, refs, zoom);
  const layerLeft = Math.max(0, panX);
  const layerTop = Math.max(0, panY);
  const desiredScrollLeft = Math.max(0, -panX);
  const desiredScrollTop = Math.max(0, -panY);
  const scaledW = Math.max(1, Math.ceil(baseW * zoom));
  const scaledH = Math.max(1, Math.ceil(baseH * zoom));

  refs.layer.style.left = `${round(layerLeft, 3)}px`;
  refs.layer.style.top = `${round(layerTop, 3)}px`;
  refs.layer.style.width = `${baseW}px`;
  refs.layer.style.height = `${baseH}px`;
  refs.layer.style.setProperty("--nv-panel-content-width", `${baseW}px`);
  refs.layer.style.setProperty("--nv-panel-content-height", `${baseH}px`);
  refs.layer.style.setProperty("--nv-panel-visible-width", `${Math.ceil(viewportW / zoom)}px`);
  refs.layer.style.setProperty("--nv-panel-visible-height", `${Math.ceil(viewportH / zoom)}px`);
  refs.layer.style.transform = `scale(${round(zoom, 5)})`;

  refs.spacer.style.width = `${Math.max(viewportW, Math.ceil(layerLeft + scaledW), Math.ceil(desiredScrollLeft + viewportW))}px`;
  refs.spacer.style.height = `${Math.max(viewportH, Math.ceil(layerTop + scaledH), Math.ceil(desiredScrollTop + viewportH))}px`;

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
    visibleW: Math.ceil(viewportW / zoom),
    visibleH: Math.ceil(viewportH / zoom),
  };
}

function getEffectivePanelPan(panelContent, state) {
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
    ensureResizeObserver(target, panelContent);
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

export function zoomPanelBy(delta = 0, panel = null) {
  const target = panel || getActivePanelElement();
  if (!target) return null;
  const state = syncStateFromViewport(target) || ensureState(target);
  if (!state) return null;
  const currentZoom = Number.isFinite(Number(state.zoom)) ? Number(state.zoom) : 1;
  const nextZoom = clamp(currentZoom + Number(delta || 0), MIN_ZOOM, MAX_ZOOM, currentZoom);
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
  const contentX = (localX - effectivePan.panX) / currentZoom;
  const contentY = (localY - effectivePan.panY) / currentZoom;

  return setPanelViewportState(
    {
      zoom: nextZoom,
      panX: localX - contentX * nextZoom,
      panY: localY - contentY * nextZoom,
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
  const panX = (panelContent.clientWidth - scaledW) / 2;
  const panY = (panelContent.clientHeight - scaledH) / 2;
  return setPanelViewportState({ zoom, panX, panY }, target);
}

function activatePanelForViewport(panel) {
  if (!isTargetElement(panel)) return null;
  rememberPanel(panel);

  const owningCell = panel.classList?.contains("panel-cell") ? panel : panel.closest?.(".panel-cell");
  const panelElement = panel.classList?.contains("panel")
    ? panel
    : panel.closest?.(".panel") || getDirectChildByClass(panel, "panel");

  if (isTargetElement(panelElement)) {
    window.__nvActivePanelElement = panelElement;
  }

  const panelId =
    owningCell?.dataset?.id ||
    panelElement?.dataset?.instanceName ||
    panelElement?.dataset?.instanceId ||
    panel?.dataset?.id ||
    panel?.dataset?.panelClass ||
    "Panel";
  const panelClass =
    owningCell?.dataset?.panelClass ||
    panelElement?.dataset?.panelClass ||
    panelElement?.dataset?.panelType ||
    panel?.dataset?.panelClass ||
    "InfoPanel";

  if (owningCell?.isConnected) {
    window.activeCell = owningCell;
  }
  window.activePanel = panelId;
  window.activePanelClass = panelClass;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = panelClass;

  if (owningCell?.isConnected && typeof window.highlightActiveCell === "function") {
    window.highlightActiveCell(owningCell);
  }

  window.dispatchEvent(new CustomEvent("activePanelChanged", {
    detail: { panel: panelId, cell: owningCell || null, panelClass },
  }));

  return panelElement || panel;
}

function getWheelZoomFactor(event) {
  const deltaY = Number.isFinite(Number(event?.deltaY)) ? Number(event.deltaY) : 0;
  const boundedDelta = clamp(deltaY, -600, 600, 0);
  return Math.exp(-boundedDelta * 0.0015);
}

function getPanelCenter(panel) {
  const content = getPanelContent(panel);
  const rect = content?.getBoundingClientRect?.();
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function zoomPanelAtCenter(panel, factor) {
  const center = getPanelCenter(panel);
  if (!center) return zoomPanelAt(panel, null, null, factor);
  return zoomPanelAt(panel, center.x, center.y, factor);
}

function getZoomShortcutAction(event) {
  if (!(event?.ctrlKey || event?.metaKey) || event.altKey) return null;
  const key = String(event.key || "").toLowerCase();
  const code = String(event.code || "");

  if (key === "+" || key === "=" || code === "NumpadAdd") return "in";
  if (key === "-" || key === "_" || code === "NumpadSubtract") return "out";
  if (key === "0" || code === "Digit0" || code === "Numpad0") return "reset";
  return null;
}

export function installPanelZoomShortcuts() {
  if (typeof window === "undefined") return null;
  if (window.__nvPanelZoomShortcutsInstalled) {
    return window.__nvPanelZoomShortcutsInstalled;
  }

  const onWheel = (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;

    const panel = getPanelElementFromEvent(event);
    if (!isTargetElement(panel)) return;

    event.preventDefault();
    event.stopPropagation();
    const target = activatePanelForViewport(panel) || panel;
    zoomPanelAt(target, event.clientX, event.clientY, getWheelZoomFactor(event));
  };

  const onKeyDown = (event) => {
    const action = getZoomShortcutAction(event);
    if (!action) return;

    const panel = getPanelElementFromEvent(event) || getActivePanelElement();
    if (!isTargetElement(panel)) return;

    event.preventDefault();
    event.stopPropagation();
    const target = activatePanelForViewport(panel) || panel;

    if (action === "reset") {
      resetPanelViewport(target);
      return;
    }

    zoomPanelAtCenter(target, action === "in" ? 1.1 : 1 / 1.1);
  };

  window.addEventListener("wheel", onWheel, { capture: true, passive: false });
  window.addEventListener("keydown", onKeyDown, true);

  window.__nvPanelZoomShortcutsInstalled = {
    dispose() {
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("keydown", onKeyDown, true);
      window.__nvPanelZoomShortcutsInstalled = null;
    },
  };

  return window.__nvPanelZoomShortcutsInstalled;
}

window.NodevisionPanelViewportTools = {
  getActivePanelElement,
  getPanelElementFromElement,
  getPanelElementFromEvent,
  getPanelViewportState,
  setPanelViewportState,
  applyPanelViewport,
  zoomPanelBy,
  zoomPanelAt,
  panPanelBy,
  resetPanelViewport,
  fitPanelViewport,
  installPanelZoomShortcuts,
};
