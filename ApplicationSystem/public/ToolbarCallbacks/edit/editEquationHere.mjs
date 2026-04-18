// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/editEquationHere.mjs
// Open the equation editor for a selected equation link (tex/latex/mathml) or selected equation file.

import { createPanelDOM } from "/panels/panelFactory.mjs";

const EQUATION_EXTENSIONS = new Set(["tex", "latex", "mathml", "mml"]);
const INLINE_EQUATION_SELECTOR = "[data-nv-inline-equation]";
const DEFAULT_INLINE_EQUATION = "y = x";

function normalizeInlineEquationFormat(formatRaw = "") {
  const format = String(formatRaw || "").trim().toLowerCase();
  if (format === "latex" || format === "mathml") return format;
  return "tex";
}

function stripInlineEquationDelimiters(value = "") {
  const text = String(value || "").trim();
  if (text.startsWith("$$") && text.endsWith("$$") && text.length >= 4) {
    return text.slice(2, -2).trim();
  }
  if (text.startsWith("\\(") && text.endsWith("\\)") && text.length >= 4) {
    return text.slice(2, -2).trim();
  }
  return text;
}

function formatInlineEquationDisplay(equation = "", formatRaw = "tex") {
  const format = normalizeInlineEquationFormat(formatRaw);
  const text = String(equation || "").trim() || DEFAULT_INLINE_EQUATION;
  if (format === "latex") return `$$${text}$$`;
  if (format === "mathml") return text;
  return `\\(${text}\\)`;
}

function hasEquationExtension(path = "") {
  const clean = String(path || "").split(/[?#]/)[0];
  const ext = (clean.split(".").pop() || "").toLowerCase();
  return EQUATION_EXTENSIONS.has(ext);
}

function getSelectedEquationFilePath() {
  const candidates = [
    window.filePath,
    window.NodevisionState?.activeEditorFilePath,
    window.selectedFilePath,
    window.currentActiveFilePath,
    window.NodevisionState?.selectedFile,
  ].filter(Boolean);
  return candidates.find((path) => hasEquationExtension(path)) || null;
}

function getLinkedEquationPathFromSelection() {
  const sel = window.getSelection();
  const node = sel?.anchorNode || sel?.focusNode;
  const el = (node instanceof Element ? node : node?.parentElement) || null;
  const activeEl = document.activeElement instanceof Element ? document.activeElement : null;
  const link = el?.closest?.("[data-nv-linked-path], a[href]") ||
    activeEl?.closest?.("[data-nv-linked-path], a[href]");
  if (!link) return null;

  const candidate = (link.getAttribute("data-nv-linked-path") || link.getAttribute("href") || "").trim();
  if (!candidate || !hasEquationExtension(candidate)) return null;
  return candidate;
}

function getSelectedInlineEquationElement() {
  const sel = window.getSelection();
  const node = sel?.anchorNode || sel?.focusNode;
  const el = (node instanceof Element ? node : node?.parentElement) || null;
  const activeEl = document.activeElement instanceof Element ? document.activeElement : null;
  const target = el?.closest?.(INLINE_EQUATION_SELECTOR) ||
    activeEl?.closest?.(INLINE_EQUATION_SELECTOR);
  return target instanceof Element ? target : null;
}

function findAnyInlineEquationInDocument() {
  const scopes = [document.querySelector("#wysiwyg"), document.body].filter(Boolean);
  for (const scope of scopes) {
    const inlineEquations = Array.from(scope.querySelectorAll(INLINE_EQUATION_SELECTOR));
    if (inlineEquations.length === 1) {
      return inlineEquations[0];
    }
  }
  return null;
}

function readInlineEquationValue(el) {
  if (!(el instanceof Element)) return DEFAULT_INLINE_EQUATION;
  const fromData = String(el.getAttribute("data-nv-inline-equation") || "").trim();
  if (fromData) return stripInlineEquationDelimiters(fromData);
  const fromText = String(el.textContent || "").trim();
  if (fromText) return stripInlineEquationDelimiters(fromText);
  return DEFAULT_INLINE_EQUATION;
}

function writeInlineEquationValue(el, value, formatRaw = "") {
  if (!(el instanceof Element)) return;
  const format = normalizeInlineEquationFormat(formatRaw || el.getAttribute("data-nv-inline-equation-format") || "");
  const equation = String(value || "").trim() || DEFAULT_INLINE_EQUATION;
  el.setAttribute("data-nv-inline-equation-format", format);
  el.setAttribute("data-nv-inline-equation", equation);
  el.textContent = formatInlineEquationDisplay(equation, format);
}

function findAnyLinkedEquationInDocument() {
  const scopes = [
    document.querySelector("#wysiwyg"),
    document.body,
  ].filter(Boolean);

  for (const scope of scopes) {
    const links = Array.from(scope.querySelectorAll("[data-nv-linked-path], a[href]"));
    const equationLinks = links.filter((el) => {
      const candidate = (el.getAttribute("data-nv-linked-path") || el.getAttribute("href") || "").trim();
      return hasEquationExtension(candidate);
    });
    if (equationLinks.length === 1) {
      const el = equationLinks[0];
      return (el.getAttribute("data-nv-linked-path") || el.getAttribute("href") || "").trim();
    }
  }

  return null;
}

function normalizeEquationPath(path = "") {
  const raw = String(path || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.href);
    if (url.origin === window.location.origin && url.pathname.startsWith("/Notebook/")) {
      return url.pathname;
    }
  } catch {
    // Not a URL; fall through.
  }
  if (raw.startsWith("Notebook/")) return `/${raw}`;
  return raw;
}

async function openEquationEditorForPath(filePath) {
  const safeId = btoa(filePath).replace(/[^a-z0-9]/gi, "-");
  const instanceId = `nv-equation-editor-${safeId}`;
  const existing = document.querySelector(`.panel[data-instance-id=\"${instanceId}\"]`);
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  const panelInst = await createPanelDOM(
    "GraphicalEditor",
    instanceId,
    "EditorPanel",
    { filePath, displayName: `Edit Equation: ${filePath}` }
  );

  document.body.appendChild(panelInst.panel);
  panelInst.panel.classList.remove("docked");
  panelInst.panel.classList.add("undocked");
  panelInst.panel.style.width = "min(760px, 94vw)";
  panelInst.panel.style.height = "min(560px, 90vh)";
  panelInst.panel.style.left = `${Math.max(20, Math.round(window.innerWidth * 0.18))}px`;
  panelInst.panel.style.top = `${Math.max(20, Math.round(window.innerHeight * 0.12))}px`;
  panelInst.panel.style.zIndex = "23010";
  panelInst.panel.style.pointerEvents = "auto";

  if (panelInst.dockBtn && typeof panelInst.dockBtn.click === "function") {
    try {
      panelInst.dockBtn.dispatchEvent(new MouseEvent("click", { bubbles: false, cancelable: true, view: window }));
    } catch {
      panelInst.dockBtn.click();
    }
  }
}

export default async function editEquationHere() {
  const selectedInlineEquation = getSelectedInlineEquationElement();
  if (selectedInlineEquation) {
    const current = readInlineEquationValue(selectedInlineEquation);
    const edited = prompt("Edit equation:", current);
    if (edited !== null) {
      const format = selectedInlineEquation.getAttribute("data-nv-inline-equation-format") || "tex";
      writeInlineEquationValue(selectedInlineEquation, edited, format);
    }
    return;
  }

  const singleInlineEquation = findAnyInlineEquationInDocument();
  if (singleInlineEquation) {
    const current = readInlineEquationValue(singleInlineEquation);
    const edited = prompt("Edit equation:", current);
    if (edited !== null) {
      const format = singleInlineEquation.getAttribute("data-nv-inline-equation-format") || "tex";
      writeInlineEquationValue(singleInlineEquation, edited, format);
    }
    return;
  }

  const linkedFromSelection = getLinkedEquationPathFromSelection();
  if (linkedFromSelection) {
    await openEquationEditorForPath(normalizeEquationPath(linkedFromSelection));
    return;
  }

  const linkedFromScan = findAnyLinkedEquationInDocument();
  if (linkedFromScan) {
    await openEquationEditorForPath(normalizeEquationPath(linkedFromScan));
    return;
  }

  const filePath = getSelectedEquationFilePath();
  if (filePath) {
    await openEquationEditorForPath(normalizeEquationPath(filePath));
    return;
  }

  console.warn("editEquationHere: no equation link or equation file selected.");
  alert("Select an equation link in the HTML editor or choose a .tex/.latex file first, then try again.");
}
