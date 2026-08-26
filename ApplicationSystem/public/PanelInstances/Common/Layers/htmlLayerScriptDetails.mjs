// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/htmlLayerScriptDetails.mjs
// This module renders compact editable JavaScript function controls beneath selected HTML form layers in the shared Layers panel.

import { eventOptionsForElement, isInteractiveFormElement, makeUniqueElementId } from "./htmlFormEventTools.mjs";
import { createElementHandler, findElementScriptAssociation, replaceFunctionSource, updateAssociationEvent } from "./htmlScriptAssociations.mjs";

function markDirty(root) {
  window.HTMLWysiwygTools?.markDirty?.();
  root?.dispatchEvent?.(new Event("input", { bubbles: true }));
}

function recordMutation(root, beforeHtml) {
  if (beforeHtml && String(root?.innerHTML || "") !== beforeHtml) {
    window.HTMLWysiwygTools?.recordProgrammaticChange?.(beforeHtml);
  }
  markDirty(root);
}

function stopPanelEvent(event) {
  event.stopPropagation();
}

function styleDetails(details) {
  Object.assign(details.style, {
    borderTop: "1px solid #e3e3e3",
    padding: "6px 8px 8px 34px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  });
}

function makeEventSelect(element, association, onChange) {
  const select = document.createElement("select");
  const options = Array.from(new Set([association.eventName, ...eventOptionsForElement(element)].filter(Boolean)));
  options.forEach((eventName) => {
    const option = document.createElement("option");
    option.value = eventName;
    option.textContent = eventName;
    select.appendChild(option);
  });
  select.value = association.eventName;
  select.style.fontSize = "12px";
  select.addEventListener("click", stopPanelEvent);
  select.addEventListener("change", onChange);
  return select;
}

function makeFunctionTextarea(association, onInput, onBlur) {
  const textarea = document.createElement("textarea");
  textarea.value = association.functionSource || "";
  textarea.spellcheck = false;
  Object.assign(textarea.style, {
    width: "100%",
    minHeight: "118px",
    resize: "vertical",
    boxSizing: "border-box",
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
    fontSize: "12px",
    lineHeight: "1.4",
    whiteSpace: "pre",
    tabSize: "2",
  });
  textarea.addEventListener("click", stopPanelEvent);
  textarea.addEventListener("keydown", stopPanelEvent);
  textarea.addEventListener("input", onInput);
  textarea.addEventListener("blur", onBlur);
  return textarea;
}

function makeHandlerHeader(association) {
  const header = document.createElement("div");
  header.textContent = association.functionName + "()";
  Object.assign(header.style, {
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
    fontSize: "12px",
    color: "#333",
  });
  return header;
}

function renderCreateButton(details, root, element, requestRender) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = element.id ? "Create Handler" : "Create Handler and ID";
  button.addEventListener("click", (event) => {
    stopPanelEvent(event);
    const before = String(root?.innerHTML || "");
    if (!element.id) element.id = makeUniqueElementId(root, element.tagName?.toLowerCase?.() || "form-element");
    createElementHandler(root, element);
    recordMutation(root, before);
    requestRender?.();
  });
  details.appendChild(button);
}

function renderExistingAssociation(details, root, element, association, requestRender) {
  details.appendChild(makeHandlerHeader(association));

  const eventRow = document.createElement("label");
  eventRow.textContent = "Event: ";
  eventRow.style.fontSize = "12px";
  const select = makeEventSelect(element, association, (event) => {
    const before = String(root?.innerHTML || "");
    association = updateAssociationEvent(association, event.target.value) || association;
    recordMutation(root, before);
    requestRender?.();
  });
  eventRow.appendChild(select);
  details.appendChild(eventRow);

  let beforeEditHtml = "";
  const textarea = makeFunctionTextarea(
    association,
    (event) => {
      if (!beforeEditHtml) beforeEditHtml = String(root?.innerHTML || "");
      association = replaceFunctionSource(association, event.target.value) || association;
      markDirty(root);
    },
    () => {
      recordMutation(root, beforeEditHtml);
      beforeEditHtml = "";
      requestRender?.();
    }
  );
  details.appendChild(textarea);
}

export function renderHtmlLayerScriptDetails(wrapper, { root, element, requestRender } = {}) {
  if (!wrapper || !root || !element) return;
  const association = findElementScriptAssociation(root, element);
  if (!association && !isInteractiveFormElement(element)) return;

  const details = document.createElement("div");
  styleDetails(details);
  if (association) renderExistingAssociation(details, root, element, association, requestRender);
  else renderCreateButton(details, root, element, requestRender);
  wrapper.appendChild(details);
}
