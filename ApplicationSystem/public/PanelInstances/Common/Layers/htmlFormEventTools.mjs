// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/htmlFormEventTools.mjs
// This module centralizes HTML form event choices, safe JavaScript handler names, and standard listener source generation for graphical HTML editing.

export const INTERACTIVE_FORM_SELECTOR = "button,input,select,textarea,form";

const TEXT_INPUT_TYPES = new Set(["text", "number", "email", "password", "search", "tel", "url"]);
const CHANGE_INPUT_TYPES = new Set(["date", "time", "datetime-local", "checkbox", "radio", "color", "file"]);
const EVENT_OPTIONS = Object.freeze({
  action: Object.freeze(["click", "dblclick", "focus", "blur", "keydown", "keyup", "pointerdown", "pointerup"]),
  text: Object.freeze(["input", "change", "focus", "blur", "keydown", "keyup"]),
  change: Object.freeze(["change", "input", "focus", "blur"]),
  file: Object.freeze(["change", "focus", "blur"]),
  form: Object.freeze(["submit", "input", "change", "focus", "blur", "keydown", "keyup"]),
});

function tagName(el) {
  return String(el?.tagName || "").toLowerCase();
}

function inputType(el) {
  return String(el?.getAttribute?.("type") || el?.type || "text").toLowerCase();
}

export function isInteractiveFormElement(el) {
  const tag = tagName(el);
  if (tag === "button" || tag === "select" || tag === "textarea" || tag === "form") return true;
  if (tag !== "input") return false;
  return inputType(el) !== "hidden";
}

export function eventOptionsForElement(el) {
  const tag = tagName(el);
  if (tag === "form") return EVENT_OPTIONS.form;
  if (tag === "button") return EVENT_OPTIONS.action;
  if (tag === "select") return EVENT_OPTIONS.change;
  if (tag === "textarea") return EVENT_OPTIONS.text;
  if (tag !== "input") return Object.freeze([]);
  const type = inputType(el);
  if (type === "file") return EVENT_OPTIONS.file;
  if (TEXT_INPUT_TYPES.has(type) || type === "range") return EVENT_OPTIONS.text;
  if (CHANGE_INPUT_TYPES.has(type)) return EVENT_OPTIONS.change;
  return EVENT_OPTIONS.change;
}

export function defaultEventForElement(el) {
  const options = eventOptionsForElement(el);
  return options[0] || "";
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

export function jsIdentifierFromText(value = "", fallback = "handler") {
  const words = String(value || "").match(/[A-Za-z0-9_$]+/g) || [];
  const base = words.map((word, index) => {
    const clean = word.replace(/^[^A-Za-z_$]+/, "").replace(/[^A-Za-z0-9_$]/g, "");
    if (!clean) return "";
    return index === 0 ? clean.charAt(0).toLowerCase() + clean.slice(1) : capitalize(clean);
  }).join("");
  const candidate = base || fallback;
  return /^[A-Za-z_$]/.test(candidate) ? candidate : "element" + capitalize(candidate);
}

function eventSuffix(eventName = "") {
  return String(eventName || "event").split(/[^A-Za-z0-9_$]+/).filter(Boolean).map(capitalize).join("") || "Event";
}

function elementNameSeed(el) {
  const tag = tagName(el) || "element";
  const type = tag === "input" ? inputType(el) : tag;
  return el?.id || el?.getAttribute?.("name") || el?.getAttribute?.("aria-label") || type;
}

export function uniqueFunctionName(baseName, existingNames = []) {
  const existing = new Set(existingNames.filter(Boolean));
  if (!existing.has(baseName)) return baseName;
  let index = 2;
  while (existing.has(baseName + index)) index += 1;
  return baseName + index;
}

export function generatedFunctionNameForElement(el, eventName, existingNames = []) {
  const base = jsIdentifierFromText(elementNameSeed(el), "element");
  return uniqueFunctionName(base + eventSuffix(eventName), existingNames);
}

export function buildHandlerFunctionSource(functionName, eventName) {
  const name = jsIdentifierFromText(functionName, "handler");
  if (String(eventName || "") === "submit") {
    return "function " + name + "(event) {\n    event.preventDefault();\n}";
  }
  return "function " + name + "(event) {\n\n}";
}

export function buildListenerSource(elementId, eventName, functionName) {
  return "document.getElementById(" + JSON.stringify(String(elementId || "")) + ")\n" +
    "    ?.addEventListener(" + JSON.stringify(String(eventName || "")) + ", " + functionName + ");";
}

export function buildHandlerScript({ elementId = "", eventName = "", functionName = "" } = {}) {
  return buildHandlerFunctionSource(functionName, eventName) + "\n\n" +
    buildListenerSource(elementId, eventName, functionName);
}

function safeElementIdBase(value = "element") {
  return String(value || "element").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "element";
}

function rootContainsId(root, id) {
  const found = root?.ownerDocument?.getElementById?.(id);
  return Boolean(found && (!root || root === found || root.contains?.(found)));
}

export function makeUniqueElementId(root, base = "element") {
  const cleanBase = safeElementIdBase(base);
  let id = cleanBase;
  let index = 1;
  while (rootContainsId(root, id)) {
    id = cleanBase + "-" + index;
    index += 1;
  }
  return id;
}
