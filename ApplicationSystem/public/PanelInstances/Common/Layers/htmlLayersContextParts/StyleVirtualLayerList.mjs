// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/htmlLayersContextParts/StyleVirtualLayerList.mjs
// This module implements style Virtual Layer List behavior for the htmlLayersContext feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { HTML_LAYER_ROW_HEIGHT, HTML_LAYER_OVERSCAN } from "./ElementFromNode.mjs";

// Style Virtual Layer List operations.
export function styleVirtualLayerList(list, layersLength) {
  Object.assign(list.style, {
    display: "block",
    flexDirection: "",
    gap: "",
    height: String(Math.max(1, layersLength) * HTML_LAYER_ROW_HEIGHT) + "px",
    position: "relative"
  });
}

export function styleStandardLayerList(list) {
  Object.assign(list.style, {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    height: "",
    position: ""
  });
}

export function htmlLayerVisibleRange(host, layerCount) {
  const rawViewportHeight = host?.clientHeight || HTML_LAYER_ROW_HEIGHT * 16;
  const viewportHeight = Math.max(HTML_LAYER_ROW_HEIGHT, Math.min(rawViewportHeight, HTML_LAYER_ROW_HEIGHT * 36));
  const first = Math.max(0, Math.floor((host?.scrollTop || 0) / HTML_LAYER_ROW_HEIGHT) - HTML_LAYER_OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / HTML_LAYER_ROW_HEIGHT) + HTML_LAYER_OVERSCAN * 2;
  const end = Math.min(layerCount, first + visibleCount);
  return {
    start: first,
    end
  };
}

export function nodeListContainsElement(nodes) {
  return Array.from(nodes || []).some(node => node?.nodeType === Node.ELEMENT_NODE);
}

export function htmlLayerMutationChangesStructure(record) {
  if (!record) return false;
  if (record.type === "attributes") return true;
  if (record.type !== "childList") return false;
  return nodeListContainsElement(record.addedNodes) || nodeListContainsElement(record.removedNodes);
}
