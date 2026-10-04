// Nodevision/ApplicationSystem/public/Equation/HtmlInlineEquationParts/EscapeHtml.mjs
// This module implements escape Html behavior for the HtmlInlineEquation feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createMathJaxStartupLoader } from "./WriteInlineEquationValue.mjs";

// Escape Html operations.
export const HtmlInlineEquationModuleState = {};

export const INLINE_EQUATION_SELECTOR = ".nv-inline-equation[data-nv-inline-equation]";

export const INLINE_EQUATION_ACTIVE_ATTR = "data-nv-equation-active";

export const DEFAULT_INLINE_EQUATION = "y = x";

export const INLINE_EQUATION_RENDERED_CLASS = "nv-inline-equation-rendered";

export const INLINE_EQUATION_FALLBACK_CLASS = "nv-inline-equation-fallback";

export const INLINE_EQUATION_BROWSER_SUPPORT_SELECTOR = "script[data-nv-inline-equation-mathjax-config], script[data-nv-inline-equation-mathjax-loader]";

export const MATHJAX_SCRIPT_ID = "nv-inline-equation-mathjax";

export const MATHJAX_LOCAL_SRC = "/vendor/mathjax/es5/tex-mml-chtml.js";

export const MATHJAX_CDN_SRC = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";

export
// === Text Formatting ===
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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

export function formatInlineEquationDisplay(equation = "", formatRaw = "tex", {
  escape = false
} = {}) {
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
  const display = formatInlineEquationDisplay(equation, format, {
    escape: true
  });
  return `<span class="nv-inline-equation" data-nv-inline-equation-format="${format}" data-nv-inline-equation="${escapeHtml(equation)}" contenteditable="false" tabindex="0" role="math"${active}>${display}</span>`;
}

export function hasMathJaxRenderer() {
  return typeof window !== "undefined" && Boolean(window.MathJax?.tex2chtmlPromise || window.MathJax?.tex2chtml || window.MathJax?.mathml2chtmlPromise || window.MathJax?.mathml2chtml);
}

export function configureMathJax() {
  window.MathJax = window.MathJax || {};
  const existingTex = window.MathJax.tex || {};
  const existingLoader = window.MathJax.loader || {};
  window.MathJax.tex = {
    ...existingTex,
    inlineMath: existingTex.inlineMath || [["\\(", "\\)"]],
    displayMath: existingTex.displayMath || [["$$", "$$"]],
    packages: existingTex.packages || {
      "[+]": ["ams"]
    }
  };
  window.MathJax.loader = {
    ...existingLoader,
    load: existingLoader.load || ["[tex]/ams"]
  };
}

export function waitForMathJaxStartup() {
  const startupPromise = window.MathJax?.startup?.promise;
  if (startupPromise && typeof startupPromise.then === "function") {
    return startupPromise.then(() => hasMathJaxRenderer()).catch(() => hasMathJaxRenderer());
  }
  return Promise.resolve(hasMathJaxRenderer());
}

export function loadMathJaxScript(src, id) {
  return new Promise(resolve => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.nvMathJaxLoaded = "true";
      resolve(true);
    };
    script.onerror = () => {
      script.remove();
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

export function waitForExistingMathJaxScript(script) {
  return new Promise(createMathJaxStartupLoader({
    get script() {
      return script;
    }
  }));
}

export function ensureInlineEquationMathJax() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(false);
  }
  if (hasMathJaxRenderer()) {
    return Promise.resolve(true);
  }
  if (HtmlInlineEquationModuleState.mathJaxReady) return HtmlInlineEquationModuleState.mathJaxReady;
  configureMathJax();
  HtmlInlineEquationModuleState.mathJaxReady = (async () => {
    const existing = document.getElementById(MATHJAX_SCRIPT_ID) || Array.from(document.querySelectorAll("script[src]")).find(script => /mathjax.*tex-mml-chtml/i.test(script.src));
    if (existing) {
      if (hasMathJaxRenderer()) return waitForMathJaxStartup();
      const loadedExisting = await waitForExistingMathJaxScript(existing);
      if (loadedExisting && (await waitForMathJaxStartup())) return true;
      const loadedCdn = await loadMathJaxScript(MATHJAX_CDN_SRC, MATHJAX_SCRIPT_ID + "-cdn");
      return loadedCdn ? waitForMathJaxStartup() : false;
    }
    const loadedLocal = await loadMathJaxScript(MATHJAX_LOCAL_SRC, MATHJAX_SCRIPT_ID);
    if (loadedLocal && (await waitForMathJaxStartup())) return true;
    const loadedCdn = await loadMathJaxScript(MATHJAX_CDN_SRC, MATHJAX_SCRIPT_ID + "-cdn");
    return loadedCdn ? waitForMathJaxStartup() : false;
  })();
  return HtmlInlineEquationModuleState.mathJaxReady;
}

export function clearElementChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}
