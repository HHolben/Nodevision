// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertSensitive.mjs
// Inserts editable text that is visible on screen but hidden in printed output.

const PRINT_STYLE_MARKER = "data-nodevision-sensitive-print-style";
const SENSITIVE_CLASS = "nodevision-sensitive";
const LEGACY_SENSITIVE_CLASS = "sensitive";
const DEFAULT_TEXT = "Sensitive text";

function getWysiwyg() {
  return document.querySelector("#wysiwyg[contenteditable='true']");
}

function getNodeParent(node) {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
}

function getRangeInsideEditor(wysiwyg) {
  const selection = window.getSelection();
  if (!selection) return null;

  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const startParent = getNodeParent(range.startContainer);
    const endParent = getNodeParent(range.endContainer);
    if (startParent && endParent && wysiwyg.contains(startParent) && wysiwyg.contains(endParent)) {
      return range;
    }
  }

  const fallback = document.createRange();
  fallback.selectNodeContents(wysiwyg);
  fallback.collapse(false);
  selection.removeAllRanges();
  selection.addRange(fallback);
  return fallback;
}

function ensurePrintStyle(wysiwyg) {
  const existing = wysiwyg.querySelector(`style[${PRINT_STYLE_MARKER}]`);
  if (existing) return;

  const style = document.createElement("style");
  style.setAttribute(PRINT_STYLE_MARKER, "true");
  style.textContent = [
    "@media print {",
    `  .${SENSITIVE_CLASS},`,
    `  .${LEGACY_SENSITIVE_CLASS} {`,
    "    display: none !important;",
    "  }",
    "}"
  ].join("\n");

  wysiwyg.insertBefore(style, wysiwyg.firstChild);
}

function createSensitiveElement(text) {
  const element = document.createElement("span");
  element.className = `${SENSITIVE_CLASS} ${LEGACY_SENSITIVE_CLASS}`;
  element.dataset.nodevisionSensitive = "true";
  element.title = "Hidden when printed";
  element.style.cssText = [
    "display:inline-block",
    "padding:0.12em 0.4em",
    "margin:0 0.08em",
    "border:1px solid #d49620",
    "border-radius:3px",
    "background:#fff4ce",
    "color:#4f3500"
  ].join(";");
  element.textContent = text || DEFAULT_TEXT;
  return element;
}

function placeCaretAfter(node) {
  const selection = window.getSelection();
  if (!selection) return;

  const spacer = document.createTextNode("\u00A0");
  node.after(spacer);

  const range = document.createRange();
  range.setStart(spacer, 1);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

export default function insertSensitive() {
  const wysiwyg = getWysiwyg();
  if (!wysiwyg) {
    alert("Open an HTML document to insert sensitive text.");
    return;
  }

  wysiwyg.focus();
  const range = getRangeInsideEditor(wysiwyg);
  if (!range) {
    console.warn("insertSensitive: No selection range available.");
    return;
  }

  const selectedText = range.toString();
  let text = selectedText;
  if (!text) {
    const prompted = prompt("Enter the sensitive text:", DEFAULT_TEXT);
    if (prompted === null) return;
    text = prompted || DEFAULT_TEXT;
  }

  const sensitiveElement = createSensitiveElement(text);
  range.deleteContents();
  range.insertNode(sensitiveElement);
  placeCaretAfter(sensitiveElement);
  ensurePrintStyle(wysiwyg);
}
