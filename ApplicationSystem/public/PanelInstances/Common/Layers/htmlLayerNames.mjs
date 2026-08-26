// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/htmlLayerNames.mjs
// This module names HTML layers with human-readable labels while preserving ordinary document structure and avoiding Nodevision-specific element metadata.

export const HTML_LAYER_TAGS = new Set([
  "SECTION", "ARTICLE", "ASIDE", "MAIN", "HEADER", "FOOTER", "NAV", "DIV",
  "FIGURE", "FIGCAPTION", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "UL",
  "OL", "LI", "CANVAS", "SVG", "IMG", "VIDEO", "AUDIO", "IFRAME", "FORM",
  "BUTTON", "INPUT", "TEXTAREA", "SELECT", "LABEL", "FIELDSET"
]);

const INPUT_TYPE_LABELS = Object.freeze({
  text: "Text Field",
  number: "Number Field",
  email: "Email Field",
  password: "Password Field",
  search: "Search Field",
  tel: "Telephone Field",
  url: "URL Field",
  date: "Date Field",
  time: "Time Field",
  "datetime-local": "Date/Time Field",
  checkbox: "Checkbox",
  radio: "Radio Button",
  range: "Range Slider",
  color: "Color Picker",
  file: "File Input",
});

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function humanizeToken(value = "") {
  const words = cleanText(value).replace(/[_-]+/g, " ").match(/[A-Za-z0-9]+/g) || [];
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function inputType(el) {
  return String(el?.getAttribute?.("type") || el?.type || "text").toLowerCase();
}

function labelSelectorId(id) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(id);
  return String(id || "").replace(/["\\]/g, "\\$&");
}

function associatedLabelText(el) {
  const id = String(el?.id || "").trim();
  if (id) {
    const label = el?.ownerDocument?.querySelector?.('label[for="' + labelSelectorId(id) + '"]');
    const text = cleanText(label?.textContent || "");
    if (text) return text;
  }
  const wrapperLabel = el?.closest?.("label");
  return cleanText(wrapperLabel?.textContent || "");
}

function ownTextLabel(el) {
  const tag = String(el?.tagName || "").toUpperCase();
  if (!["BUTTON", "LABEL", "LEGEND", "TEXTAREA"].includes(tag)) return "";
  return cleanText(el?.textContent || "");
}

function typeLabel(el) {
  const tag = String(el?.tagName || "").toUpperCase();
  if (tag === "INPUT") return INPUT_TYPE_LABELS[inputType(el)] || humanizeToken(inputType(el)) || "Input";
  if (tag === "TEXTAREA") return "Text Area";
  if (tag === "SELECT") return "Select / Dropdown";
  if (tag === "BUTTON") return "Button";
  if (tag === "LABEL") return "Label";
  if (tag === "FIELDSET") return "Fieldset";
  if (tag === "FORM") return "Form";
  return tag ? humanizeToken(tag.toLowerCase()) : "Element";
}

export function isHtmlLayerElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.closest?.("[data-nv-layer-ignore]")) return false;
  return Boolean(el.id || HTML_LAYER_TAGS.has(el.tagName));
}

export function htmlLayerDisplayName(el, index = 0) {
  if (!el) return "Element " + (index + 1);
  const explicit = cleanText(el.getAttribute?.("data-layer-name") || el.getAttribute?.("aria-label") || el.getAttribute?.("title"));
  const label = associatedLabelText(el) || ownTextLabel(el) || cleanText(el.getAttribute?.("placeholder"));
  const idLabel = humanizeToken(el.id || "");
  const nameLabel = humanizeToken(el.getAttribute?.("name") || "");
  return explicit || label || idLabel || nameLabel || typeLabel(el) || "Element " + (index + 1);
}
