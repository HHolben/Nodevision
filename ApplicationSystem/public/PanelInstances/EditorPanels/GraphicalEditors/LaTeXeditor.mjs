// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/LaTeXeditor.mjs
// This editor authors LaTeX equations with live preview. The toolbar inserts shared equation snippets into the active text area.

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
import { applyEquationActionToInput } from "/Equation/EquationExpressionEditor.mjs";

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

function handleEquationToolbarAction(actionKey) {
  const handled = applyEquationActionToInput(textareaRef, actionKey, { dialect: "latex" });
  if (!handled) console.warn("Unhandled equation toolbar action:", actionKey);
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
