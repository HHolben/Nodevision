// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/htmlLayersContextParts/CreateRenderLayerWrapperHandler.mjs
// This module implements create Render Layer Wrapper Handler behavior for the htmlLayersContext feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { styleLayerWrapper, HTML_LAYER_ROW_HEIGHT, createLayerRow, appendMessage, collectLayers, HTML_LAYER_VIRTUALIZE_AFTER, HTML_LAYER_OVERSCAN } from "./ElementFromNode.mjs";
import { renderHtmlLayerScriptDetails } from "../htmlLayerScriptDetails.mjs";
import { styleStandardLayerList } from "./StyleVirtualLayerList.mjs";
import { measureHtmlWork } from "../../../EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlWorkDiagnostics.mjs";

// Create Render Layer Wrapper Handler operations.
export function createRenderLayerWrapperHandler(owner) {
  return (el, index, virtualized) => {
    const active = el === owner.layerState.selectedElement;
    const wrapper = document.createElement("div");
    styleLayerWrapper(wrapper, active);
    if (virtualized) {
      Object.assign(wrapper.style, {
        boxSizing: "border-box",
        left: "0",
        minHeight: String(HTML_LAYER_ROW_HEIGHT - 4) + "px",
        position: "absolute",
        right: "0",
        top: String(index * HTML_LAYER_ROW_HEIGHT) + "px"
      });
    }
    wrapper.appendChild(createLayerRow({
      el,
      index,
      active,
      win: owner.layerState.win,
      attachHandlers: false,
      onSelect: owner.layerState.selectElement
    }));
    if (active && !virtualized) renderHtmlLayerScriptDetails(wrapper, {
      root: owner.root,
      element: el,
      requestRender: owner.layerState.render
    });
    return wrapper;
  };
}

export function createRenderHandler(owner) {
  return () => {
    owner.hostState.list.innerHTML = "";
    owner.hostState.latestLayers = [];
    owner.hostState.virtualList = false;
    styleStandardLayerList(owner.hostState.list);
    if (!owner.root || !owner.root.ownerDocument?.isConnected) {
      appendMessage(owner.hostState.list, "HTML document is not available.", "#b00020");
      return;
    }
    if (owner.layerState.selectedElement && !owner.root.contains(owner.layerState.selectedElement)) owner.layerState.selectedElement = null;
    owner.hostState.latestLayers = owner.hostState.invalidation.read(() => measureHtmlWork(owner.root, "layersCollect", () => collectLayers(owner.root)));
    if (!owner.hostState.latestLayers.length) {
      appendMessage(owner.hostState.list, "No layers found in this document.", "#444");
      return;
    }
    owner.hostState.virtualList = owner.hostState.latestLayers.length > HTML_LAYER_VIRTUALIZE_AFTER;
    if (owner.hostState.virtualList) {
      const selectedIndex = owner.layerState.selectedElement ? owner.hostState.latestLayers.indexOf(owner.layerState.selectedElement) : -1;
      if (selectedIndex >= 0 && owner.host.clientHeight > 0) {
        const rowTop = selectedIndex * HTML_LAYER_ROW_HEIGHT;
        const rowBottom = rowTop + HTML_LAYER_ROW_HEIGHT;
        if (rowTop < owner.host.scrollTop || rowBottom > owner.host.scrollTop + owner.host.clientHeight) {
          owner.host.scrollTop = Math.max(0, rowTop - HTML_LAYER_ROW_HEIGHT * HTML_LAYER_OVERSCAN);
        }
      }
      owner.hostState.renderVirtualWindow();
      return;
    }
    owner.hostState.latestLayers.forEach((el, index) => {
      owner.hostState.list.appendChild(owner.hostState.renderLayerWrapper(el, index, false));
    });
  };
}
