// Nodevision/ApplicationSystem/public/ScadEditor/ScadLayerPanelContext.mjs
// Shared Layers panel provider for the graphical SCAD editor.

import { createLayerPanelElement, renderFlatLayerPanel } from "/PanelInstances/Common/Layers/LayerPanelSurface.mjs";
import { addLayer, deleteLayer, deleteParameter, moveObjectToLayer, reorderLayer, setLayerLocked, setLayerVisibility, setParameter } from "./ScadModel.mjs";

export const SCAD_LAYERS_CHANGED_EVENT = "nodevision:scad-layers-changed";
export const SCAD_SELECTION_CHANGED_EVENT = "nodevision:scad-selection-changed";

let activeController = null;
let activePanelEl = null;
let activeHost = null;
let cleanupListeners = [];

function getModel() {
  return activeController?.getModel?.() || null;
}

function getSelectedIds() {
  return activeController?.getSelectedIds?.() || [];
}

function getActiveLayerId() {
  return activeController?.getActiveLayerId?.() || getModel()?.layers?.[0]?.id || null;
}

function commitLayerChange() {
  activeController?.markDirty?.();
  activeController?.refresh?.();
  notifyScadLayersChanged();
}

function selectObjectFromPanel(objectId, event) {
  activeController?.selectObject?.(objectId, event || null);
  notifyScadSelectionChanged();
}

function renderObjectRow(obj, selectedIds) {
  const row = document.createElement("button");
  row.type = "button";
  row.textContent = "Mesh: " + (obj.name || obj.type || obj.id);
  row.title = obj.id;
  Object.assign(row.style, {
    width: "100%",
    textAlign: "left",
    border: selectedIds.includes(obj.id) ? "1px solid #f59e0b" : "1px solid #d7dce5",
    borderRadius: "4px",
    background: obj.visible === false ? "#f3f4f6" : "#fff",
    color: obj.locked ? "#6b7280" : "#111827",
    padding: "4px 6px",
    font: "11px/1.25 system-ui, sans-serif",
    cursor: obj.locked ? "not-allowed" : "pointer",
    opacity: obj.visible === false ? "0.7" : "1",
  });
  row.addEventListener("click", (event) => selectObjectFromPanel(obj.id, event));
  return row;
}

function renderLayerExtras(wrapper, layer) {
  const model = getModel();
  if (!model) return;
  const selectedIds = getSelectedIds();
  const details = document.createElement("div");
  Object.assign(details.style, {
    display: "grid",
    gap: "4px",
    padding: "0 6px 6px 28px",
  });

  const toolbar = document.createElement("div");
  Object.assign(toolbar.style, { display: "flex", gap: "4px", flexWrap: "wrap" });

  const lockButton = document.createElement("button");
  lockButton.type = "button";
  lockButton.textContent = layer.locked ? "Unlock" : "Lock";
  lockButton.title = layer.locked ? "Unlock layer" : "Lock layer";
  lockButton.addEventListener("click", (event) => {
    event.stopPropagation();
    setLayerLocked(model, layer.id, !layer.locked);
    commitLayerChange();
  });
  toolbar.appendChild(lockButton);

  const canMoveSelection = selectedIds.some((id) => model.objects.some((obj) => obj.id === id && obj.layerId !== layer.id));
  const moveButton = document.createElement("button");
  moveButton.type = "button";
  moveButton.textContent = "Move Selected Here";
  moveButton.disabled = !canMoveSelection || layer.locked;
  moveButton.addEventListener("click", (event) => {
    event.stopPropagation();
    selectedIds.forEach((objectId) => moveObjectToLayer(model, objectId, layer.id));
    activeController?.setActiveLayer?.(layer.id);
    commitLayerChange();
  });
  toolbar.appendChild(moveButton);
  details.appendChild(toolbar);

  const objects = model.objects.filter((obj) => obj.layerId === layer.id);
  if (!objects.length) {
    const empty = document.createElement("div");
    empty.textContent = "No objects on this layer.";
    Object.assign(empty.style, { color: "#6b7280", font: "11px/1.35 system-ui, sans-serif" });
    details.appendChild(empty);
  } else {
    objects.forEach((obj) => details.appendChild(renderObjectRow(obj, selectedIds)));
  }

  wrapper.appendChild(details);
}

function formatParameterInput(value) {
  if (Array.isArray(value)) return "[" + value.map(formatParameterInput).join(", ") + "]";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "";
  return String(value);
}

function parsePanelParameterValue(rawValue = "") {
  const raw = String(rawValue || "").trim();
  if (raw.toLowerCase() === "true") return true;
  if (raw.toLowerCase() === "false") return false;
  const numeric = Number(raw);
  return raw && Number.isFinite(numeric) ? numeric : raw;
}

function commitParameterValue(name, rawValue) {
  const model = getModel();
  if (!model) return false;
  if (!setParameter(model, name, parsePanelParameterValue(rawValue))) return false;
  commitLayerChange();
  return true;
}

function renderParameterRow(name, value) {
  const row = document.createElement("div");
  Object.assign(row.style, { display: "grid", gridTemplateColumns: "minmax(70px, 0.85fr) minmax(72px, 1fr) auto", gap: "4px", alignItems: "center" });

  const label = document.createElement("div");
  label.textContent = name;
  label.title = name;
  Object.assign(label.style, { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: "11px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", color: "#374151" });
  row.appendChild(label);

  const input = document.createElement("input");
  input.type = "text";
  input.value = formatParameterInput(value);
  input.title = "SCAD variable value";
  Object.assign(input.style, { width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: "4px", padding: "3px 5px", font: "11px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" });
  input.addEventListener("change", () => commitParameterValue(name, input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
  });
  row.appendChild(input);

  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "Delete";
  del.title = "Delete variable";
  Object.assign(del.style, { font: "10px/1 system-ui, sans-serif", padding: "4px 5px", border: "1px solid #d1d5db", borderRadius: "4px", background: "#fff", cursor: "pointer" });
  del.addEventListener("click", () => {
    const model = getModel();
    if (!model || !confirm("Delete variable " + name + "?")) return;
    if (deleteParameter(model, name)) commitLayerChange();
  });
  row.appendChild(del);
  return row;
}

function renderVariablesSection(model) {
  const section = document.createElement("div");
  Object.assign(section.style, { border: "1px solid #d5d5d5", borderRadius: "6px", background: "#fff", padding: "6px", marginBottom: "8px" });

  const header = document.createElement("div");
  Object.assign(header.style, { display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" });
  const title = document.createElement("div");
  title.textContent = "Variables";
  Object.assign(title.style, { flex: "1", font: "700 12px/1.25 system-ui, sans-serif", color: "#111827" });
  header.appendChild(title);

  const add = document.createElement("button");
  add.type = "button";
  add.textContent = "+";
  add.title = "Add variable";
  add.addEventListener("click", () => {
    const name = prompt("Variable name", "width");
    if (name === null) return;
    const key = String(name || "").trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return alert("Variable names must start with a letter or underscore.");
    const value = prompt("Variable value", "10");
    if (value === null) return;
    commitParameterValue(key, value);
  });
  header.appendChild(add);
  section.appendChild(header);

  const entries = Object.entries(model.parameters || {});
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.textContent = "No variables defined.";
    Object.assign(empty.style, { color: "#6b7280", font: "11px/1.35 system-ui, sans-serif" });
    section.appendChild(empty);
    return section;
  }

  const rows = document.createElement("div");
  Object.assign(rows.style, { display: "grid", gap: "4px" });
  entries.forEach(([name, value]) => rows.appendChild(renderParameterRow(name, value)));
  section.appendChild(rows);
  return section;
}

function renderScadLayersPanel() {
  if (!activePanelEl) return;
  const model = getModel();
  if (!model) {
    activePanelEl.innerHTML = "";
    return;
  }
  renderFlatLayerPanel({
    panelEl: activePanelEl,
    layers: model.layers || [],
    activeLayerId: getActiveLayerId(),
    titleText: "SCAD Variables & Meshes",
    emptyText: "No SCAD meshes found.",
    getLayerName: (layer) => `${layer.name || layer.id}${layer.locked ? " (locked)" : ""}`,
    getLayerTitle: (layer) => layer.locked ? "Layer is locked" : "Select SCAD layer",
    isLayerVisible: (layer) => layer.visible !== false,
    canExpandLayer: () => true,
    isLayerExpanded: () => true,
    onAddLayer: () => {
      const layer = addLayer(model);
      activeController?.setActiveLayer?.(layer.id);
      commitLayerChange();
    },
    onToggleVisible: (layer) => {
      setLayerVisibility(model, layer.id, layer.visible === false);
      commitLayerChange();
    },
    onSelectLayer: (layer) => {
      activeController?.setActiveLayer?.(layer.id);
      notifyScadLayersChanged();
      renderScadLayersPanel();
    },
    onMoveLayerUp: (layer) => {
      if (reorderLayer(model, layer.id, -1)) commitLayerChange();
    },
    onMoveLayerDown: (layer) => {
      if (reorderLayer(model, layer.id, 1)) commitLayerChange();
    },
    onRenameLayer: (layer) => {
      const next = prompt("Layer name", layer.name || "Layer");
      if (next === null) return;
      layer.name = String(next || layer.name || "Layer");
      commitLayerChange();
    },
    onDeleteLayer: (layer) => {
      if (!confirm(`Delete ${layer.name || "this layer"}? Objects will move to another layer.`)) return;
      if (deleteLayer(model, layer.id)) {
        activeController?.setActiveLayer?.(model.layers[0]?.id || null);
        commitLayerChange();
      }
    },
    deleteDisabled: () => (model.layers || []).length <= 1,
    renderLayerDetails: renderLayerExtras,
  });
  const variablesSection = renderVariablesSection(model);
  activePanelEl.insertBefore(variablesSection, activePanelEl.children[1] || null);
}

function attachScadLayersHost(host) {
  if (!host) return null;
  activeHost = host;
  host.innerHTML = "";
  activePanelEl = createLayerPanelElement();
  activePanelEl.style.maxWidth = "none";
  activePanelEl.style.minWidth = "0";
  activePanelEl.style.height = "100%";
  host.appendChild(activePanelEl);
  renderScadLayersPanel();

  cleanupListeners.forEach((cleanup) => cleanup());
  cleanupListeners = [];
  const rerender = () => renderScadLayersPanel();
  window.addEventListener(SCAD_LAYERS_CHANGED_EVENT, rerender);
  window.addEventListener(SCAD_SELECTION_CHANGED_EVENT, rerender);
  window.addEventListener("nv-scad-model-changed", rerender);
  cleanupListeners.push(() => window.removeEventListener(SCAD_LAYERS_CHANGED_EVENT, rerender));
  cleanupListeners.push(() => window.removeEventListener(SCAD_SELECTION_CHANGED_EVENT, rerender));
  cleanupListeners.push(() => window.removeEventListener("nv-scad-model-changed", rerender));

  return () => {
    cleanupListeners.forEach((cleanup) => cleanup());
    cleanupListeners = [];
    if (activeHost === host) activeHost = null;
    if (activePanelEl?.parentNode === host) activePanelEl.remove();
    activePanelEl = null;
  };
}

export function ensureScadLayersContext(controller) {
  activeController = controller || activeController;
  if (activePanelEl) renderScadLayersPanel();
  window.SCADLayersContext = {
    id: "scad",
    title: "SCAD Variables & Meshes",
    attachHost: attachScadLayersHost,
    refresh: renderScadLayersPanel,
  };
  return window.SCADLayersContext;
}

export function clearScadLayersContext(controller = null) {
  if (controller && controller !== activeController) return;
  cleanupListeners.forEach((cleanup) => cleanup());
  cleanupListeners = [];
  activeController = null;
  if (activePanelEl?.parentNode) activePanelEl.remove();
  activePanelEl = null;
  activeHost = null;
  if (window.SCADLayersContext?.attachHost === attachScadLayersHost) {
    window.SCADLayersContext = null;
  }
}

export function notifyScadLayersChanged() {
  window.dispatchEvent(new CustomEvent(SCAD_LAYERS_CHANGED_EVENT, { detail: { model: getModel(), selectedIds: getSelectedIds(), activeLayerId: getActiveLayerId() } }));
}

export function notifyScadSelectionChanged() {
  window.dispatchEvent(new CustomEvent(SCAD_SELECTION_CHANGED_EVENT, { detail: { model: getModel(), selectedIds: getSelectedIds(), activeLayerId: getActiveLayerId() } }));
}
