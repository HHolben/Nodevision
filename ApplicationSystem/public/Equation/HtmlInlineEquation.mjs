// Nodevision/ApplicationSystem/public/Equation/HtmlInlineEquation.mjs
// This module owns shared HTML inline equation markup, formatting, insertion, and selection helpers so toolbar callbacks and Insert Media panels can edit the same equation elements consistently.

export const INLINE_EQUATION_SELECTOR = ".nv-inline-equation[data-nv-inline-equation]";
export const INLINE_EQUATION_ACTIVE_ATTR = "data-nv-equation-active";
export const DEFAULT_INLINE_EQUATION = "y = x";

// === Text Formatting ===
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeInlineEquationFormat(formatRaw = "") {
  const format = String(formatRaw || "").trim().toLowerCase();
  if (format === "latex" || format === "mathml") return format;
  return "tex";
}

export function stripInlineEquationDelimiters(value = "") {
  const text = String(value || "").trim();
  if (text.startsWith("$$") && text.endsWith("$$") && text.length >= 4) {
    return text.slice(2, -2).trim();
  }
  if (text.startsWith("\\(") && text.endsWith("\\)") && text.length >= 4) {
    return text.slice(2, -2).trim();
  }
  return text;
}

export function formatInlineEquationDisplay(equation = "", formatRaw = "tex", { escape = false } = {}) {
  const format = normalizeInlineEquationFormat(formatRaw);
  const rawText = stripInlineEquationDelimiters(equation) || DEFAULT_INLINE_EQUATION;
  const text = escape ? escapeHtml(rawText) : rawText;
  if (format === "latex") return `$$${text}$$`;
  if (format === "mathml") return text;
  return `\\(${text}\\)`;
}

export function buildInlineEquationHtml(equationText = "", formatRaw = "tex", options = {}) {
  const format = normalizeInlineEquationFormat(formatRaw);
  const equation = stripInlineEquationDelimiters(equationText) || DEFAULT_INLINE_EQUATION;
  const active = options.active ? ` ${INLINE_EQUATION_ACTIVE_ATTR}="true"` : "";
  const display = formatInlineEquationDisplay(equation, format, { escape: true });
  return `<span class="nv-inline-equation" data-nv-inline-equation-format="${format}" data-nv-inline-equation="${escapeHtml(equation)}"${active}>${display}</span>`;
}

// === DOM State ===
function getWysiwygRoot() {
  return document.querySelector("#wysiwyg") || document.body || document;
}

export function clearActiveInlineEquations(root = getWysiwygRoot()) {
  root?.querySelectorAll?.(`${INLINE_EQUATION_SELECTOR}[${INLINE_EQUATION_ACTIVE_ATTR}="true"]`).forEach((el) => {
    el.removeAttribute(INLINE_EQUATION_ACTIVE_ATTR);
  });
}

export function focusEquationEnd(equationEl) {
  if (!(equationEl instanceof Element)) return;
  const sel = window.getSelection();
  if (!sel) return;

  const textNode = equationEl.firstChild && equationEl.firstChild.nodeType === Node.TEXT_NODE
    ? equationEl.firstChild
    : equationEl.appendChild(document.createTextNode(String(equationEl.textContent || "")));

  const range = document.createRange();
  const len = textNode.nodeValue ? textNode.nodeValue.length : 0;
  range.setStart(textNode, len);
  range.setEnd(textNode, len);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function readInlineEquationValue(el) {
  if (!(el instanceof Element)) return DEFAULT_INLINE_EQUATION;
  const fromData = String(el.getAttribute("data-nv-inline-equation") || "").trim();
  if (fromData) return stripInlineEquationDelimiters(fromData);
  const fromText = String(el.textContent || "").trim();
  if (fromText) return stripInlineEquationDelimiters(fromText);
  return DEFAULT_INLINE_EQUATION;
}

export function writeInlineEquationValue(el, value, formatRaw = "") {
  if (!(el instanceof Element)) return;
  const format = normalizeInlineEquationFormat(formatRaw || el.getAttribute("data-nv-inline-equation-format") || "");
  const equation = stripInlineEquationDelimiters(value) || DEFAULT_INLINE_EQUATION;
  el.setAttribute("data-nv-inline-equation-format", format);
  el.setAttribute("data-nv-inline-equation", equation);
  el.textContent = formatInlineEquationDisplay(equation, format);
}

export function insertInlineEquationAtCaret(equationText = DEFAULT_INLINE_EQUATION, formatRaw = "tex") {
  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.insertHTMLAtCaret !== "function") return null;
  const root = getWysiwygRoot();
  clearActiveInlineEquations(root);
  const beforeCount = root.querySelectorAll?.(INLINE_EQUATION_SELECTOR).length || 0;
  const html = buildInlineEquationHtml(equationText, formatRaw, { active: true });
  if (tools.insertHTMLAtCaret(html) === false) return null;
  const equations = Array.from(root.querySelectorAll?.(INLINE_EQUATION_SELECTOR) || []);
  const inserted = equations[beforeCount] || equations[equations.length - 1] || null;
  if (inserted) {
    inserted.setAttribute(INLINE_EQUATION_ACTIVE_ATTR, "true");
    focusEquationEnd(inserted);
  }
  root.dispatchEvent?.(new Event("input", { bubbles: true }));
  return inserted;
}

// === Selection Lookup ===
function endpointElement(node) {
  return (node instanceof Element ? node : node?.parentElement) || null;
}

function intersectsRange(range, el) {
  try {
    return typeof range?.intersectsNode === "function" && range.intersectsNode(el);
  } catch {
    return false;
  }
}

export function findElementInSelection(selector, { scope = getWysiwygRoot() } = {}) {
  const sel = window.getSelection?.();
  const endpoints = [sel?.anchorNode, sel?.focusNode].map(endpointElement).filter(Boolean);
  const activeEl = document.activeElement instanceof Element ? document.activeElement : null;
  if (activeEl) endpoints.push(activeEl);

  for (const el of endpoints) {
    const target = el.closest?.(selector);
    if (target && (!scope?.contains || scope.contains(target))) return target;
  }

  for (let i = 0; sel && i < sel.rangeCount; i += 1) {
    const range = sel.getRangeAt(i);
    for (const target of Array.from(scope?.querySelectorAll?.(selector) || [])) {
      if (intersectsRange(range, target)) return target;
    }
  }

  return null;
}

export function findSelectedInlineEquationElement(scope = getWysiwygRoot()) {
  const target = findElementInSelection(INLINE_EQUATION_SELECTOR, { scope });
  return target instanceof Element ? target : null;
}

export function findSingleInlineEquationElement(scope = getWysiwygRoot()) {
  const inlineEquations = Array.from(scope?.querySelectorAll?.(INLINE_EQUATION_SELECTOR) || []);
  return inlineEquations.length === 1 ? inlineEquations[0] : null;
}
