// Nodevision/ApplicationSystem/public/ScadEditor/ScadLayerPanelContext.mjs
// Shared Layers panel provider for the graphical SCAD editor.

import { createLayerPanelElement, renderFlatLayerPanel } from "/PanelInstances/Common/Layers/LayerPanelSurface.mjs";
import { addLayer, deleteLayer, moveObjectToLayer, reorderLayer, setLayerLocked, setLayerVisibility } from "./ScadModel.mjs";

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
  row.textContent = obj.name || obj.type || obj.id;
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
    titleText: "SCAD Layers",
    emptyText: "No SCAD layers found.",
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
    title: "SCAD Layers",
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
