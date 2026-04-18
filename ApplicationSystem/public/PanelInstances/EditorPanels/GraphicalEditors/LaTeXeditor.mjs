// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/LaTeXeditor.mjs
// Graphical editor for authoring LaTeX equations with live preview and toolbar-driven snippets.

import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fetchText,
  saveText,
  escapeHTML,
  countWords,
} from "./FamilyEditorCommon.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { setWordCount } from "/StatusBar.mjs";

const EQUATION_MODE = "EquationEditing";
let textareaRef = null;
let previewRef = null;
let filePathRef = null;
let mathJaxReady = null;

function ensureMathJax() {
  if (window.MathJax?.typesetPromise) return Promise.resolve();
  if (mathJaxReady) return mathJaxReady;

  mathJaxReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return mathJaxReady.catch(() => {});
}

function renderPreview(latex = "") {
  if (!previewRef) return;
  previewRef.innerHTML = latex.trim()
    ? `\\(${escapeHTML(latex)}\\)`
    : "<span style=\"color:#666;\">Type LaTeX to preview</span>";

  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise([previewRef]).catch(() => {});
  } else {
    ensureMathJax().then(() => window.MathJax?.typesetPromise?.([previewRef])).catch(() => {});
  }
}

function markDirty() {
  if (window.NodevisionState?.fileIsDirty) return;
  updateToolbarState({ fileIsDirty: true });
}

function insertSnippet(snippet = "", caretHint = null) {
  if (!textareaRef) return;
  const start = textareaRef.selectionStart ?? textareaRef.value.length;
  const end = textareaRef.selectionEnd ?? textareaRef.value.length;
  const before = textareaRef.value.slice(0, start);
  const after = textareaRef.value.slice(end);
  textareaRef.value = `${before}${snippet}${after}`;

  let nextPos = start + snippet.length;
  if (typeof caretHint === "number") {
    nextPos = start + caretHint;
  } else if (typeof caretHint === "string") {
    const idx = snippet.indexOf(caretHint);
    if (idx >= 0) {
      nextPos = start + idx + caretHint.length;
    }
  }
  textareaRef.selectionStart = textareaRef.selectionEnd = Math.min(textareaRef.value.length, nextPos);
  textareaRef.focus();
  handleInput();
}

function handleEquationToolbarAction(actionKey) {
  switch (actionKey) {
    case "eqInsertIntegrand":
      insertSnippet("\\int ");
      break;
    case "eqInsertDefiniteIntegral":
      insertSnippet("\\int_{a}^{b} f(x)\\,dx", "f(x)");
      break;
    case "eqInsertDoubleIntegral":
      insertSnippet("\\iint_{D} f(x,y)\\,dA", "f(x,y)");
      break;
    case "eqInsertLimit":
      insertSnippet("\\lim_{x \\to \\infty} ");
      break;
    case "eqInsertSummation":
      insertSnippet("\\sum_{i=0}^{n} ");
      break;
    case "eqInsertProduct":
      insertSnippet("\\prod_{i=1}^{n} ");
      break;
    case "eqInsertFraction":
      insertSnippet("\\frac{ }{ }", "{ ");
      break;
    case "eqInsertDisplayFraction":
      insertSnippet("\\dfrac{ }{ }", "{ ");
      break;
    case "eqInsertMatrix":
      insertSnippet("\\begin{bmatrix}a_{11} & a_{12} \\\\ a_{21} & a_{22}\\end{bmatrix}", "a_{11}");
      break;
    case "eqInsertMatrix3x3":
      insertSnippet("\\begin{bmatrix}a_{11} & a_{12} & a_{13} \\\\ a_{21} & a_{22} & a_{23} \\\\ a_{31} & a_{32} & a_{33}\\end{bmatrix}", "a_{11}");
      break;
    case "eqInsertMatrixGeneral":
      insertSnippet("\\begin{bmatrix}a_{11} & \\cdots & a_{1n} \\\\ \\vdots & \\ddots & \\vdots \\\\ a_{m1} & \\cdots & a_{mn}\\end{bmatrix}", "a_{11}");
      break;
    case "eqInsertFactorial":
      insertSnippet("n!");
      break;
    case "eqInsertSuperscript":
      insertSnippet("^{ }", "{ ");
      break;
    case "eqInsertSubscript":
      insertSnippet("_{ }", "{ ");
      break;
    case "eqInsertHat":
      insertSnippet("\\hat{ }", "{ ");
      break;
    case "eqInsertDotProduct":
      insertSnippet("\\cdot ");
      break;
    case "eqInsertCrossProduct":
      insertSnippet("\\times ");
      break;
    case "eqInsertSymbolAlpha":
      insertSnippet("\\alpha ");
      break;
    case "eqInsertSymbolBeta":
      insertSnippet("\\beta ");
      break;
    case "eqInsertSymbolGamma":
      insertSnippet("\\gamma ");
      break;
    case "eqInsertSymbolTheta":
      insertSnippet("\\theta ");
      break;
    case "eqInsertSymbolPi":
      insertSnippet("\\pi ");
      break;
    case "eqInsertSymbolSigma":
      insertSnippet("\\sigma ");
      break;
    case "eqInsertSymbolInfinity":
      insertSnippet("\\infty ");
      break;
    case "eqInsertSymbolPlusMinus":
      insertSnippet("\\pm ");
      break;
    default:
      console.warn("Unhandled equation toolbar action:", actionKey);
      break;
  }
}

function handleInput() {
  if (!textareaRef) return;
  const value = textareaRef.value || "";
  renderPreview(value);
  setWordCount(countWords(value));
  markDirty();
}

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState(EQUATION_MODE);
  filePathRef = filePath;

  const { body, status } = createBaseLayout(container, `LaTeX Equation — ${filePath}`);

  const editorWrapper = document.createElement("div");
  editorWrapper.style.cssText = "display:flex;gap:12px;height:100%;";

  textareaRef = document.createElement("textarea");
  textareaRef.id = "latex-equation-editor";
  textareaRef.style.cssText = [
    "flex:1",
    "min-height:260px",
    "resize:none",
    "padding:12px",
    "box-sizing:border-box",
    "font:14px/1.6 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
    "border:1px solid #c9c9c9",
    "border-radius:8px",
    "background:#fff",
    "color:#111",
  ].join(";");

  previewRef = document.createElement("div");
  previewRef.id = "latex-preview";
  previewRef.style.cssText = [
    "flex:1",
    "min-height:260px",
    "padding:12px",
    "box-sizing:border-box",
    "border:1px solid #c9c9c9",
    "border-radius:8px",
    "background:#fafafa",
    "overflow:auto",
    "font:14px/1.6 'Times New Roman', serif",
  ].join(";");
  previewRef.setAttribute("aria-live", "polite");

  editorWrapper.appendChild(textareaRef);
  editorWrapper.appendChild(previewRef);
  body.appendChild(editorWrapper);

  textareaRef.addEventListener("input", handleInput);

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activeActionHandler = handleEquationToolbarAction;

  updateToolbarState({
    currentMode: EQUATION_MODE,
    activeActionHandler: handleEquationToolbarAction,
    selectedFile: filePath,
    fileIsDirty: false,
  });

  try {
    const text = await fetchText(filePath);
    textareaRef.value = text;
    status.textContent = `Loaded (${text.length.toLocaleString()} chars)`;
  } catch {
    textareaRef.value = "";
    status.textContent = "New equation file";
  }

  renderPreview(textareaRef.value);
  setWordCount(countWords(textareaRef.value));

  window.getEditorMarkdown = () => textareaRef?.value || "";
  window.saveMDFile = async (path = filePathRef) => {
    await saveText(path, textareaRef?.value || "");
    updateToolbarState({ fileIsDirty: false });
  };
  window.saveWYSIWYGFile = window.saveMDFile;
}
