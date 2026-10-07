// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/htmlLayersContextParts/CreateHtmlLayersContext.mjs
// This module implements create Html Layers Context behavior for the htmlLayersContext feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { styleStandardLayerList, styleVirtualLayerList, htmlLayerVisibleRange } from "./StyleVirtualLayerList.mjs";
import { createHtmlLayerInvalidation } from "../HtmlLayerInvalidation.mjs";
import { closestLayerElement, formActionTarget, setVisible } from "./ElementFromNode.mjs";
import { createRenderLayerWrapperHandler, createRenderHandler } from "./CreateRenderLayerWrapperHandler.mjs";
import { measureHtmlWork } from "../../../EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlWorkDiagnostics.mjs";

// Create Html Layers Context operations.
export function createHtmlLayersContext(root, {
  title = "HTML Layers", readOnly = false, onReveal = null
} = {}) {
  const layerState = { readOnly };
  layerState.win = root?.ownerDocument?.defaultView || window;
  layerState.selectedElement = null;
  layerState.render = () => {};
  layerState.selectElement = el => {
    const next = el && root?.contains?.(el) ? el : null;
    if (next === layerState.selectedElement && !(readOnly && onReveal)) return;
    layerState.selectedElement = next;
    if (!readOnly) root.__nvHtmlSelection?.selectElement(layerState.selectedElement);
    if (readOnly && next) onReveal?.(next);
    layerState.selectedElement?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest"
    });
    layerState.render();
  };
  return {
    title,
    attachHost(host) {
      const hostState = {};
      if (!host) return null;
      host.innerHTML = "";
      hostState.list = document.createElement("div");
      styleStandardLayerList(hostState.list);
      host.appendChild(hostState.list);
      hostState.latestLayers = [];
      hostState.invalidation = createHtmlLayerInvalidation();
      hostState.virtualList = false;
      hostState.pendingVirtualRenderFrame = 0;
      hostState.unsubscribeSelection = root.__nvHtmlSelection?.subscribe(() => {
        layerState.selectElement(closestLayerElement(root, root.__nvHtmlSelection.getElement()));
      });
      hostState.renderLayerWrapper = createRenderLayerWrapperHandler({
        get layerState() {
          return layerState;
        },
        get root() {
          return root;
        }
      });
      hostState.renderVirtualWindow = () => measureHtmlWork(root, "layersRows", () => {
        hostState.list.innerHTML = "";
        styleVirtualLayerList(hostState.list, hostState.latestLayers.length);
        const {
          start,
          end
        } = htmlLayerVisibleRange(host, hostState.latestLayers.length);
        for (let index = start; index < end; index += 1) {
          hostState.list.appendChild(hostState.renderLayerWrapper(hostState.latestLayers[index], index, true));
        }
      });
      layerState.render = createRenderHandler({
        get hostState() {
          return hostState;
        },
        get root() {
          return root;
        },
        get layerState() {
          return layerState;
        },
        get host() {
          return host;
        }
      });
      hostState.onRootSelect = event => {
        const next = closestLayerElement(root, event.target);
        if (next) layerState.selectElement(next);
      };
      hostState.onExternalSelect = event => {
        const next = event?.detail?.element;
        if (next && root.contains(next)) layerState.selectElement(next);
      };
      hostState.onFormInteraction = event => {
        const next = formActionTarget(root, event.target, event.type === "submit");
        if (!next) return;
        layerState.selectElement(next);
        event.preventDefault();
        event.stopPropagation();
      };
      hostState.layerIndexFromControl = control => {
        if (!control || !hostState.list.contains(control)) return -1;
        const index = Number(control.dataset.layerIndex);
        return Number.isInteger(index) && index >= 0 && index < hostState.latestLayers.length ? index : -1;
      };
      hostState.onListClick = event => {
        const checkbox = event.target?.closest?.("input[type=\"checkbox\"][data-layer-index]");
        if (checkbox && hostState.list.contains(checkbox)) {
          event.stopPropagation();
          return;
        }
        const button = event.target?.closest?.("button[data-layer-index]");
        const index = hostState.layerIndexFromControl(button);
        if (index < 0) return;
        event.stopPropagation();
        layerState.selectElement(hostState.latestLayers[index]);
      };
      hostState.onListChange = event => {
        const checkbox = event.target?.closest?.("input[type=\"checkbox\"][data-layer-index]");
        const index = hostState.layerIndexFromControl(checkbox);
        if (readOnly || index < 0) return;
        setVisible(hostState.latestLayers[index], checkbox.checked);
      };
      hostState.scheduleVirtualWindowRender = () => {
        if (!hostState.virtualList || hostState.pendingVirtualRenderFrame) return;
        hostState.pendingVirtualRenderFrame = requestAnimationFrame(() => {
          hostState.pendingVirtualRenderFrame = 0;
          if (hostState.virtualList) hostState.renderVirtualWindow();
        });
      };
      hostState.onHostScroll = () => hostState.scheduleVirtualWindowRender();
      hostState.list.addEventListener("click", hostState.onListClick);
      hostState.list.addEventListener("change", hostState.onListChange);
      host.addEventListener("scroll", hostState.onHostScroll, {
        passive: true
      });
      layerState.render();
      if (!readOnly) ["mousedown", "click", "submit"].forEach(type => root.addEventListener(type, hostState.onFormInteraction, true));
      root.addEventListener("click", hostState.onRootSelect, true);
      root.addEventListener("focusin", hostState.onRootSelect, true);
      layerState.win.addEventListener("nodevision-html-layer-selected", hostState.onExternalSelect);
      hostState.observer = null;
      hostState.pendingRenderFrame = 0;
      hostState.scheduleRender = () => {
        if (hostState.pendingRenderFrame) return;
        hostState.pendingRenderFrame = requestAnimationFrame(() => {
          hostState.pendingRenderFrame = 0;
          layerState.render();
        });
      };
      try {
        hostState.observer = new MutationObserver(records => {
          const needsRender = hostState.invalidation.mutations(records || []);
          if (needsRender) hostState.scheduleRender();
        });
        hostState.observer.observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "id", "name", "type", "for", "hidden", "placeholder", "style", "title", "aria-label", "data-layer-name", "data-nv-layer-ignore"]
        });
      } catch (_) {
        // Some embedded documents may not permit observation.
      }
      return () => {
        hostState.unsubscribeSelection?.();
        hostState.invalidation.clear();
        hostState.observer?.disconnect?.();
        if (hostState.pendingRenderFrame) {
          cancelAnimationFrame(hostState.pendingRenderFrame);
          hostState.pendingRenderFrame = 0;
        }
        if (hostState.pendingVirtualRenderFrame) {
          cancelAnimationFrame(hostState.pendingVirtualRenderFrame);
          hostState.pendingVirtualRenderFrame = 0;
        }
        hostState.list.removeEventListener("click", hostState.onListClick);
        hostState.list.removeEventListener("change", hostState.onListChange);
        host.removeEventListener("scroll", hostState.onHostScroll);
        ["mousedown", "click", "submit"].forEach(type => root.removeEventListener(type, hostState.onFormInteraction, true));
        root.removeEventListener("click", hostState.onRootSelect, true);
        root.removeEventListener("focusin", hostState.onRootSelect, true);
        try {
          layerState.win.removeEventListener("nodevision-html-layer-selected", hostState.onExternalSelect);
        } catch (error) {
          // A navigated iframe's WindowProxy may now belong to another origin.
          if (error.name !== "SecurityError") throw error;
        }
      };
    }
  };
}
