// Nodevision/ApplicationSystem/public/Equation/HtmlInlineEquation.mjs
// This module owns shared HTML inline equation markup, formatting, insertion, and selection helpers so toolbar callbacks and Insert Media panels can edit the same equation elements consistently.

export const INLINE_EQUATION_SELECTOR = ".nv-inline-equation[data-nv-inline-equation]";
export const INLINE_EQUATION_ACTIVE_ATTR = "data-nv-equation-active";
export const DEFAULT_INLINE_EQUATION = "y = x";
export const INLINE_EQUATION_RENDERED_CLASS = "nv-inline-equation-rendered";
export const INLINE_EQUATION_FALLBACK_CLASS = "nv-inline-equation-fallback";
export const INLINE_EQUATION_BROWSER_SUPPORT_SELECTOR = "script[data-nv-inline-equation-mathjax-config], script[data-nv-inline-equation-mathjax-loader]";

const MATHJAX_SCRIPT_ID = "nv-inline-equation-mathjax";
const MATHJAX_LOCAL_SRC = "/vendor/mathjax/es5/tex-mml-chtml.js";
const MATHJAX_CDN_SRC = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";

let mathJaxReady = null;

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
  return `<span class="nv-inline-equation" data-nv-inline-equation-format="${format}" data-nv-inline-equation="${escapeHtml(equation)}" contenteditable="false" tabindex="0" role="math"${active}>${display}</span>`;
}

function hasMathJaxRenderer() {
  return typeof window !== "undefined" && Boolean(
    window.MathJax?.tex2chtmlPromise || window.MathJax?.tex2chtml ||
    window.MathJax?.mathml2chtmlPromise || window.MathJax?.mathml2chtml
  );
}

function configureMathJax() {
  window.MathJax = window.MathJax || {};
  const existingTex = window.MathJax.tex || {};
  const existingLoader = window.MathJax.loader || {};
  window.MathJax.tex = {
    ...existingTex,
    inlineMath: existingTex.inlineMath || [["\\(", "\\)"]],
    displayMath: existingTex.displayMath || [["$$", "$$"]],
    packages: existingTex.packages || { "[+]": ["ams"] },
  };
  window.MathJax.loader = {
    ...existingLoader,
    load: existingLoader.load || ["[tex]/ams"],
  };
}

function waitForMathJaxStartup() {
  const startupPromise = window.MathJax?.startup?.promise;
  if (startupPromise && typeof startupPromise.then === "function") {
    return startupPromise.then(() => hasMathJaxRenderer()).catch(() => hasMathJaxRenderer());
  }
  return Promise.resolve(hasMathJaxRenderer());
}

function loadMathJaxScript(src, id) {
  return new Promise((resolve) => {
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

function waitForExistingMathJaxScript(script) {
  return new Promise((resolve) => {
    if (!script || hasMathJaxRenderer()) {
      resolve(hasMathJaxRenderer());
      return;
    }

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(Boolean(value));
    };

    script.addEventListener("load", () => finish(true), { once: true });
    script.addEventListener("error", () => finish(false), { once: true });
    if (script.dataset.nvMathJaxLoaded === "true" || script.readyState === "complete") {
      setTimeout(() => finish(hasMathJaxRenderer()), 0);
    }
    setTimeout(() => finish(hasMathJaxRenderer()), 5000);
  });
}

export function ensureInlineEquationMathJax() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(false);
  }
  if (hasMathJaxRenderer()) {
    return Promise.resolve(true);
  }
  if (mathJaxReady) return mathJaxReady;

  configureMathJax();
  mathJaxReady = (async () => {
    const existing = document.getElementById(MATHJAX_SCRIPT_ID) ||
      Array.from(document.querySelectorAll("script[src]")).find((script) => /mathjax.*tex-mml-chtml/i.test(script.src));

    if (existing) {
      if (hasMathJaxRenderer()) return waitForMathJaxStartup();
      const loadedExisting = await waitForExistingMathJaxScript(existing);
      if (loadedExisting && await waitForMathJaxStartup()) return true;
      const loadedCdn = await loadMathJaxScript(MATHJAX_CDN_SRC, MATHJAX_SCRIPT_ID + "-cdn");
      return loadedCdn ? waitForMathJaxStartup() : false;
    }

    const loadedLocal = await loadMathJaxScript(MATHJAX_LOCAL_SRC, MATHJAX_SCRIPT_ID);
    if (loadedLocal && await waitForMathJaxStartup()) return true;

    const loadedCdn = await loadMathJaxScript(MATHJAX_CDN_SRC, MATHJAX_SCRIPT_ID + "-cdn");
    return loadedCdn ? waitForMathJaxStartup() : false;
  })();

  return mathJaxReady;
}

function clearElementChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function appendInlineEquationFallback(el, equation, format) {
  if (!(el instanceof Element)) return;
  clearElementChildren(el);
  const fallback = document.createElement("span");
  fallback.className = INLINE_EQUATION_FALLBACK_CLASS;
  fallback.textContent = formatInlineEquationDisplay(equation, format);
  el.appendChild(fallback);
}

function shouldUseMathMlRenderer(equation, format) {
  return format === "mathml" && /^<\s*math(?:\s|>)/i.test(String(equation || "").trim());
}

async function convertEquationToNode(equation, format) {
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
    return mathJax.tex2chtmlPromise(equation, { display });
  }
  if (typeof mathJax?.tex2chtml === "function") {
    return mathJax.tex2chtml(equation, { display });
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
  el.setAttribute("contenteditable", "false");
  el.setAttribute("tabindex", "0");
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
  return Promise.all(equations.map((el) => renderInlineEquationElement(el)));
}

export function serializeInlineEquationsForSave(root = getWysiwygRoot()) {
  const equations = Array.from(root?.querySelectorAll?.(INLINE_EQUATION_SELECTOR) || []);
  for (const el of equations) {
    const format = normalizeInlineEquationFormat(el.getAttribute("data-nv-inline-equation-format") || "");
    const equation = readInlineEquationValue(el);
    el.classList.add("nv-inline-equation");
    el.setAttribute("data-nv-inline-equation-format", format);
    el.setAttribute("data-nv-inline-equation", equation);
    el.removeAttribute(INLINE_EQUATION_ACTIVE_ATTR);
    el.removeAttribute("contenteditable");
    el.removeAttribute("tabindex");
    el.setAttribute("role", "math");
    el.textContent = formatInlineEquationDisplay(equation, format);
  }
  return root;
}

export function buildInlineEquationBrowserSupportHeadHtml() {
  const bs = String.fromCharCode(92);
  const config = [
    "window.MathJax = window.MathJax || {};",
    "window.MathJax.tex = Object.assign({",
    `  inlineMath: [["${bs}${bs}(", "${bs}${bs})"]],`,
    `  displayMath: [["$$", "$$"]],`,
    `  packages: { "[+]": ["ams"] }`,
    "}, window.MathJax.tex || {});",
    `window.MathJax.loader = Object.assign({ load: ["[tex]/ams"] }, window.MathJax.loader || {});`,
  ].join("\n");
  return [
    `<script data-nv-inline-equation-mathjax-config>${config}</script>`,
    `<script data-nv-inline-equation-mathjax-loader async src="${escapeHtml(MATHJAX_LOCAL_SRC)}" onerror="this.onerror=null;this.src=\x27${escapeHtml(MATHJAX_CDN_SRC)}\x27;"></script>`,
  ].join("\n");
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
  if (equationEl.getAttribute("contenteditable") === "false") {
    equationEl.focus?.();
    return;
  }
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
  appendInlineEquationFallback(el, equation, format);
  renderInlineEquationElement(el).catch((err) => console.warn("Inline equation render failed:", err));
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
  const inserted = root.querySelector?.(`${INLINE_EQUATION_SELECTOR}[${INLINE_EQUATION_ACTIVE_ATTR}="true"]`) ||
    equations[beforeCount] || equations[equations.length - 1] || null;
  if (inserted) {
    inserted.setAttribute(INLINE_EQUATION_ACTIVE_ATTR, "true");
    renderInlineEquationElement(inserted).catch((err) => console.warn("Inline equation render failed:", err));
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
