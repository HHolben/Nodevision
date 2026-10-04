// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/htmlLayersContextParts/ElementFromNode.mjs
// This module implements element From Node behavior for the htmlLayersContext feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { isHtmlLayerElement, htmlLayerDisplayName } from "../htmlLayerNames.mjs";
import { isInteractiveFormElement } from "../htmlFormEventTools.mjs";
import { measureHtmlWork } from "../../../EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlWorkDiagnostics.mjs";

// Element From Node operations.
export const HTML_LAYER_VIRTUALIZE_AFTER = 400;

export const HTML_LAYER_ROW_HEIGHT = 34;

export const HTML_LAYER_OVERSCAN = 10;

export function elementFromNode(node) {
  return node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
}

export function isVisible(el, win) {
  if (!el || !win) return false;
  if (el.hidden) return false;
  const style = win.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

export function setVisible(el, visible) {
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

export function collectLayers(root) {
  if (!root) return [];
  const layers = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: node => {
      if (!(node instanceof Element)) return NodeFilter.FILTER_REJECT;
      if (node === root) return NodeFilter.FILTER_SKIP;
      return isHtmlLayerElement(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  let current = walker.nextNode();
  while (current) {
    layers.push(current);
    current = walker.nextNode();
  }
  return layers;
}

export function closestLayerElement(root, target) {
  let current = elementFromNode(target);
  while (current && current !== root) {
    if (root.contains(current) && isHtmlLayerElement(current)) return current;
    current = current.parentElement;
  }
  return null;
}

export function formActionTarget(root, target, includeForm = false) {
  const selector = "button,input,select,textarea,label" + (includeForm ? ",form" : "");
  const el = elementFromNode(target)?.closest?.(selector);
  if (!el || !root?.contains?.(el)) return null;
  if (el.tagName === "LABEL") return el;
  return isInteractiveFormElement(el) ? el : null;
}

export function appendMessage(list, text, color) {
  const msg = document.createElement("div");
  msg.textContent = text;
  msg.style.color = color;
  msg.style.padding = "6px 0";
  list.appendChild(msg);
}

export function styleLayerWrapper(wrapper, active) {
  Object.assign(wrapper.style, {
    border: active ? "1px solid #5aa9ff" : "1px solid #d5d5d5",
    background: active ? "#eef6ff" : "#fff",
    borderRadius: "6px"
  });
}

export function createLayerRow({
  el,
  index,
  active,
  win,
  attachHandlers = true,
  onSelect
}) {
  const row = document.createElement("div");
  Object.assign(row.style, {
    display: "grid",
    gridTemplateColumns: "20px 1fr",
    alignItems: "center",
    gap: "8px",
    padding: "4px 6px",
    fontSize: "12px"
  });
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = measureHtmlWork(el.closest("#wysiwyg"), "layersVisibility", () => isVisible(el, win));
  checkbox.title = checkbox.checked ? "Hide layer" : "Show layer";
  checkbox.dataset.layerIndex = String(index);
  if (attachHandlers) {
    checkbox.addEventListener("click", event => event.stopPropagation());
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
    whiteSpace: "nowrap"
  });
  if (attachHandlers) {
    name.addEventListener("click", event => {
      event.stopPropagation();
      onSelect(el);
    });
  }
  row.append(checkbox, name);
  return row;
}
