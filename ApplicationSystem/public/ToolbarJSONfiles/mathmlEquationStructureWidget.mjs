// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/mathmlEquationStructureWidget.mjs
// Renders an HTML-editing sub-toolbar for appending equation structure snippets.

const MODE = "HTMLediting";
const INLINE_EQ_SELECTOR = ".nv-inline-equation[data-nv-inline-equation]";
const ACTIVE_ATTR = "data-nv-equation-active";
const DEFAULT_EQUATION = "y =";

function getWysiwygRoot() {
  return document.querySelector("#wysiwyg");
}

function clearActiveEquation(root) {
  if (!root) return;
  root.querySelectorAll(`${INLINE_EQ_SELECTOR}[${ACTIVE_ATTR}="true"]`).forEach((el) => {
    el.removeAttribute(ACTIVE_ATTR);
  });
}

function readEquationText(el) {
  if (!(el instanceof Element)) return "";
  const fromData = String(el.getAttribute("data-nv-inline-equation") || "").trim();
  if (fromData) return fromData;
  return String(el.textContent || "").trim();
}

function setEquationText(el, value) {
  if (!(el instanceof Element)) return;
  const next = String(value || "").trim();
  el.setAttribute("data-nv-inline-equation-format", "mathml");
  el.setAttribute("data-nv-inline-equation", next);
  el.textContent = next;
}

function focusEquationEnd(el) {
  if (!(el instanceof Element)) return;
  const sel = window.getSelection();
  if (!sel) return;
  const textNode = el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE
    ? el.firstChild
    : el.appendChild(document.createTextNode(String(el.textContent || "")));

  const len = textNode.nodeValue ? textNode.nodeValue.length : 0;
  const range = document.createRange();
  range.setStart(textNode, len);
  range.setEnd(textNode, len);
  sel.removeAllRanges();
  sel.addRange(range);
}

function findTargetEquation() {
  const root = getWysiwygRoot();
  if (!root) return null;

  const active = root.querySelector(`${INLINE_EQ_SELECTOR}[${ACTIVE_ATTR}="true"]`);
  if (active) return active;

  const sel = window.getSelection();
  const anchor = sel?.anchorNode || sel?.focusNode || null;
  const anchorEl = anchor instanceof Element ? anchor : anchor?.parentElement;
  const fromSelection = anchorEl?.closest?.(INLINE_EQ_SELECTOR) || null;
  if (fromSelection && root.contains(fromSelection)) return fromSelection;

  const all = root.querySelectorAll(INLINE_EQ_SELECTOR);
  if (!all.length) return null;
  return all[all.length - 1];
}

function createInlineEquationAtCaret(root) {
  if (!root) return null;
  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.insertHTMLAtCaret !== "function") return null;

  clearActiveEquation(root);
  const html = `<span class="nv-inline-equation" data-nv-inline-equation-format="mathml" data-nv-inline-equation="${DEFAULT_EQUATION}" ${ACTIVE_ATTR}="true">${DEFAULT_EQUATION}</span>`;
  tools.insertHTMLAtCaret(html);

  const all = root.querySelectorAll(INLINE_EQ_SELECTOR);
  if (!all.length) return null;
  const latest = all[all.length - 1];
  latest.setAttribute(ACTIVE_ATTR, "true");
  focusEquationEnd(latest);
  return latest;
}

function ensureTargetEquation() {
  const root = getWysiwygRoot();
  if (!root) return null;
  return findTargetEquation() || createInlineEquationAtCaret(root);
}

function appendSnippet(snippet = "") {
  const root = getWysiwygRoot();
  const target = ensureTargetEquation();
  if (!root || !target) {
    console.warn("mathmlEquationStructureWidget: unable to create/select inline equation.");
    return;
  }

  clearActiveEquation(root);
  target.setAttribute(ACTIVE_ATTR, "true");

  const current = readEquationText(target);
  const space = current && !/\s$/.test(current) ? " " : "";
  const next = `${current}${space}${snippet}`.trim();
  setEquationText(target, next);
  focusEquationEnd(target);
  root.dispatchEvent(new Event("input", { bubbles: true }));
}

function makeButton(label, snippet) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  Object.assign(btn.style, {
    height: "28px",
    padding: "0 10px",
    border: "1px solid #333",
    borderRadius: "4px",
    background: "#eee",
    cursor: "pointer",
    fontSize: "12px",
    lineHeight: "28px",
    whiteSpace: "nowrap",
  });
  btn.addEventListener("click", (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    appendSnippet(snippet);
  });
  return btn;
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  if ((window.NodevisionState?.currentMode || "") !== MODE) return;

  const mount = hostElement.querySelector("#nv-mathml-equation-structure") || hostElement;
  mount.id = "nv-mathml-equation-structure";
  mount.innerHTML = "";
  mount.style.display = "flex";
  mount.style.gap = "6px";
  mount.style.flexWrap = "wrap";

  const snippets = [
    { label: "∫", snippet: "∫()" },
    { label: "∫ᵃᵇ", snippet: "∫[a,b](f(x))" },
    { label: "∬", snippet: "∬[D](f(x,y))" },
    { label: "lim", snippet: "lim(x→∞)" },
    { label: "Σ", snippet: "Σ()" },
    { label: "Π", snippet: "Π()" },
    { label: "÷", snippet: "÷" },
    { label: "Frac Bar", snippet: "(a)/(b)" },
    { label: "2×2 Matrix", snippet: "[[a11,a12],[a21,a22]]" },
    { label: "3×3 Matrix", snippet: "[[a11,a12,a13],[a21,a22,a23],[a31,a32,a33]]" },
    { label: "m×n Matrix", snippet: "[[a11,…,a1n],…,[am1,…,amn]]" },
    { label: "!", snippet: "!" },
    { label: "xⁿ", snippet: "^n" },
    { label: "x̂", snippet: "^" },
    { label: "xₙ", snippet: "_n" },
    { label: "·", snippet: "·" },
    { label: "×", snippet: "×" },
  ];

  snippets.forEach(({ label, snippet }) => {
    mount.appendChild(makeButton(label, snippet));
  });
}
