// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/editEquationHere.mjs
// This callback opens or updates the selected equation in the HTML editor, including inline equation spans and linked tex, latex, or MathML files.

import { createPanelDOM } from "/panels/panelFactory.mjs";
import { findElementInSelection, findSelectedInlineEquationElement, findSingleInlineEquationElement, readInlineEquationValue, writeInlineEquationValue } from "/Equation/HtmlInlineEquation.mjs";

const EQUATION_EXTENSIONS = new Set(["tex", "latex", "mathml", "mml"]);
const LINKED_EQUATION_SELECTOR = "[data-nv-linked-path], a[href]";

// === Equation Path Lookup ===
function hasEquationExtension(path = "") {
  const clean = String(path || "").split(/[?#]/)[0];
  const ext = (clean.split(".").pop() || "").toLowerCase();
  return EQUATION_EXTENSIONS.has(ext);
}

function normalizeEquationPath(path = "") {
  const raw = String(path || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.href);
    if (url.origin === window.location.origin && url.pathname.startsWith("/Notebook/")) return url.pathname;
  } catch {
    // Keep path-like values that are not URLs.
  }
  if (raw.startsWith("Notebook/")) return `/${raw}`;
  return raw;
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

function equationPathFromLink(el) {
  const candidate = (el?.getAttribute?.("data-nv-linked-path") || el?.getAttribute?.("href") || "").trim();
  return candidate && hasEquationExtension(candidate) ? candidate : null;
}

function getLinkedEquationPathFromSelection() {
  const scope = document.querySelector("#wysiwyg") || document.body || document;
  const link = findElementInSelection(LINKED_EQUATION_SELECTOR, { scope });
  return equationPathFromLink(link);
}

function findSingleLinkedEquationInDocument() {
  const scopes = [document.querySelector("#wysiwyg"), document.body].filter(Boolean);
  for (const scope of scopes) {
    const links = Array.from(scope.querySelectorAll(LINKED_EQUATION_SELECTOR));
    const equationLinks = links.map(equationPathFromLink).filter(Boolean);
    if (equationLinks.length === 1) return equationLinks[0];
  }
  return null;
}

// === Inline Equation Editing ===
function editInlineEquation(el) {
  const current = readInlineEquationValue(el);
  const edited = prompt("Edit equation:", current);
  if (edited === null) return;
  const format = el.getAttribute("data-nv-inline-equation-format") || "tex";
  writeInlineEquationValue(el, edited, format);
  el.closest?.("#wysiwyg")?.dispatchEvent(new Event("input", { bubbles: true }));
}

function getInlineEquationTarget() {
  const scope = document.querySelector("#wysiwyg") || document.body || document;
  return findSelectedInlineEquationElement(scope) || findSingleInlineEquationElement(scope);
}

// === Panel Opening ===
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

// === Toolbar Callback ===
export default async function editEquationHere() {
  const inlineEquation = getInlineEquationTarget();
  if (inlineEquation) {
    editInlineEquation(inlineEquation);
    return;
  }

  const linkedFromSelection = getLinkedEquationPathFromSelection();
  if (linkedFromSelection) {
    await openEquationEditorForPath(normalizeEquationPath(linkedFromSelection));
    return;
  }

  const linkedFromScan = findSingleLinkedEquationInDocument();
  if (linkedFromScan) {
    await openEquationEditorForPath(normalizeEquationPath(linkedFromScan));
    return;
  }

  const filePath = getSelectedEquationFilePath();
  if (filePath) {
    await openEquationEditorForPath(normalizeEquationPath(filePath));
    return;
  }

  console.warn("editEquationHere: no inline equation, equation link, or equation file selected.");
  alert("Select or highlight an inline equation, select an equation link in the HTML editor, or choose a .tex/.latex file first, then try again.");
}
