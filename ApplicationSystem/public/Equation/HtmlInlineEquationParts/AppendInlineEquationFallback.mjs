// Nodevision/ApplicationSystem/public/Equation/HtmlInlineEquationParts/AppendInlineEquationFallback.mjs
// This module implements append Inline Equation Fallback behavior for the HtmlInlineEquation feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { clearElementChildren, INLINE_EQUATION_FALLBACK_CLASS, formatInlineEquationDisplay, normalizeInlineEquationFormat, ensureInlineEquationMathJax, INLINE_EQUATION_RENDERED_CLASS, INLINE_EQUATION_SELECTOR, INLINE_EQUATION_ACTIVE_ATTR, escapeHtml, MATHJAX_LOCAL_SRC, MATHJAX_CDN_SRC, DEFAULT_INLINE_EQUATION, stripInlineEquationDelimiters } from "./EscapeHtml.mjs";
import { presentHtmlAttribute } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";

// Append Inline Equation Fallback operations.
export function appendInlineEquationFallback(el, equation, format) {
  if (!(el instanceof Element)) return;
  clearElementChildren(el);
  const fallback = document.createElement("span");
  fallback.className = INLINE_EQUATION_FALLBACK_CLASS;
  fallback.textContent = formatInlineEquationDisplay(equation, format);
  el.appendChild(fallback);
}

export function shouldUseMathMlRenderer(equation, format) {
  return format === "mathml" && /^<\s*math(?:\s|>)/i.test(String(equation || "").trim());
}

export async function convertEquationToNode(equation, format) {
  const mathJax = window.MathJax;
  const isMathMl = shouldUseMathMlRenderer(equation, format);
  if (isMathMl && typeof mathJax?.mathml2chtmlPromise === "function") {
    return mathJax.mathml2chtmlPromise(equation);
  }
  if (isMathMl && typeof mathJax?.mathml2chtml === "function") {
    return mathJax.mathml2chtml(equation);
  }
  const display = format === "latex";
  if (typeof mathJax?.tex2chtmlPromise === "function") {
    return mathJax.tex2chtmlPromise(equation, {
      display
    });
  }
  if (typeof mathJax?.tex2chtml === "function") {
    return mathJax.tex2chtml(equation, {
      display
    });
  }
  return null;
}

export async function renderInlineEquationElement(el) {
  if (!(el instanceof Element)) return false;
  const format = normalizeInlineEquationFormat(el.getAttribute("data-nv-inline-equation-format") || "");
  const equation = readInlineEquationValue(el);
  el.classList.add("nv-inline-equation");
  el.setAttribute("data-nv-inline-equation-format", format);
  el.setAttribute("data-nv-inline-equation", equation);
  presentHtmlAttribute(el, "contenteditable", "false");
  presentHtmlAttribute(el, "tabindex", "0");
  el.setAttribute("role", "math");
  appendInlineEquationFallback(el, equation, format);
  const ready = await ensureInlineEquationMathJax();
  if (!ready) return false;
  try {
    const renderedNode = await convertEquationToNode(equation, format);
    if (!renderedNode) return false;
    clearElementChildren(el);
    const preview = document.createElement("span");
    preview.className = INLINE_EQUATION_RENDERED_CLASS;
    preview.appendChild(renderedNode);
    el.appendChild(preview);
    return true;
  } catch (err) {
    console.warn("Inline equation render failed:", err);
    appendInlineEquationFallback(el, equation, format);
    return false;
  }
}

export async function renderInlineEquations(root = getWysiwygRoot()) {
  const equations = Array.from(root?.querySelectorAll?.(INLINE_EQUATION_SELECTOR) || []);
  if (!equations.length) return [];
  return Promise.all(equations.map(el => renderInlineEquationElement(el)));
}

export function serializeInlineEquationsForSave(root = getWysiwygRoot(), {
  preservePresentation = false
} = {}) {
  const equations = Array.from(root?.querySelectorAll?.(INLINE_EQUATION_SELECTOR) || []);
  for (const el of equations) {
    const format = normalizeInlineEquationFormat(el.getAttribute("data-nv-inline-equation-format") || "");
    const equation = readInlineEquationValue(el);
    el.classList.add("nv-inline-equation");
    el.setAttribute("data-nv-inline-equation-format", format);
    el.setAttribute("data-nv-inline-equation", equation);
    if (!preservePresentation) {
      el.removeAttribute(INLINE_EQUATION_ACTIVE_ATTR);
      el.removeAttribute("contenteditable");
      el.removeAttribute("tabindex");
    }
    el.setAttribute("role", "math");
    el.textContent = formatInlineEquationDisplay(equation, format);
  }
  return root;
}

export function buildInlineEquationBrowserSupportHeadHtml() {
  const bs = String.fromCharCode(92);
  const config = ["window.MathJax = window.MathJax || {};", "window.MathJax.tex = Object.assign({", `  inlineMath: [["${bs}${bs}(", "${bs}${bs})"]],`, `  displayMath: [["$$", "$$"]],`, `  packages: { "[+]": ["ams"] }`, "}, window.MathJax.tex || {});", `window.MathJax.loader = Object.assign({ load: ["[tex]/ams"] }, window.MathJax.loader || {});`].join("\n");
  return [`<script data-nv-inline-equation-mathjax-config>${config}</script>`, `<script data-nv-inline-equation-mathjax-loader async src="${escapeHtml(MATHJAX_LOCAL_SRC)}" onerror="this.onerror=null;this.src=\x27${escapeHtml(MATHJAX_CDN_SRC)}\x27;"></script>`].join("\n");
}

export
// === DOM State ===
function getWysiwygRoot() {
  return document.querySelector("#wysiwyg") || document.body || document;
}

export function clearActiveInlineEquations(root = getWysiwygRoot()) {
  root?.querySelectorAll?.(`${INLINE_EQUATION_SELECTOR}[${INLINE_EQUATION_ACTIVE_ATTR}="true"]`).forEach(el => {
    presentHtmlAttribute(el, INLINE_EQUATION_ACTIVE_ATTR, null);
  });
}

export function focusEquationEnd(equationEl) {
  if (!(equationEl instanceof Element)) return;
  if (equationEl.getAttribute("contenteditable") === "false") {
    equationEl.focus?.();
    return;
  }
  const sel = window.getSelection();
  if (!sel) return;
  const textNode = equationEl.firstChild && equationEl.firstChild.nodeType === Node.TEXT_NODE ? equationEl.firstChild : equationEl.appendChild(document.createTextNode(String(equationEl.textContent || "")));
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
