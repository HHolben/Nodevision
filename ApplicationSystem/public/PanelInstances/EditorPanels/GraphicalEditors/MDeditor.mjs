// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/MDeditor.mjs
// This file defines browser-side MDeditor logic for the Nodevision UI. It renders interface components and handles user interactions.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { countWords } from "./FamilyEditorCommon.mjs";
import { setWordCount, setWordsAddedCount } from "/StatusBar.mjs";
import { applyMarkdownRenderClass, ensureMarkdownStyles, renderMarkdown } from "/utils/markdownRenderer.mjs";

function registerMDFallbackHotkeys(textarea, filePath) {
  const surroundSelection = (before, after = before) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);

    textarea.setRangeText(`${before}${selected}${after}`, start, end, "end");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  };

  const handler = (e) => {
    if (document.activeElement !== textarea) return;

    const isMac = window.navigator.platform.toUpperCase().includes("MAC");
    const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
    if (!ctrlOrCmd || e.altKey) return;

    const key = e.key?.toLowerCase?.();
    if (key === "s" && !e.shiftKey) {
      e.preventDefault();
      window.saveMDFile?.(filePath);
      return;
    }
    if (key === "b" && !e.shiftKey) {
      e.preventDefault();
      surroundSelection("**");
      return;
    }
    if (key === "i" && !e.shiftKey) {
      e.preventDefault();
      surroundSelection("*");
      return;
    }
    if (key === "u" && !e.shiftKey) {
      e.preventDefault();
      surroundSelection("<u>", "</u>");
      return;
    }
    if (key === "z") {
      e.preventDefault();
      document.execCommand(e.shiftKey ? "redo" : "undo");
    }
  };

  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}

function createEditorLabel(text) {
  const label = document.createElement("div");
  label.textContent = text;
  label.style.cssText = "font:600 12px/1.4 system-ui,sans-serif;color:#374151;";
  return label;
}

function createLoadError(message) {
  const error = document.createElement("div");
  error.textContent = "Failed to load file: " + String(message || "");
  error.style.cssText = "color:red;padding:12px;";
  return error;
}

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = "MDediting";
  window.NodevisionState.selectedFile = filePath;
  window.NodevisionState.activeEditorFilePath = filePath;
  window.currentActiveFilePath = filePath;
  window.__nvMarkdownActivePath = filePath;
  updateToolbarState({ currentMode: "MDediting", selectedFile: filePath, activeEditorFilePath: filePath });
  ensureMarkdownStyles(document);

  const wrapper = document.createElement("div");
  wrapper.id = "editor-root";
  wrapper.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "height:100%",
    "width:100%",
    "box-sizing:border-box",
    "gap:8px",
    "padding:10px",
    "overflow:hidden",
  ].join(";");
  container.appendChild(wrapper);

  const editorSurface = document.createElement("div");
  editorSurface.style.cssText = [
    "display:flex",
    "flex:1 1 auto",
    "min-height:0",
    "width:100%",
    "gap:12px",
    "align-items:stretch",
    "flex-wrap:wrap",
    "overflow:auto",
  ].join(";");
  wrapper.appendChild(editorSurface);

  const sourcePane = document.createElement("section");
  sourcePane.style.cssText = "display:flex;flex:1 1 360px;min-width:260px;min-height:0;flex-direction:column;gap:6px;";
  sourcePane.appendChild(createEditorLabel("Markdown Source"));

  const textarea = document.createElement("textarea");
  textarea.id = "markdown-editor";
  textarea.dataset.nodevisionMarkdownEditor = "true";
  textarea.style.cssText = [
    "flex:1 1 auto",
    "width:100%",
    "min-height:0",
    "resize:none",
    "padding:12px",
    "box-sizing:border-box",
    "font:14px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    "border:1px solid #c9c9c9",
    "border-radius:6px",
    "background:#fff",
    "color:#111827",
  ].join(";");
  textarea.spellcheck = true;
  sourcePane.appendChild(textarea);

  const previewPane = document.createElement("section");
  previewPane.style.cssText = "display:flex;flex:1 1 360px;min-width:260px;min-height:0;flex-direction:column;gap:6px;";
  previewPane.appendChild(createEditorLabel("Preview"));

  const preview = document.createElement("div");
  applyMarkdownRenderClass(preview);
  preview.setAttribute("aria-label", "Rendered Markdown preview");
  preview.style.cssText = [
    "flex:1 1 auto",
    "min-height:0",
    "overflow:auto",
    "padding:14px",
    "box-sizing:border-box",
    "border:1px solid #d1d5db",
    "border-radius:6px",
    "background:var(--nv-panel-bg, #ffffff)",
  ].join(";");
  previewPane.appendChild(preview);

  editorSurface.append(sourcePane, previewPane);

  let previousWordCount = 0;
  let wordsAddedSinceOpen = 0;
  let previewFrame = 0;

  const renderPreviewNow = () => {
    previewFrame = 0;
    preview.innerHTML = renderMarkdown(textarea.value, { filePath });
  };

  const schedulePreviewUpdate = () => {
    if (previewFrame) cancelAnimationFrame(previewFrame);
    previewFrame = requestAnimationFrame(renderPreviewNow);
  };

  const updateCount = () => {
    const currentWordCount = countWords(textarea.value);
    const addedSinceLastCount = currentWordCount - previousWordCount;
    if (addedSinceLastCount > 0) {
      wordsAddedSinceOpen += addedSinceLastCount;
    }
    previousWordCount = currentWordCount;
    setWordCount(currentWordCount);
    setWordsAddedCount(wordsAddedSinceOpen);
  };

  textarea.addEventListener("input", () => {
    updateCount();
    schedulePreviewUpdate();
  });

  try {
    const res = await fetch(`/Notebook/${filePath}`);
    if (!res.ok) throw new Error(res.statusText);

    const mdText = await res.text();
    textarea.value = mdText;
    previousWordCount = countWords(mdText);
    wordsAddedSinceOpen = 0;
    updateCount();
    renderPreviewNow();

    window.getEditorMarkdown = () => textarea.value;

    window.setEditorMarkdown = (md) => {
      textarea.value = md || "";
      updateCount();
      renderPreviewNow();
    };

    window.saveMDFile = async (path = filePath) => {
      const content = window.getEditorMarkdown();
      await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path || filePath, content }),
      });
      console.log("Saved Markdown file:", path || filePath);
    };
  } catch (err) {
    wrapper.replaceChildren(createLoadError(err?.message || String(err)));
    console.error(err);
    setWordCount(0);
    setWordsAddedCount(0);
  }

  const cleanupHotkeys = registerMDFallbackHotkeys(textarea, filePath);
  container.__nvActiveEditorCleanup = () => {
    cleanupHotkeys();
    if (previewFrame) cancelAnimationFrame(previewFrame);
    if (window.__nvMarkdownActivePath === filePath) window.__nvMarkdownActivePath = null;
  };
}
