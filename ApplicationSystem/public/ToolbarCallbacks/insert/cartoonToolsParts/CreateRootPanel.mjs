// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/cartoonToolsParts/CreateRootPanel.mjs
// This module implements create Root Panel behavior for the cartoonTools feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { uid, pxNumber, rootStyle, layoutStyle, createFrame, DEFAULT_WIDTH, DEFAULT_HEIGHT, CARTOON_STYLE_ID } from "./Uid.mjs";
import { getDefaultCartoonGap } from "./ApplyGapToPanel.mjs";
import { presentHtmlAttribute } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";
import { markHtmlEditorChrome } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSourceProvenance.mjs";
import { createAddEventListenerPointerdownHandler } from "./DeleteSelectedCartoonFrame.mjs";

// Create Root Panel operations.
export function createRootPanel({
  id = uid(),
  gap = getDefaultCartoonGap()
} = {}) {
  const root = document.createElement("div");
  root.id = id;
  root.className = "nv-cartoon-panel";
  root.setAttribute("data-nv-cartoon-panel", "");
  presentHtmlAttribute(root, "data-nv-resizable", "");
  presentHtmlAttribute(root, "contenteditable", "false");
  root.dataset.panelGap = String(pxNumber(gap));
  root.setAttribute("style", rootStyle({
    gap
  }));
  const layout = document.createElement("div");
  layout.className = "nv-cartoon-layout";
  layout.setAttribute("data-nv-cartoon-layout", "");
  layout.dataset.orientation = "vertical";
  layout.setAttribute("style", layoutStyle("row"));
  layout.appendChild(createFrame());
  root.appendChild(layout);
  return root;
}

export function serializeNode(node) {
  const wrapper = document.createElement("div");
  wrapper.appendChild(node);
  return wrapper.innerHTML;
}

export function syncLayoutStyle(el) {
  if (!el?.matches?.("[data-nv-cartoon-layout], [data-nv-cartoon-split]")) return;
  const direction = el.dataset.orientation === "horizontal" ? "column" : "row";
  el.setAttribute("style", layoutStyle(direction));
}

export function hydrateFrame(frame) {
  if (!frame) return;
  frame.classList.add("nv-cartoon-frame");
  frame.setAttribute("data-nv-cartoon-frame", "");
  presentHtmlAttribute(frame, "contenteditable", "true");
  frame.style.flex = frame.style.flex || "1 1 0";
  frame.style.minWidth = frame.style.minWidth || "48px";
  frame.style.minHeight = frame.style.minHeight || "48px";
  frame.style.background = frame.style.background || "#fff";
  frame.style.border = frame.style.border || "2px solid #111";
  frame.style.boxSizing = "border-box";
  frame.style.overflow = frame.style.overflow || "auto";
  frame.style.padding = frame.style.padding || "8px";
  frame.style.outline = "none";
}

export function hydrateCartoonPanel(panel) {
  if (!panel) return;
  panel.classList.add("nv-cartoon-panel");
  panel.setAttribute("data-nv-cartoon-panel", "");
  presentHtmlAttribute(panel, "data-nv-resizable", "");
  presentHtmlAttribute(panel, "contenteditable", "false");
  const gap = pxNumber(panel.dataset.panelGap || panel.style.getPropertyValue("--nv-cartoon-panel-gap"), getDefaultCartoonGap());
  panel.dataset.panelGap = String(gap);
  panel.style.setProperty("--nv-cartoon-panel-gap", `${gap}px`);
  panel.style.position = panel.style.position || "relative";
  panel.style.width = panel.style.width || DEFAULT_WIDTH;
  panel.style.height = panel.style.height || DEFAULT_HEIGHT;
  panel.style.minWidth = panel.style.minWidth || "240px";
  panel.style.minHeight = panel.style.minHeight || "180px";
  panel.style.background = panel.style.background || "#fff";
  panel.style.border = panel.style.border || "2px solid #111";
  panel.style.boxSizing = "border-box";
  panel.style.overflow = panel.style.overflow || "hidden";
  panel.style.padding = panel.style.padding || "12px";
  const layout = panel.querySelector(":scope > [data-nv-cartoon-layout]") || panel.querySelector("[data-nv-cartoon-layout]");
  if (layout) syncLayoutStyle(layout);
  panel.querySelectorAll("[data-nv-cartoon-split]").forEach(syncLayoutStyle);
  panel.querySelectorAll("[data-nv-cartoon-frame]").forEach(hydrateFrame);
  if (!panel.querySelector("[data-nv-cartoon-frame]")) {
    const targetLayout = layout || panel;
    targetLayout.appendChild(createFrame());
  }
  installResizeHandle(panel);
}

export function ensureStyles() {
  if (document.getElementById(CARTOON_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = CARTOON_STYLE_ID;
  style.textContent = `
    [data-nv-cartoon-panel] {
      user-select: none;
    }
    [data-nv-cartoon-frame] {
      user-select: text;
    }
    [data-nv-cartoon-frame][data-nv-cartoon-selected="true"] {
      box-shadow: inset 0 0 0 3px #2563eb;
    }
    [data-nv-cartoon-resize-handle] {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 18px;
      height: 18px;
      z-index: 5;
      cursor: nwse-resize;
      background:
        linear-gradient(135deg, transparent 0 45%, rgba(17,17,17,.64) 46% 54%, transparent 55%),
        linear-gradient(135deg, transparent 0 66%, rgba(17,17,17,.64) 67% 75%, transparent 76%);
    }
  `;
  document.head.appendChild(style);
}

export function installResizeHandle(panel) {
  if (!panel || panel.querySelector(":scope > [data-nv-cartoon-resize-handle]")) return;
  const handle = document.createElement("span");
  markHtmlEditorChrome(handle);
  handle.className = "nv-editor-only";
  handle.setAttribute("data-nv-cartoon-resize-handle", "");
  presentHtmlAttribute(handle, "contenteditable", "false");
  handle.title = "Resize cartoon panel";
  panel.appendChild(handle);
  handle.addEventListener("pointerdown", createAddEventListenerPointerdownHandler({
    get panel() {
      return panel;
    }
  }));
}

export function simplifyLayout(node) {
  if (!node) return;
  Array.from(node.querySelectorAll("[data-nv-cartoon-split]")).reverse().forEach(split => {
    const children = Array.from(split.children).filter(child => child.matches?.("[data-nv-cartoon-frame], [data-nv-cartoon-split]"));
    if (children.length !== 1) return;
    split.replaceWith(children[0]);
  });
}
