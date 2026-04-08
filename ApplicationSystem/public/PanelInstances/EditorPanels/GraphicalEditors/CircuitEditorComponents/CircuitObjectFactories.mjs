// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitObjectFactories.mjs
// This file defines factories that generate schematic components and wires. This file keeps id generation and default property filling together.

import { getSymbol } from "./SymbolLibrary.mjs";

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createComponent(symbolId, position, rotation = 0, refOverride = null) {
  const symbol = getSymbol(symbolId);
  const defaults = symbol?.defaults || {};
  return {
    id: makeId("cmp"),
    type: symbolId,
    x: position.x,
    y: position.y,
    rotation,
    properties: { ref: refOverride || defaults.ref || "?", value: defaults.value || "" },
  };
}

export function createWire(points) {
  return {
    id: makeId("wire"),
    points: points.map((p) => ({
      x: p.x,
      y: p.y,
      __attach: p.__attach || null,
    })),
    net: "",
  };
}

export function createLabel(text, position) {
  return { id: makeId("lbl"), text, x: position.x, y: position.y };
}

export function cloneObjects(items) {
  return items.map((item) => JSON.parse(JSON.stringify(item)));
}
