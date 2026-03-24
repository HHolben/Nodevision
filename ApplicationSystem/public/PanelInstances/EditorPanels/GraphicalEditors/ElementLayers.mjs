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

export function createElementLayers(svgRoot, hostPanel = null) {
  if (!svgRoot) throw new Error("svgRoot is required");

  let activeLayerId = null;
  let panelEl = null;
  let layerClipboard = [];

  function getLayers() {
    return qsa(svgRoot, ":scope > g[data-layer='true']");
  }

  function getLayerById(layerId) {
    if (!layerId) return null;
    return getLayers().find((l) => l.id === layerId) || null;
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
    let layers = getLayers();
    if (layers.length === 0) {
      const layer1 = ensureGroup(svgRoot, "Layer 1");
      while (svgRoot.firstChild) {
        layer1.appendChild(svgRoot.firstChild);
      }
      svgRoot.appendChild(layer1);
      layers = [layer1];
    }
    layers.forEach((layer, i) => {
      if (!layer.getAttribute("id")) {
        layer.setAttribute("id", `layer-${i + 1}`);
      }
      if (!layer.getAttribute("data-layer-name")) {
        layer.setAttribute("data-layer-name", `Layer ${i + 1}`);
      }
    });
    if (!activeLayerId || !layers.find((l) => l.id === activeLayerId)) {
      activeLayerId = layers[0]?.id || null;
    }
  }

  function getActiveLayer() {
    return getLayers().find((l) => l.id === activeLayerId) || getLayers()[0] || null;
  }

  function setActiveLayer(layerId) {
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
    if (!layer) return;
    layer.appendChild(node);
  }

  function copyLayer(layerId) {
    const layer = getLayerById(layerId);
    if (!layer) return false;
    layerClipboard = [layer.cloneNode(true)];
    return true;
  }

  function cutLayer(layerId) {
    const target = getLayerById(layerId);
    if (!target) return false;
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
    const ref = after?.nextSibling || null;
    svgRoot.insertBefore(clone, ref);

    activeLayerId = clone.id;
    renderPanel();
    return clone;
  }

  function removeLayer(layerId) {
    const layers = getLayers();
    if (layers.length <= 1) return false;
    const target = layers.find((l) => l.id === layerId);
    if (!target) return false;
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
    const layer = getLayers().find((l) => l.id === layerId);
    if (!layer) return;
    layer.style.display = visible ? "" : "none";
  }

  function moveLayer(layerId, direction) {
    const layers = getLayers();
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx < 0) return;
    const layer = layers[idx];
    const swapIdx = direction < 0 ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= layers.length) return;
    const other = layers[swapIdx];
    if (direction < 0) {
      svgRoot.insertBefore(layer, other);
    } else {
      svgRoot.insertBefore(other, layer);
    }
    renderPanel();
  }

  function renderPanel() {
    if (!panelEl) return;
    renderLayersPanel({
      panelEl,
      getLayers,
      activeLayerId,
      createLayer,
      setActiveLayer,
      setLayerVisible,
      moveLayer,
      removeLayer,
      rerender: renderPanel,
    });
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
  }

  normalizeInitialLayers();
  if (hostPanel) attachHost(hostPanel);

  return {
    getLayers,
    getActiveLayer,
    setActiveLayer,
    createLayer,
    appendToActiveLayer,
    setLayerVisible,
    moveLayer,
    removeLayer,
    copyLayer,
    cutLayer,
    pasteLayer,
    renderPanel,
    attachHost
  };
}
