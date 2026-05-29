// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/LayerPanelSurface.mjs
// This module defines the shared Nodevision layer panel surface. Future layer providers reuse these helpers so their layer controls match SVG graphical editing.

export function createLayerPanelElement() {
  const el = document.createElement("div");
  el.id = "svg-layer-panel";
  el.tabIndex = 0;
  Object.assign(el.style, {
    border: "1px solid #d0d0d0",
    background: "#fafafa",
    padding: "6px",
    minWidth: "220px",
    maxWidth: "280px",
    overflow: "auto",
    outline: "none",
  });
  return el;
}

export function createLayerPanelHeader({ titleText = "Layers", onAddLayer = null, addDisabled = false, addTitle = "Add Layer" } = {}) {
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.gap = "6px";
  header.style.alignItems = "center";
  header.style.marginBottom = "6px";

  const title = document.createElement("div");
  title.textContent = titleText;
  title.style.fontWeight = "700";
  title.style.flex = "1";
  header.appendChild(title);

  const addBtn = document.createElement("button");
  addBtn.textContent = "+";
  addBtn.title = addTitle;
  addBtn.disabled = addDisabled || typeof onAddLayer !== "function";
  addBtn.onclick = () => onAddLayer?.();
  header.appendChild(addBtn);

  return { header, title, addBtn };
}

export function createLayerListElement() {
  const list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "4px";
  return list;
}

export function createLayerWrapper({ active = false, selected = false, draggable = false } = {}) {
  const wrapper = document.createElement("div");
  wrapper.style.border = active ? "1px solid #5aa9ff" : "1px solid #d5d5d5";
  wrapper.style.background = active ? "#eef6ff" : "#fff";
  wrapper.style.borderRadius = "6px";
  wrapper.draggable = Boolean(draggable);
  if (selected) {
    wrapper.style.outline = "2px solid rgba(255, 183, 77, 0.95)";
    wrapper.style.outlineOffset = "-2px";
  }
  return wrapper;
}

export function createLayerRow({
  expanded = false,
  expandDisabled = false,
  visible = true,
  name = "Layer",
  nameTitle = "Select layer",
  onToggleExpanded = null,
  onToggleVisible = null,
  onSelect = null,
  onMoveUp = null,
  onMoveDown = null,
  onRename = null,
  onDelete = null,
  deleteDisabled = false,
} = {}) {
  const row = document.createElement("div");
  row.style.display = "grid";
  row.style.gridTemplateColumns = "20px 52px 1fr auto auto auto auto";
  row.style.alignItems = "center";
  row.style.gap = "4px";
  row.style.padding = "3px 4px";

  const expandBtn = document.createElement("button");
  expandBtn.type = "button";
  expandBtn.textContent = expanded ? "▾" : "▸";
  expandBtn.title = expanded ? "Collapse layer contents" : "Expand layer contents";
  expandBtn.disabled = expandDisabled || typeof onToggleExpanded !== "function";
  expandBtn.setAttribute("aria-expanded", String(expanded));
  expandBtn.onclick = () => onToggleExpanded?.();
  row.appendChild(expandBtn);

  const visBtn = document.createElement("button");
  visBtn.type = "button";
  visBtn.textContent = visible ? "Unsee" : "See";
  visBtn.title = visible ? "Hide layer" : "Show layer";
  visBtn.setAttribute("aria-pressed", String(visible));
  visBtn.onclick = () => onToggleVisible?.();
  row.appendChild(visBtn);

  const nameBtn = document.createElement("button");
  nameBtn.textContent = name;
  nameBtn.style.textAlign = "left";
  nameBtn.style.border = "none";
  nameBtn.style.background = "transparent";
  nameBtn.style.padding = "2px 3px";
  nameBtn.style.overflow = "hidden";
  nameBtn.style.textOverflow = "ellipsis";
  nameBtn.style.whiteSpace = "nowrap";
  nameBtn.title = nameTitle;
  nameBtn.onclick = () => onSelect?.();
  row.appendChild(nameBtn);

  const upBtn = document.createElement("button");
  upBtn.textContent = "↑";
  upBtn.title = "Move Up";
  upBtn.disabled = typeof onMoveUp !== "function";
  upBtn.onclick = () => onMoveUp?.();
  row.appendChild(upBtn);

  const downBtn = document.createElement("button");
  downBtn.textContent = "↓";
  downBtn.title = "Move Down";
  downBtn.disabled = typeof onMoveDown !== "function";
  downBtn.onclick = () => onMoveDown?.();
  row.appendChild(downBtn);

  const renameBtn = document.createElement("button");
  renameBtn.textContent = "✎";
  renameBtn.title = "Rename";
  renameBtn.disabled = typeof onRename !== "function";
  renameBtn.onclick = () => onRename?.();
  row.appendChild(renameBtn);

  const delBtn = document.createElement("button");
  delBtn.textContent = "✕";
  delBtn.title = "Delete Layer";
  delBtn.disabled = deleteDisabled || typeof onDelete !== "function";
  delBtn.onclick = () => onDelete?.();
  row.appendChild(delBtn);

  return { row, expandBtn, visBtn, nameBtn, upBtn, downBtn, renameBtn, delBtn };
}

export function appendLayerPanelEmptyMessage(list, message) {
  const empty = document.createElement("div");
  empty.textContent = message;
  Object.assign(empty.style, {
    fontStyle: "italic",
    color: "#666",
    padding: "2px 6px",
  });
  list.appendChild(empty);
  return empty;
}

export function renderFlatLayerPanel({
  panelEl,
  layers = [],
  activeLayerId = null,
  selectedLayerId = null,
  emptyText = "No layers found.",
  titleText = "Layers",
  onAddLayer = null,
  addDisabled = false,
  addTitle = "Add Layer",
  getLayerId = (layer) => layer?.id,
  getLayerName = (layer) => layer?.name || layer?.id || "Layer",
  getLayerTitle = () => "Select layer",
  isLayerVisible = (layer) => layer?.visible !== false,
  isLayerExpanded = () => false,
  canExpandLayer = () => false,
  onToggleExpanded = null,
  onToggleVisible = null,
  onSelectLayer = null,
  onMoveLayerUp = null,
  onMoveLayerDown = null,
  onRenameLayer = null,
  onDeleteLayer = null,
  renderLayerDetails = null,
  deleteDisabled = false,
  reverse = true,
} = {}) {
  if (!panelEl) return null;
  panelEl.innerHTML = "";
  const { header } = createLayerPanelHeader({ titleText, onAddLayer, addDisabled, addTitle });
  panelEl.appendChild(header);

  const list = createLayerListElement();
  panelEl.appendChild(list);

  if (!layers.length) {
    appendLayerPanelEmptyMessage(list, emptyText);
    return { list };
  }

  const orderedLayers = reverse ? [...layers].reverse() : [...layers];
  orderedLayers.forEach((layer, renderIndex) => {
    const sourceIndex = reverse ? layers.length - 1 - renderIndex : renderIndex;
    const id = getLayerId(layer, sourceIndex);
    const active = id === activeLayerId;
    const selected = id === selectedLayerId;
    const expanded = Boolean(isLayerExpanded(layer, sourceIndex));
    const wrapper = createLayerWrapper({ active, selected });
    const { row } = createLayerRow({
      expanded,
      expandDisabled: !canExpandLayer(layer, sourceIndex),
      visible: Boolean(isLayerVisible(layer, sourceIndex)),
      name: getLayerName(layer, sourceIndex),
      nameTitle: getLayerTitle(layer, sourceIndex),
      onToggleExpanded: () => onToggleExpanded?.(layer, sourceIndex),
      onToggleVisible: () => onToggleVisible?.(layer, sourceIndex),
      onSelect: () => onSelectLayer?.(layer, sourceIndex),
      onMoveUp: () => onMoveLayerUp?.(layer, sourceIndex),
      onMoveDown: () => onMoveLayerDown?.(layer, sourceIndex),
      onRename: () => onRenameLayer?.(layer, sourceIndex),
      onDelete: () => onDeleteLayer?.(layer, sourceIndex),
      deleteDisabled: typeof deleteDisabled === "function" ? deleteDisabled(layer, sourceIndex) : deleteDisabled,
    });
    wrapper.appendChild(row);
    if (typeof renderLayerDetails === "function") {
      renderLayerDetails(wrapper, layer, sourceIndex);
    }
    list.appendChild(wrapper);
  });

  return { list };
}
