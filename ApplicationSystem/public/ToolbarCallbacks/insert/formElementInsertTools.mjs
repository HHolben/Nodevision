// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/formElementInsertTools.mjs
// This toolbar module inserts standards-compliant HTML form controls into the active graphical HTML editor and creates ordinary JavaScript event handlers when appropriate.

import { getFormElementDefinition } from "./formElementDefinitions.mjs";
import { makeUniqueElementId } from "/PanelInstances/Common/Layers/htmlFormEventTools.mjs";
import { createElementHandler } from "/PanelInstances/Common/Layers/htmlScriptAssociations.mjs";

function activeEditorRoot() {
  return window.HTMLWysiwygTools?.getEditorElement?.() ||
    document.querySelector("#wysiwyg[contenteditable='true']") ||
    document.querySelector("#editor[contenteditable='true']");
}

function insertHtml(html) {
  const tools = window.HTMLWysiwygTools;
  if (tools && typeof tools.insertHTMLAtCaret === "function") return tools.insertHTMLAtCaret(html) !== false;
  try {
    return document.execCommand("insertHTML", false, String(html || ""));
  } catch {
    return false;
  }
}

function selectInsertedElement(root, element) {
  if (!root || !element) return;
  element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  if (typeof element.focus === "function") element.focus({ preventScroll: true });
  const selection = window.getSelection?.();
  if (selection && element.parentNode) {
    const range = document.createRange();
    range.selectNode(element);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  window.dispatchEvent?.(new CustomEvent("nodevision-html-layer-selected", { detail: { element } }));
}

function dispatchInserted(root) {
  window.HTMLWysiwygTools?.markDirty?.();
  root?.dispatchEvent?.(new Event("input", { bubbles: true }));
}

export function buildFormElementHtml(kind, root) {
  const definition = getFormElementDefinition(kind);
  if (!definition) return null;
  const id = makeUniqueElementId(root, definition.idBase || kind || "form-element");
  return {
    id,
    eventName: definition.eventName || "",
    html: definition.render({ id, uniqueId: (base) => makeUniqueElementId(root, base) }),
    label: definition.label,
  };
}

export function insertFormElement(kind) {
  const root = activeEditorRoot();
  if (!root) {
    alert("Open an HTML document to insert a form element.");
    return false;
  }

  const insertion = buildFormElementHtml(kind, root);
  if (!insertion) {
    alert("Unknown form element: " + kind);
    return false;
  }

  const inserted = insertHtml(insertion.html);
  const element = root.ownerDocument.getElementById(insertion.id);
  if (!inserted || !element || !root.contains(element)) {
    alert("Unable to insert the form element into the active HTML editor.");
    return false;
  }

  if (insertion.eventName) createElementHandler(root, element, insertion.eventName);
  selectInsertedElement(root, element);
  dispatchInserted(root);
  return true;
}
