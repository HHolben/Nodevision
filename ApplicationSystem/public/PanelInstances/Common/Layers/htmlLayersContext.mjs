// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/htmlLayersContext.mjs
// This module provides a generic layer context for HTML documents so the shared Layers panel can name, select, toggle, and edit element-associated scripts from one existing provider.

import { isInteractiveFormElement } from "./htmlFormEventTools.mjs";
import { htmlLayerDisplayName, isHtmlLayerElement } from "./htmlLayerNames.mjs";
import { renderHtmlLayerScriptDetails } from "./htmlLayerScriptDetails.mjs";

const HTML_LAYER_VIRTUALIZE_AFTER = 400;
const HTML_LAYER_ROW_HEIGHT = 34;
const HTML_LAYER_OVERSCAN = 10;

function elementFromNode(node) {
  return node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
}

function isVisible(el, win) {
  if (!el || !win) return false;
  if (el.hidden) return false;
  const style = win.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function setVisible(el, visible) {
  if (!el) return;
  if (visible) {
    const prev = el.dataset.nvLayerPrevDisplay || "";
    el.style.display = prev;
    delete el.dataset.nvLayerPrevDisplay;
    el.hidden = false;
    el.style.visibility = "";
    return;
  }
  if (!el.dataset.nvLayerPrevDisplay) {
    el.dataset.nvLayerPrevDisplay = el.style.display || "";
  }
  el.style.display = "none";
  el.hidden = true;
}

function collectLayers(root) {
  if (!root) return [];
  const layers = [];
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if (!(node instanceof Element)) return NodeFilter.FILTER_REJECT;
        if (node === root) return NodeFilter.FILTER_SKIP;
        return isHtmlLayerElement(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    }
  );

  let current = walker.nextNode();
  while (current) {
    layers.push(current);
    current = walker.nextNode();
  }
  return layers;
}

function closestLayerElement(root, target) {
  let current = elementFromNode(target);
  while (current && current !== root) {
    if (root.contains(current) && isHtmlLayerElement(current)) return current;
    current = current.parentElement;
  }
  return null;
}

function formActionTarget(root, target, includeForm = false) {
  const selector = "button,input,select,textarea,label" + (includeForm ? ",form" : "");
  const el = elementFromNode(target)?.closest?.(selector);
  if (!el || !root?.contains?.(el)) return null;
  if (el.tagName === "LABEL") return el;
  return isInteractiveFormElement(el) ? el : null;
}

function appendMessage(list, text, color) {
  const msg = document.createElement("div");
  msg.textContent = text;
  msg.style.color = color;
  msg.style.padding = "6px 0";
  list.appendChild(msg);
}

function styleLayerWrapper(wrapper, active) {
  Object.assign(wrapper.style, {
    border: active ? "1px solid #5aa9ff" : "1px solid #d5d5d5",
    background: active ? "#eef6ff" : "#fff",
    borderRadius: "6px",
  });
}

function createLayerRow({ el, index, active, win, attachHandlers = true, onSelect }) {
  const row = document.createElement("div");
  Object.assign(row.style, {
    display: "grid",
    gridTemplateColumns: "20px 1fr",
    alignItems: "center",
    gap: "8px",
    padding: "4px 6px",
    fontSize: "12px",
  });

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = isVisible(el, win);
  checkbox.title = checkbox.checked ? "Hide layer" : "Show layer";
  checkbox.dataset.layerIndex = String(index);
  if (attachHandlers) {
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => setVisible(el, checkbox.checked));
  }

  const name = document.createElement("button");
  name.type = "button";
  name.textContent = htmlLayerDisplayName(el, index);
  name.title = "Select " + name.textContent;
  name.dataset.layerIndex = String(index);
  Object.assign(name.style, {
    border: "none",
    background: "transparent",
    color: active ? "#0f4f88" : "#222",
    cursor: "pointer",
    overflow: "hidden",
    padding: "2px 0",
    textAlign: "left",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });
  if (attachHandlers) {
    name.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelect(el);
    });
  }

  row.append(checkbox, name);
  return row;
}

function styleVirtualLayerList(list, layersLength) {
  Object.assign(list.style, {
    display: "block",
    flexDirection: "",
    gap: "",
    height: String(Math.max(1, layersLength) * HTML_LAYER_ROW_HEIGHT) + "px",
    position: "relative",
  });
}

function styleStandardLayerList(list) {
  Object.assign(list.style, {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    height: "",
    position: "",
  });
}

export function htmlLayerVisibleRange(host, layerCount) {
  const rawViewportHeight = host?.clientHeight || HTML_LAYER_ROW_HEIGHT * 16;
  const viewportHeight = Math.max(HTML_LAYER_ROW_HEIGHT, Math.min(rawViewportHeight, HTML_LAYER_ROW_HEIGHT * 36));
  const first = Math.max(0, Math.floor((host?.scrollTop || 0) / HTML_LAYER_ROW_HEIGHT) - HTML_LAYER_OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / HTML_LAYER_ROW_HEIGHT) + HTML_LAYER_OVERSCAN * 2;
  const end = Math.min(layerCount, first + visibleCount);
  return { start: first, end };
}

function nodeListContainsElement(nodes) {
  return Array.from(nodes || []).some((node) => node?.nodeType === Node.ELEMENT_NODE);
}

export function htmlLayerMutationChangesStructure(record) {
  if (!record) return false;
  if (record.type === "attributes") return true;
  if (record.type !== "childList") return false;
  return nodeListContainsElement(record.addedNodes) || nodeListContainsElement(record.removedNodes);
}

export function createHtmlLayersContext(root, { title = "HTML Layers" } = {}) {
  const win = root?.ownerDocument?.defaultView || window;
  let selectedElement = null;
  let render = () => {};

  const selectElement = (el) => {
    selectedElement = el && root?.contains?.(el) ? el : null;
    selectedElement?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    render();
  };

  return {
    title,
    attachHost(host) {
      if (!host) return null;

      host.innerHTML = "";
      const list = document.createElement("div");
      styleStandardLayerList(list);
      host.appendChild(list);

      let latestLayers = [];
      let virtualList = false;
      let pendingVirtualRenderFrame = 0;

      const renderLayerWrapper = (el, index, virtualized) => {
        const active = el === selectedElement;
        const wrapper = document.createElement("div");
        styleLayerWrapper(wrapper, active);
        if (virtualized) {
          Object.assign(wrapper.style, {
            boxSizing: "border-box",
            left: "0",
            minHeight: String(HTML_LAYER_ROW_HEIGHT - 4) + "px",
            position: "absolute",
            right: "0",
            top: String(index * HTML_LAYER_ROW_HEIGHT) + "px",
          });
        }
        wrapper.appendChild(createLayerRow({ el, index, active, win, attachHandlers: false, onSelect: selectElement }));
        if (active && !virtualized) renderHtmlLayerScriptDetails(wrapper, { root, element: el, requestRender: render });
        return wrapper;
      };

      const renderVirtualWindow = () => {
        list.innerHTML = "";
        styleVirtualLayerList(list, latestLayers.length);
        const { start, end } = htmlLayerVisibleRange(host, latestLayers.length);
        for (let index = start; index < end; index += 1) {
          list.appendChild(renderLayerWrapper(latestLayers[index], index, true));
        }
      };

      render = () => {
        list.innerHTML = "";
        latestLayers = [];
        virtualList = false;
        styleStandardLayerList(list);
        if (!root || !root.ownerDocument?.isConnected) {
          appendMessage(list, "HTML document is not available.", "#b00020");
          return;
        }
        if (selectedElement && !root.contains(selectedElement)) selectedElement = null;

        latestLayers = collectLayers(root);
        if (!latestLayers.length) {
          appendMessage(list, "No layers found in this document.", "#444");
          return;
        }

        virtualList = latestLayers.length > HTML_LAYER_VIRTUALIZE_AFTER;
        if (virtualList) {
          const selectedIndex = selectedElement ? latestLayers.indexOf(selectedElement) : -1;
          if (selectedIndex >= 0 && host.clientHeight > 0) {
            const rowTop = selectedIndex * HTML_LAYER_ROW_HEIGHT;
            const rowBottom = rowTop + HTML_LAYER_ROW_HEIGHT;
            if (rowTop < host.scrollTop || rowBottom > host.scrollTop + host.clientHeight) {
              host.scrollTop = Math.max(0, rowTop - HTML_LAYER_ROW_HEIGHT * HTML_LAYER_OVERSCAN);
            }
          }
          renderVirtualWindow();
          return;
        }

        latestLayers.forEach((el, index) => {
          list.appendChild(renderLayerWrapper(el, index, false));
        });
      };

      const onRootSelect = (event) => {
        const next = closestLayerElement(root, event.target);
        if (next) selectElement(next);
      };
      const onExternalSelect = (event) => {
        const next = event?.detail?.element;
        if (next && root.contains(next)) selectElement(next);
      };
      const onFormInteraction = (event) => {
        const next = formActionTarget(root, event.target, event.type === "submit");
        if (!next) return;
        selectElement(next);
        event.preventDefault();
        event.stopPropagation();
      };

      const layerIndexFromControl = (control) => {
        if (!control || !list.contains(control)) return -1;
        const index = Number(control.dataset.layerIndex);
        return Number.isInteger(index) && index >= 0 && index < latestLayers.length ? index : -1;
      };
      const onListClick = (event) => {
        const checkbox = event.target?.closest?.("input[type=\"checkbox\"][data-layer-index]");
        if (checkbox && list.contains(checkbox)) {
          event.stopPropagation();
          return;
        }
        const button = event.target?.closest?.("button[data-layer-index]");
        const index = layerIndexFromControl(button);
        if (index < 0) return;
        event.stopPropagation();
        selectElement(latestLayers[index]);
      };
      const onListChange = (event) => {
        const checkbox = event.target?.closest?.("input[type=\"checkbox\"][data-layer-index]");
        const index = layerIndexFromControl(checkbox);
        if (index < 0) return;
        setVisible(latestLayers[index], checkbox.checked);
      };
      const scheduleVirtualWindowRender = () => {
        if (!virtualList || pendingVirtualRenderFrame) return;
        pendingVirtualRenderFrame = requestAnimationFrame(() => {
          pendingVirtualRenderFrame = 0;
          if (virtualList) renderVirtualWindow();
        });
      };
      const onHostScroll = () => scheduleVirtualWindowRender();

      list.addEventListener("click", onListClick);
      list.addEventListener("change", onListChange);
      host.addEventListener("scroll", onHostScroll, { passive: true });

      render();
      ["mousedown", "click", "submit"].forEach((type) => root.addEventListener(type, onFormInteraction, true));
      root.addEventListener("click", onRootSelect, true);
      root.addEventListener("focusin", onRootSelect, true);
      win.addEventListener("nodevision-html-layer-selected", onExternalSelect);

      let observer = null;
      let pendingRenderFrame = 0;
      const scheduleRender = () => {
        if (pendingRenderFrame) return;
        pendingRenderFrame = requestAnimationFrame(() => {
          pendingRenderFrame = 0;
          render();
        });
      };
      try {
        observer = new MutationObserver((records) => {
          const needsRender = Array.from(records || []).some(htmlLayerMutationChangesStructure);
          if (needsRender) scheduleRender();
        });
        observer.observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "id", "name", "type", "for", "hidden", "placeholder", "style", "title", "aria-label"],
        });
      } catch (_) {
        // Some embedded documents may not permit observation.
      }

      return () => {
        observer?.disconnect?.();
        if (pendingRenderFrame) {
          cancelAnimationFrame(pendingRenderFrame);
          pendingRenderFrame = 0;
        }
        if (pendingVirtualRenderFrame) {
          cancelAnimationFrame(pendingVirtualRenderFrame);
          pendingVirtualRenderFrame = 0;
        }
        list.removeEventListener("click", onListClick);
        list.removeEventListener("change", onListChange);
        host.removeEventListener("scroll", onHostScroll);
        ["mousedown", "click", "submit"].forEach((type) => root.removeEventListener(type, onFormInteraction, true));
        root.removeEventListener("click", onRootSelect, true);
        root.removeEventListener("focusin", onRootSelect, true);
        win.removeEventListener("nodevision-html-layer-selected", onExternalSelect);
      };
    },
  };
}
