// Nodevision/ApplicationSystem/public/Equation/HtmlInlineEquationParts/WriteInlineEquationValue.mjs
// This module implements write Inline Equation Value behavior for the HtmlInlineEquation feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { normalizeInlineEquationFormat, stripInlineEquationDelimiters, DEFAULT_INLINE_EQUATION, INLINE_EQUATION_SELECTOR, buildInlineEquationHtml, INLINE_EQUATION_ACTIVE_ATTR, hasMathJaxRenderer } from "./EscapeHtml.mjs";
import { appendInlineEquationFallback, renderInlineEquationElement, getWysiwygRoot, clearActiveInlineEquations, focusEquationEnd } from "./AppendInlineEquationFallback.mjs";
import { presentHtmlAttribute } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";

// Write Inline Equation Value operations.
export function writeInlineEquationValue(el, value, formatRaw = "") {
  if (!(el instanceof Element)) return;
  const format = normalizeInlineEquationFormat(formatRaw || el.getAttribute("data-nv-inline-equation-format") || "");
  const equation = stripInlineEquationDelimiters(value) || DEFAULT_INLINE_EQUATION;
  el.setAttribute("data-nv-inline-equation-format", format);
  el.setAttribute("data-nv-inline-equation", equation);
  appendInlineEquationFallback(el, equation, format);
  renderInlineEquationElement(el).catch(err => console.warn("Inline equation render failed:", err));
}

export function insertInlineEquationAtCaret(equationText = DEFAULT_INLINE_EQUATION, formatRaw = "tex") {
  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.insertHTMLAtCaret !== "function") return null;
  const root = getWysiwygRoot();
  clearActiveInlineEquations(root);
  const beforeCount = root.querySelectorAll?.(INLINE_EQUATION_SELECTOR).length || 0;
  const html = buildInlineEquationHtml(equationText, formatRaw, {
    active: true
  });
  if (tools.insertHTMLAtCaret(html) === false) return null;
  const equations = Array.from(root.querySelectorAll?.(INLINE_EQUATION_SELECTOR) || []);
  const inserted = root.querySelector?.(`${INLINE_EQUATION_SELECTOR}[${INLINE_EQUATION_ACTIVE_ATTR}="true"]`) || equations[beforeCount] || equations[equations.length - 1] || null;
  if (inserted) {
    presentHtmlAttribute(inserted, INLINE_EQUATION_ACTIVE_ATTR, "true");
    renderInlineEquationElement(inserted).catch(err => console.warn("Inline equation render failed:", err));
    focusEquationEnd(inserted);
  }
  root.dispatchEvent?.(new Event("input", {
    bubbles: true
  }));
  return inserted;
}

export
// === Selection Lookup ===
function endpointElement(node) {
  return (node instanceof Element ? node : node?.parentElement) || null;
}

export function intersectsRange(range, el) {
  try {
    return typeof range?.intersectsNode === "function" && range.intersectsNode(el);
  } catch {
    return false;
  }
}

export function findElementInSelection(selector, {
  scope = getWysiwygRoot()
} = {}) {
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
  const target = findElementInSelection(INLINE_EQUATION_SELECTOR, {
    scope
  });
  return target instanceof Element ? target : null;
}

export function findSingleInlineEquationElement(scope = getWysiwygRoot()) {
  const inlineEquations = Array.from(scope?.querySelectorAll?.(INLINE_EQUATION_SELECTOR) || []);
  return inlineEquations.length === 1 ? inlineEquations[0] : null;
}

export function createMathJaxStartupLoader(owner) {
  return resolve => {
    if (!owner.script || hasMathJaxRenderer()) {
      resolve(hasMathJaxRenderer());
      return;
    }
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      resolve(Boolean(value));
    };
    owner.script.addEventListener("load", () => finish(true), {
      once: true
    });
    owner.script.addEventListener("error", () => finish(false), {
      once: true
    });
    if (owner.script.dataset.nvMathJaxLoaded === "true" || owner.script.readyState === "complete") {
      setTimeout(() => finish(hasMathJaxRenderer()), 0);
    }
    setTimeout(() => finish(hasMathJaxRenderer()), 5000);
  };
}
