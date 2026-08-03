// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/LayerPanelSurface.mjs
// This module defines the shared Nodevision layer panel surface. Future layer providers reuse these helpers so their layer controls match SVG graphical editing.

import {
  appendLayerPanelEmptyMessage,
  createLayerListElement,
  createLayerPanelHeader,
  createLayerRow,
  createLayerWrapper,
} from "./LayerPanelElements.mjs";

export {
  appendLayerPanelEmptyMessage,
  createLayerListElement,
  createLayerPanelElement,
  createLayerPanelHeader,
  createLayerRow,
  createLayerWrapper,
} from "./LayerPanelElements.mjs";

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
