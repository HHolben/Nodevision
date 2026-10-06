// Nodevision/ApplicationSystem/public/panels/panelZoomPanParts/layers.mjs
// This module constructs and unwraps the scroll viewport, spacer, and content layer used by generic panel zoom.

import { getDirectChildByClass } from "./ownership.mjs";
import { VIEWPORT_CLASS, SPACER_CLASS, LAYER_CLASS } from "./constants.mjs";

export function getPanelContent(panel) {
  if (!panel?.isConnected) return null;
  if (panel.classList?.contains("panel-cell")) return panel;
  if (panel.classList?.contains("panel-content")) return panel;
  if (panel.classList?.contains("nv-panel-tab-content")) return panel;
  const direct = getDirectChildByClass(panel, "panel-content");
  if (direct?.isConnected) return direct;

  // Fallback for non-standard panel roots: use the element itself.
  return panel;
}

export function applyViewportStyles(viewport) {
  Object.assign(viewport.style, {
    position: "absolute",
    inset: "0",
    overflow: "auto",
    minWidth: "0",
    minHeight: "0",
  });
}

export function applySpacerStyles(spacer) {
  Object.assign(spacer.style, {
    position: "relative",
    width: "100%",
    height: "100%",
    minWidth: "100%",
    minHeight: "100%",
    pointerEvents: "none",
  });
}

export function applyLayerStyles(layer) {
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

export function getExistingViewportLayer(panelContent) {
  if (!panelContent) return null;
  const viewport = getDirectChildByClass(panelContent, VIEWPORT_CLASS);
  if (!viewport) return null;
  return {
    viewport,
    spacer: getDirectChildByClass(viewport, SPACER_CLASS),
    layer: getDirectChildByClass(viewport, LAYER_CLASS),
  };
}

export function ensureViewportLayer(panelContent) {
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

export function unwrapViewportLayer(panelContent) {
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
