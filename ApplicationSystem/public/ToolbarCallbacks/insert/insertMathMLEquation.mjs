// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertMathMLEquation.mjs
// Inserts an inline MathML-style equation placeholder at the caret and opens structure tools.

const INLINE_EQ_SELECTOR = ".nv-inline-equation[data-nv-inline-equation]";
const ACTIVE_ATTR = "data-nv-equation-active";
const DEFAULT_EQUATION = "y =";

function clearActiveInlineEquations(root = document) {
  const scope = root.querySelector("#wysiwyg") || root;
  scope.querySelectorAll(`${INLINE_EQ_SELECTOR}[${ACTIVE_ATTR}="true"]`).forEach((el) => {
    el.removeAttribute(ACTIVE_ATTR);
  });
}

function focusEquationEnd(equationEl) {
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

function markInsertedEquationActive() {
  const root = document.querySelector("#wysiwyg") || document;
  const equations = Array.from(root.querySelectorAll(`${INLINE_EQ_SELECTOR}[${ACTIVE_ATTR}="true"]`));
  if (equations.length) {
    const latest = equations[equations.length - 1];
    focusEquationEnd(latest);
    return;
  }

  const all = Array.from(root.querySelectorAll(INLINE_EQ_SELECTOR));
  if (!all.length) return;
  const latest = all[all.length - 1];
  latest.setAttribute(ACTIVE_ATTR, "true");
  focusEquationEnd(latest);
}

export default function insertMathMLEquation() {
  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.insertHTMLAtCaret !== "function") {
    console.warn("insertMathMLEquation: HTML equation tools are unavailable.");
    return;
  }

  clearActiveInlineEquations(document);

  const html = `<span class="nv-inline-equation" data-nv-inline-equation-format="mathml" data-nv-inline-equation="${DEFAULT_EQUATION}" ${ACTIVE_ATTR}="true">${DEFAULT_EQUATION}</span>`;
  tools.insertHTMLAtCaret(html);
  markInsertedEquationActive();

  const wysiwyg = document.querySelector("#wysiwyg");
  if (wysiwyg) {
    wysiwyg.dispatchEvent(new Event("input", { bubbles: true }));
  }

  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "Equation Element", force: true, toggle: false },
  }));
}
