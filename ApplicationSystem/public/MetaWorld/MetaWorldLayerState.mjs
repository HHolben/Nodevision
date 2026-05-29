// Nodevision/ApplicationSystem/public/MetaWorld/MetaWorldLayerState.mjs
// This module shares MetaWorld layer state between renderer panels and layer panels. The bridge emits DOM events, and panels react without tightly coupling to a renderer.

import { createLayerPanelElement, renderFlatLayerPanel } from "/PanelInstances/Common/Layers/LayerPanelSurface.mjs";
import { createEquationExpressionEditor } from "/Equation/EquationExpressionEditor.mjs";

export const META_WORLD_LAYER_EVENTS = {
  bridgeChanged: "nodevision:metaworld-layers:bridge-changed",
  objectsChanged: "nodevision:metaworld-layers:objects-changed",
  selectionChanged: "nodevision:metaworld-layers:selection-changed",
};

const EXPRESSION_LAYER_TYPES = new Set(["functionSurface", "functionCurve", "parametricCurve"]);

let activeBridge = null;
let selectedMetaWorldLayerId = null;
let metaWorldPanelEl = null;
const expressionUpdateTimers = new Map();

function dispatchLayerEvent(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function safeListObjects(bridge) {
  if (!bridge || typeof bridge.listObjects !== "function") return [];
  try {
    const objects = bridge.listObjects();
    return Array.isArray(objects) ? objects : [];
  } catch (err) {
    console.warn("MetaWorld layers: object listing failed:", err);
    return [];
  }
}

function isExpressionLayer(entry) {
  return EXPRESSION_LAYER_TYPES.has(entry?.type);
}

function clampNumber(value, fallback, min = -Infinity, max = Infinity) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function cloneDomain(entry) {
  const domain = entry?.domain && typeof entry.domain === "object" ? entry.domain : {};
  const readRange = (key, fallback) => {
    const value = Array.isArray(domain[key]) ? domain[key] : fallback;
    const a = clampNumber(value[0], fallback[0]);
    const b = clampNumber(value[1], fallback[1]);
    return [Math.min(a, b), Math.max(a, b)];
  };
  return {
    x: readRange("x", [-10, 10]),
    y: readRange("y", [-10, 10]),
    t: readRange("t", [0, 18.84955592153876]),
    resolution: Math.floor(clampNumber(domain.resolution, 80, 8, 160)),
  };
}

function cloneMaterial(entry) {
  const material = entry?.material && typeof entry.material === "object" ? entry.material : {};
  return {
    color: typeof material.color === "string" && material.color.trim() ? material.color : "#44aa88",
    wireframe: material.wireframe === true,
  };
}

function cloneCollider(entry) {
  const collider = entry?.collider && typeof entry.collider === "object" ? entry.collider : {};
  return {
    enabled: collider.enabled === true,
    type: collider.type || "none",
  };
}

function updateExpressionLayer(objectId, patch = {}) {
  if (!activeBridge || typeof activeBridge.updateExpressionLayer !== "function") return false;
  return activeBridge.updateExpressionLayer(objectId, patch) !== false;
}

function debounceExpressionLayerUpdate(objectId, patch = {}, delay = 350) {
  const existing = expressionUpdateTimers.get(objectId) || {};
  clearTimeout(existing.timer);
  const nextPatch = {
    ...(existing.patch || {}),
    ...patch,
    domain: { ...(existing.patch?.domain || {}), ...(patch.domain || {}) },
    material: { ...(existing.patch?.material || {}), ...(patch.material || {}) },
    collider: { ...(existing.patch?.collider || {}), ...(patch.collider || {}) },
  };
  if (!patch.domain && !existing.patch?.domain) delete nextPatch.domain;
  if (!patch.material && !existing.patch?.material) delete nextPatch.material;
  if (!patch.collider && !existing.patch?.collider) delete nextPatch.collider;
  const timer = window.setTimeout(() => {
    expressionUpdateTimers.delete(objectId);
    updateExpressionLayer(objectId, nextPatch);
  }, delay);
  expressionUpdateTimers.set(objectId, { timer, patch: nextPatch });
}

function makeExpressionField(labelText, value, onInput, options = {}) {
  const label = document.createElement("label");
  Object.assign(label.style, {
    display: "grid",
    gap: "2px",
    fontSize: "11px",
    color: "#444",
  });
  const span = document.createElement("span");
  span.textContent = labelText;
  const input = document.createElement("input");
  input.type = options.type || "text";
  input.value = value == null ? "" : String(value);
  if (options.step) input.step = options.step;
  if (options.min != null) input.min = String(options.min);
  if (options.max != null) input.max = String(options.max);
  if (options.placeholder) input.placeholder = options.placeholder;
  Object.assign(input.style, {
    boxSizing: "border-box",
    width: "100%",
    minWidth: "0",
    fontSize: "12px",
  });
  input.addEventListener(options.event || "input", () => onInput?.(input));
  label.append(span, input);
  return { label, input };
}

function makeInlineCheckbox(labelText, checked, onChange) {
  const label = document.createElement("label");
  Object.assign(label.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    color: "#444",
  });
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked === true;
  input.addEventListener("change", () => onChange?.(input.checked));
  label.append(input, document.createTextNode(labelText));
  return label;
}

function renderExpressionLayerDetails(wrapper, entry) {
  if (!isExpressionLayer(entry)) return;
  const details = document.createElement("div");
  Object.assign(details.style, {
    borderTop: "1px solid #e3e3e3",
    padding: "5px 6px 6px",
    display: "grid",
    gap: "5px",
    background: "#fbfbfb",
  });

  const typeLine = document.createElement("div");
  typeLine.textContent = entry.type;
  Object.assign(typeLine.style, {
    justifySelf: "start",
    border: "1px solid #d2d2d2",
    borderRadius: "4px",
    padding: "1px 5px",
    fontSize: "10px",
    color: "#555",
    background: "#fff",
  });
  details.appendChild(typeLine);

  const nameField = makeExpressionField("Name", entry.name || "Expression Layer", (input) => {
    updateExpressionLayer(entry.id, { name: input.value });
  }, { event: "change" });
  details.appendChild(nameField.label);

  const expressionLabel = document.createElement("div");
  expressionLabel.textContent = "Expression";
  Object.assign(expressionLabel.style, {
    fontSize: "11px",
    color: "#444",
  });
  details.appendChild(expressionLabel);

  const expressionEditor = createEquationExpressionEditor({
    currentExpressionText: entry.expression || "z = sin(x) * cos(y)",
    onChange: (value) => debounceExpressionLayerUpdate(entry.id, { expression: value }),
    allowedVariables: ["x", "y", "z", "t", "time"],
    allowedFunctions: ["sin", "cos", "tan", "sqrt", "abs", "floor", "ceil", "min", "max", "exp", "log"],
    allowedConstants: ["pi", "e", "tau", "phi", "sqrt2", "alpha", "beta", "gamma", "theta", "sigma"],
    compactMode: true,
    panelRowMode: true,
    dialect: "expression",
    placeholder: "z = sin(x) * cos(y)",
    collapsedTools: true,
  });
  details.appendChild(expressionEditor.root);

  const error = document.createElement("div");
  error.textContent = entry.error || "";
  Object.assign(error.style, {
    minHeight: "14px",
    fontSize: "11px",
    color: entry.error ? "#b42318" : "#5f6f52",
    overflowWrap: "anywhere",
  });
  if (!entry.error) error.textContent = "Expression is valid.";
  details.appendChild(error);

  const material = cloneMaterial(entry);
  const materialRow = document.createElement("div");
  Object.assign(materialRow.style, {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "6px",
    alignItems: "end",
  });
  const colorField = makeExpressionField("Color", material.color, (input) => {
    updateExpressionLayer(entry.id, { material: { color: input.value } });
  }, { type: "color", event: "change" });
  materialRow.appendChild(colorField.label);
  materialRow.appendChild(makeInlineCheckbox("Wire", material.wireframe, (checked) => {
    updateExpressionLayer(entry.id, { material: { wireframe: checked } });
  }));
  details.appendChild(materialRow);

  const domain = cloneDomain(entry);
  const domainDetails = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Domain";
  Object.assign(summary.style, { cursor: "pointer", fontSize: "11px", color: "#444" });
  domainDetails.appendChild(summary);

  const grid = document.createElement("div");
  Object.assign(grid.style, {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "4px",
    marginTop: "5px",
  });

  const addNumber = (label, value, patchFactory, options = {}) => {
    const field = makeExpressionField(label, value, (input) => {
      const next = clampNumber(input.value, value, options.min ?? -Infinity, options.max ?? Infinity);
      updateExpressionLayer(entry.id, patchFactory(next));
    }, { type: "number", step: options.step || "0.5", min: options.min, max: options.max, event: "change" });
    grid.appendChild(field.label);
  };

  addNumber("X min", domain.x[0], (value) => ({ domain: { x: [value, domain.x[1]] } }));
  addNumber("X max", domain.x[1], (value) => ({ domain: { x: [domain.x[0], value] } }));
  addNumber("Y min", domain.y[0], (value) => ({ domain: { y: [value, domain.y[1]] } }));
  addNumber("Y max", domain.y[1], (value) => ({ domain: { y: [domain.y[0], value] } }));
  addNumber("T min", domain.t[0], (value) => ({ domain: { t: [value, domain.t[1]] } }));
  addNumber("T max", domain.t[1], (value) => ({ domain: { t: [domain.t[0], value] } }));
  addNumber("Resolution", domain.resolution, (value) => ({ domain: { resolution: Math.round(value) } }), { step: "1", min: 8, max: 160 });

  const collider = cloneCollider(entry);
  const colliderWrap = document.createElement("div");
  Object.assign(colliderWrap.style, { gridColumn: "1 / -1" });
  colliderWrap.appendChild(makeInlineCheckbox("Collider", collider.enabled, (checked) => {
    updateExpressionLayer(entry.id, { collider: { enabled: checked, type: checked ? "generated" : "none" } });
  }));
  grid.appendChild(colliderWrap);

  domainDetails.appendChild(grid);
  details.appendChild(domainDetails);
  wrapper.appendChild(details);
}

export function setActiveMetaWorldLayerBridge(bridge = null) {
  expressionUpdateTimers.forEach((entry) => clearTimeout(entry.timer));
  expressionUpdateTimers.clear();
  activeBridge = bridge || null;
  dispatchLayerEvent(META_WORLD_LAYER_EVENTS.bridgeChanged, {
    bridge: activeBridge,
    objects: safeListObjects(activeBridge),
  });
  notifyMetaWorldLayersChanged({ reason: "bridgeChanged" });
}

export function clearActiveMetaWorldLayerBridge(sourceId = null) {
  if (sourceId && activeBridge?.sourceId !== sourceId) return;
  setActiveMetaWorldLayerBridge(null);
}

export function getActiveMetaWorldLayerBridge() {
  return activeBridge;
}

export function listMetaWorldLayerObjects() {
  return safeListObjects(activeBridge);
}

export function addMetaWorldExpressionLayer(overrides = {}) {
  if (!activeBridge || typeof activeBridge.addExpressionLayer !== "function") return null;
  const layer = activeBridge.addExpressionLayer(overrides);
  if (layer?.id) selectedMetaWorldLayerId = layer.id;
  return layer;
}

export function updateMetaWorldExpressionLayer(objectId, patch = {}) {
  return updateExpressionLayer(objectId, patch);
}

export function removeMetaWorldExpressionLayer(objectId) {
  if (!activeBridge || typeof activeBridge.removeExpressionLayer !== "function") return false;
  const removed = activeBridge.removeExpressionLayer(objectId) !== false;
  if (removed && selectedMetaWorldLayerId === objectId) selectedMetaWorldLayerId = null;
  return removed;
}

export function setMetaWorldObjectVisibility(objectId, visible) {
  if (!activeBridge || typeof activeBridge.setObjectVisibility !== "function") {
    return false;
  }
  const didChange = activeBridge.setObjectVisibility(objectId, visible) !== false;
  if (didChange) {
    notifyMetaWorldLayersChanged({ reason: "visibilityChanged", objectId, visible });
  }
  return didChange;
}

export function selectMetaWorldObject(objectId) {
  if (!activeBridge || typeof activeBridge.selectObject !== "function") {
    return false;
  }
  const selected = activeBridge.selectObject(objectId) !== false;
  if (selected) {
    dispatchLayerEvent(META_WORLD_LAYER_EVENTS.selectionChanged, { objectId });
  }
  return selected;
}

export function notifyMetaWorldLayersChanged(detail = {}) {
  dispatchLayerEvent(META_WORLD_LAYER_EVENTS.objectsChanged, {
    ...detail,
    objects: safeListObjects(activeBridge),
  });
}

function layerObjectText(entry, index) {
  return entry?.name || entry?.tag || entry?.id || "Object " + (index + 1);
}

function layerTypeText(entry) {
  const type = entry?.type || "mesh";
  const expression = entry?.expression || entry?.equation || entry?.equationCollider?.expression || "";
  return expression ? type + " - " + expression : type;
}

function readObjectId(entry, index) {
  const candidates = [entry?.id, entry?.tag, entry?.name, entry?.label, entry?.title];
  const explicit = candidates.find((value) => typeof value === "string" && value.trim());
  return explicit ? explicit.trim() : "metaworld-object-" + index;
}

function findWorldObjectByLayerId(worldData, objectId) {
  const objects = Array.isArray(worldData?.objects) ? worldData.objects : [];
  return objects.find((entry, index) => readObjectId(entry, index) === objectId) || null;
}

function moveMetaWorldLayer(objectId, direction) {
  const bridge = getActiveMetaWorldLayerBridge();
  if (typeof bridge?.moveObjectLayer === "function") {
    return bridge.moveObjectLayer(objectId, direction) !== false;
  }
  const objects = Array.isArray(bridge?.worldData?.objects) ? bridge.worldData.objects : [];
  const index = objects.findIndex((entry, entryIndex) => readObjectId(entry, entryIndex) === objectId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= objects.length) return false;
  const [entry] = objects.splice(index, 1);
  objects.splice(nextIndex, 0, entry);
  if (bridge.worldData.metadata && typeof bridge.worldData.metadata === "object") {
    bridge.worldData.metadata.visibilityDirty = true;
  }
  notifyMetaWorldLayersChanged({ reason: "orderChanged", objectId });
  return true;
}

function renameMetaWorldLayer(objectId, nextName) {
  const bridge = getActiveMetaWorldLayerBridge();
  if (typeof bridge?.updateExpressionLayer === "function") {
    const entry = listMetaWorldLayerObjects().find((candidate) => candidate.id === objectId);
    if (isExpressionLayer(entry)) return updateExpressionLayer(objectId, { name: nextName });
  }
  const target = findWorldObjectByLayerId(bridge?.worldData, objectId);
  const trimmed = String(nextName || "").trim();
  if (!target || !trimmed) return false;
  target.name = trimmed;
  if (bridge.worldData.metadata && typeof bridge.worldData.metadata === "object") {
    bridge.worldData.metadata.visibilityDirty = true;
  }
  notifyMetaWorldLayersChanged({ reason: "renamed", objectId });
  return true;
}

function renderMetaWorldSvgStylePanel(panelEl) {
  const bridge = getActiveMetaWorldLayerBridge();
  const entries = listMetaWorldLayerObjects();
  renderFlatLayerPanel({
    panelEl,
    layers: entries,
    activeLayerId: selectedMetaWorldLayerId,
    selectedLayerId: selectedMetaWorldLayerId,
    emptyText: bridge ? "No layers found in this MetaWorld." : "Open a MetaWorld in Virtual World Editing to show layers.",
    addDisabled: !(bridge && typeof bridge.addExpressionLayer === "function"),
    addTitle: "Add Expression Layer",
    getLayerId: (entry) => entry.id,
    getLayerName: (entry, index) => layerObjectText(entry, index),
    getLayerTitle: (entry) => layerTypeText(entry),
    isLayerVisible: (entry) => entry.visible !== false,
    onAddLayer: () => addMetaWorldExpressionLayer(),
    onToggleVisible: (entry) => setMetaWorldObjectVisibility(entry.id, entry.visible === false),
    onSelectLayer: (entry) => {
      selectedMetaWorldLayerId = entry.id;
      selectMetaWorldObject(entry.id);
      renderMetaWorldSvgStylePanel(panelEl);
    },
    onMoveLayerUp: (entry) => moveMetaWorldLayer(entry.id, 1),
    onMoveLayerDown: (entry) => moveMetaWorldLayer(entry.id, -1),
    onRenameLayer: (entry, index) => {
      const next = prompt("Layer name:", layerObjectText(entry, index));
      if (!next) return;
      renameMetaWorldLayer(entry.id, next);
    },
    onDeleteLayer: (entry) => removeMetaWorldExpressionLayer(entry.id),
    renderLayerDetails: renderExpressionLayerDetails,
    deleteDisabled: (entry) => !isExpressionLayer(entry),
  });
}

function attachMetaWorldLayersHost(host) {
  if (!host) return () => {};
  host.innerHTML = "";
  if (!metaWorldPanelEl) {
    metaWorldPanelEl = createLayerPanelElement();
  }
  if (metaWorldPanelEl.parentElement && metaWorldPanelEl.parentElement !== host) {
    metaWorldPanelEl.parentElement.removeChild(metaWorldPanelEl);
  }
  host.appendChild(metaWorldPanelEl);

  const render = () => renderMetaWorldSvgStylePanel(metaWorldPanelEl);
  window.addEventListener(META_WORLD_LAYER_EVENTS.bridgeChanged, render);
  window.addEventListener(META_WORLD_LAYER_EVENTS.objectsChanged, render);
  render();
  return () => {
    window.removeEventListener(META_WORLD_LAYER_EVENTS.bridgeChanged, render);
    window.removeEventListener(META_WORLD_LAYER_EVENTS.objectsChanged, render);
  };
}

export function ensureMetaWorldLayersContext() {
  window.MetaWorldLayersContext = {
    id: "metaworld",
    title: "MetaWorld Layers",
    attachHost: attachMetaWorldLayersHost,
  };
  return window.MetaWorldLayersContext;
}

if (typeof window !== "undefined") {
  ensureMetaWorldLayersContext();
}
