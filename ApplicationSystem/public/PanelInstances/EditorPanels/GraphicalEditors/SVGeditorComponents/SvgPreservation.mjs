// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgPreservation.mjs
// Focused helpers for preserving user-authored SVG structure while the graphical SVG editor adds runtime affordances.

import { ensureSvgSizeAttrs } from "./svgDom.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const RUNTIME_ROOT_ID = "svg-editor";

export function applyEditableSvgRootDefaults(root) {
  if (!root) return root;
  if (!root.getAttribute?.("xmlns")) root.setAttribute("xmlns", SVG_NS);
  ensureSvgSizeAttrs(root);
  return root;
}

export function prepareSvgRootForEditor(root, { runtimeRootId = RUNTIME_ROOT_ID } = {}) {
  if (!root) return { generatedRootId: false };
  const generatedRootId = !root.getAttribute?.("id");
  if (generatedRootId && runtimeRootId) root.setAttribute("id", runtimeRootId);
  return { generatedRootId };
}

function removeAll(root, selector, removeNode) {
  Array.from(root?.querySelectorAll?.(selector) || []).forEach((node) => removeNode(node));
}

export function cleanupSvgCloneForSave(clone, { generatedRootId = false, runtimeRootId = RUNTIME_ROOT_ID, uiAttr = "data-nv-editor-ui" } = {}) {
  if (!clone) return clone;
  if (generatedRootId && clone.getAttribute?.("id") === runtimeRootId) clone.removeAttribute("id");

  removeAll(clone, `[${uiAttr}]`, (el) => el.remove());
  removeAll(clone, "[data-selected]", (el) => el.removeAttribute("data-selected"));
  removeAll(clone, "[data-nv-solo-hidden]", (el) => el.removeAttribute("data-nv-solo-hidden"));
  removeAll(clone, "[data-nv-solo-prev-display]", (el) => el.removeAttribute("data-nv-solo-prev-display"));

  removeAll(clone, "[style]", (el) => {
    if (el.style?.filter === "drop-shadow(0 0 2px #ff2f2f)") {
      el.style.filter = "";
      if (!el.getAttribute("style")) el.removeAttribute("style");
    }
  });

  return clone;
}
