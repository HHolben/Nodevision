// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ElementLayers.mjs
// This file defines browser-side Element Layers logic for the Nodevision UI. It renders interface components and handles user interactions.

import { createPanelElement, renderLayersPanel } from "./ElementLayers/panel.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";

function qsa(root, selector) {
  return Array.from(root.querySelectorAll(selector));
}

function ensureGroup(svgRoot, name = "Layer 1", id = null) {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("data-layer", "true");
  group.setAttribute("data-layer-name", name);
  group.setAttribute("id", id || `layer-${Math.random().toString(36).slice(2, 9)}`);
  return group;
}

function isEditorUiNode(node) {
  return Boolean(node?.nodeType === Node.ELEMENT_NODE && node.getAttribute?.("data-nv-editor-ui"));
}

export function createElementLayers(svgRoot, hostPanel = null, options = {}) {
  if (!svgRoot) throw new Error("svgRoot is required");

  const keys = new WeakMap(); let keyIndex = 0;
  const getLayerKey = layer => {
    if (layer === svgRoot) return "__nv-svg-document";
    if (layer.id) return layer.id;
    if (!keys.has(layer)) keys.set(layer, `inspection-layer-${++keyIndex}`);
    return keys.get(layer);
  };
  let activeLayerId = null;
  let panelEl = null;
  let layerClipboard = [];
  let renderQueued = false;
  let domObserver = null;
  let pendingError = null;
  function reportError(message) {
    const state = panelEl?.__nvElementLayersState;
    if (!state?.dragMessage) { pendingError = message; return; }
    state.lastDragError = message; state.dragMessage.textContent = message;
  }

  function getLayers() { return qsa(svgRoot, ":scope > g[data-layer='true']"); }

  function getPanelLayers() {
    const layers = qsa(svgRoot, ":scope > g[data-layer='true']");
    const loose = Array.from(svgRoot.children).some(child => !isEditorUiNode(child) && !layers.includes(child));
    return loose || !layers.length ? [svgRoot, ...layers] : layers;
  }

  function getLayerById(layerId) {
    if (!layerId) return null;
    return getPanelLayers().find((l) => getLayerKey(l) === layerId) || null;
  }

  function getLayerName(layer) {
    return layer?.getAttribute?.("data-layer-name") || layer?.id || "Layer";
  }

  function makeUniqueLayerId() {
    const existing = new Set(getLayers().map((l) => l.id).filter(Boolean));
    let next = "";
    do {
      next = `layer-${Math.random().toString(36).slice(2, 9)}`;
    } while (existing.has(next));
    return next;
  }

  function makeUniqueLayerName(baseName) {
    const existing = new Set(getLayers().map((l) => getLayerName(l)));
    const trimmed = String(baseName || "Layer").trim() || "Layer";
    if (!existing.has(trimmed)) return trimmed;
    const copyBase = `${trimmed} copy`;
    if (!existing.has(copyBase)) return copyBase;
    let i = 2;
    while (existing.has(`${copyBase} ${i}`)) i += 1;
    return `${copyBase} ${i}`;
  }

  function normalizeInitialLayers() {
    const layers = getLayers();
    layers.forEach((layer, i) => {
      if (options.readOnly || layer === svgRoot) return;
      if (!layer.getAttribute("id")) {
        layer.setAttribute("id", `layer-${i + 1}`);
      }
      if (!layer.getAttribute("data-layer-name")) {
        layer.setAttribute("data-layer-name", `Layer ${i + 1}`);
      }
    });
    if (!activeLayerId || !layers.find((l) => getLayerKey(l) === activeLayerId)) {
      // Match "top of list is top on canvas" behavior by defaulting to the topmost layer.
      activeLayerId = layers.length ? getLayerKey(layers[layers.length - 1]) : getLayerKey(svgRoot);
    }
  }

  function getActiveLayer() {
    return activeLayerId === getLayerKey(svgRoot) ? null : getLayers().find((l) => getLayerKey(l) === activeLayerId) || getLayers()[0] || null;
  }

  function setActiveLayer(layerId) {
    if (!layerId || activeLayerId === layerId) return;
    activeLayerId = layerId;
    renderPanel();
  }

  function createLayer(name = null) {
    const layers = getLayers();
    const nextName = name || `Layer ${layers.length + 1}`;
    const layer = ensureGroup(svgRoot, nextName);
    svgRoot.appendChild(layer);
    activeLayerId = layer.id;
    renderPanel();
    return layer;
  }

  function appendToActiveLayer(node) {
    const layer = getActiveLayer();
    if (layer && layer !== svgRoot) {
      layer.appendChild(node);
    } else {
      const firstUiNode = Array.from(svgRoot.childNodes).find((child) => isEditorUiNode(child)) || null;
      svgRoot.insertBefore(node, firstUiNode);
    }
    queueRender();
  }

  function copyLayer(layerId) {
    const layer = getLayerById(layerId);
    if (!layer || layer === svgRoot) return false;
    layerClipboard = [layer.cloneNode(true)];
    return true;
  }

  function cutLayer(layerId) {
    const target = getLayerById(layerId);
    if (!target || target === svgRoot) return false;
    if (!copyLayer(layerId)) return false;

    const layers = getLayers();
    if (layers.length <= 1) {
      while (target.firstChild) target.removeChild(target.firstChild);
      renderPanel();
      return true;
    }

    const fallback = layers.find((l) => l !== target) || null;
    target.remove();
    activeLayerId = fallback?.id || null;
    renderPanel();
    return true;
  }

  function pasteLayer(afterLayerId = null) {
    if (!layerClipboard.length) return null;
    const template = layerClipboard[0];
    if (!template) return null;

    const clone = template.cloneNode(true);
    clone.setAttribute("data-layer", "true");
    clone.setAttribute("id", makeUniqueLayerId());
    clone.setAttribute("data-layer-name", makeUniqueLayerName(getLayerName(template)));

    const layers = getLayers();
    const after = afterLayerId ? layers.find((l) => l.id === afterLayerId) : getActiveLayer();
    const ref = after?.parentNode === svgRoot ? after.nextSibling : null;
    svgRoot.insertBefore(clone, ref);

    activeLayerId = clone.id;
    renderPanel();
    return clone;
  }

  function removeLayer(layerId) {
    const layers = getLayers();
    if (layers.length <= 1) return false;
    const target = layers.find((l) => getLayerKey(l) === layerId);
    if (!target || target === svgRoot) return false;
    const fallback = layers.find((l) => l !== target) || null;
    while (target.firstChild && fallback) {
      fallback.appendChild(target.firstChild);
    }
    target.remove();
    activeLayerId = fallback?.id || null;
    renderPanel();
    return true;
  }

  function setLayerVisible(layerId, visible) {
    const layer = getLayers().find((l) => getLayerKey(l) === layerId);
    if (!layer) return;
    layer.style.display = visible ? "" : "none";
    renderPanel();
  }

  function moveLayer(layerId, direction) {
    const layers = getLayers().filter(layer => layer !== svgRoot);
    const idx = layers.findIndex((l) => getLayerKey(l) === layerId);
    if (idx < 0) return;
    const layer = layers[idx];
    // direction < 0 means "move up in panel", i.e. toward front/top on canvas.
    const swapIdx = direction < 0 ? idx + 1 : idx - 1;
    if (swapIdx < 0 || swapIdx >= layers.length) return;
    const other = layers[swapIdx];
    if (direction < 0) {
      svgRoot.insertBefore(other, layer);
    } else {
      svgRoot.insertBefore(layer, other);
    }
    renderPanel();
  }

  function moveLayerTo(layerId, targetLayerId, position = "before") {
    const layer = getLayerById(layerId);
    const target = getLayerById(targetLayerId);
    if (!layer || !target || layer === target || layer === svgRoot || target === svgRoot) return;
    if (position === "after" && target.nextSibling) {
      svgRoot.insertBefore(layer, target.nextSibling);
    } else if (position === "after") {
      svgRoot.appendChild(layer);
    } else {
      svgRoot.insertBefore(layer, target);
    }
    renderPanel();
  }

  function moveElementToLayer(element, targetLayerId, beforeElement = null, targetParent = null) {
    const target = targetParent || getLayerById(targetLayerId);
    if (options.onMove) return options.onMove(element, target, beforeElement);
    const context = options.getContext?.() || window.SVGEditorContext;
    if (context?.svgRoot !== svgRoot || options.readOnly) return false;
    return context.reparentLayerElement?.(element, target, beforeElement);
  }

  function queueRender() {
    if (!panelEl || renderQueued) return;
    renderQueued = true;
    queueMicrotask(() => {
      renderQueued = false;
      renderPanel();
    });
  }

  function renderPanel() {
    if (!panelEl) return;
    renderLayersPanel({
      panelEl,
      context: options.getContext?.() || (options.readOnly ? null : window.SVGEditorContext),
      readOnly: Boolean(options.readOnly), svgRoot, getLayerKey,
      getLayers: getPanelLayers,
      activeLayerId,
      createLayer,
      setActiveLayer,
      setLayerVisible,
      moveLayer,
      moveLayerTo,
      moveElementToLayer,
      removeLayer,
      rerender: queueRender,
    });
    if (pendingError !== null) { reportError(pendingError); pendingError = null; }
  }

  function attachHost(nextHost) {
    if (!nextHost) return;
    if (!panelEl) {
      panelEl = createPanelElement();
    }
    if (panelEl.parentElement && panelEl.parentElement !== nextHost) {
      panelEl.parentElement.removeChild(panelEl);
    }
    nextHost.appendChild(panelEl);
    renderPanel();
    return () => { if (panelEl?.parentElement === nextHost) panelEl.remove(); };
  }

  function dispose() {
    domObserver?.disconnect();
    const state = panelEl?.__nvElementLayersState;
    state?.dragCleanup?.(); state?.selectionCleanup?.(); state?.sketchCleanup?.();
    panelEl?.remove(); panelEl = null;
  }

  normalizeInitialLayers();
  if (hostPanel) attachHost(hostPanel);

  // Keep panel order synced with DOM ordering changes (append/insert/remove/reorder).
  domObserver = new MutationObserver((records) => {
    const hasStructureChange = records.some((r) => r.type === "childList");
    if (!hasStructureChange) return;
    normalizeInitialLayers();
    queueRender();
  });
  domObserver.observe(svgRoot, { childList: true, subtree: true });

  return {
    getLayers,
    getLayerKey, dispose, reportError,
    getActiveLayer,
    setActiveLayer,
    createLayer,
    appendToActiveLayer,
    setLayerVisible,
    moveLayer,
    moveLayerTo,
    removeLayer,
    copyLayer,
    cutLayer,
    pasteLayer,
    moveElementToLayer,
    renderPanel,
    attachHost
  };
}
