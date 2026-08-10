// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/MDeditor.mjs
// This file defines browser-side MDeditor logic for the Nodevision UI. It renders interface components and handles user interactions.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { countWords } from "./FamilyEditorCommon.mjs";
import { setWordCount } from "/StatusBar.mjs";
import { recordEditedFile } from "/RecentFiles.mjs";
import { applyMarkdownRenderClass, ensureMarkdownStyles, renderMarkdown } from "/utils/markdownRenderer.mjs";
import { serializeMarkdownFromRenderedElement } from "./MarkdownRenderedEditorSerialization.mjs";

function isRenderedEditorFocused(editor) {
  const active = document.activeElement;
  if (active === editor || editor.contains(active)) return true;
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0) return false;
  return editor.contains(selection.getRangeAt(0).commonAncestorContainer);
}

function runRenderedEditorCommand(editor, command) {
  editor.focus();
  document.execCommand(command, false, null);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function registerMDFallbackHotkeys(editor, filePath) {
  const handler = (event) => {
    if (!isRenderedEditorFocused(editor)) return;

    const platform = String(window.navigator?.platform || "").toUpperCase();
    const ctrlOrCmd = platform.includes("MAC") ? event.metaKey : event.ctrlKey;
    if (!ctrlOrCmd || event.altKey) return;

    const key = event.key?.toLowerCase?.();
    if (key === "s" && !event.shiftKey) {
      event.preventDefault();
      window.saveMDFile?.(filePath);
      return;
    }

    const commands = { b: "bold", i: "italic", u: "underline" };
    if (commands[key] && !event.shiftKey) {
      event.preventDefault();
      runRenderedEditorCommand(editor, commands[key]);
      return;
    }

    if (key === "z" || key === "y") {
      event.preventDefault();
      const redo = key === "y" || event.shiftKey;
      runRenderedEditorCommand(editor, redo ? "redo" : "undo");
    }
  };

  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
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
    "padding:0",
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
  sourcePane.style.cssText = "display:none;";
  const textarea = document.createElement("textarea");
  textarea.id = "markdown-source-buffer";
  textarea.hidden = true;
  sourcePane.appendChild(textarea);

  const previewPane = document.createElement("section");
  previewPane.style.cssText = "display:flex;flex:1 1 100%;min-width:0;min-height:0;flex-direction:column;";

  const preview = document.createElement("div");
  applyMarkdownRenderClass(preview);
  preview.id = "markdown-editor";
  preview.dataset.nodevisionMarkdownEditor = "true";
  preview.contentEditable = "true";
  preview.spellcheck = true;
  preview.setAttribute("role", "textbox");
  preview.setAttribute("aria-multiline", "true");
  preview.setAttribute("aria-label", "Markdown document editor");
  preview.style.cssText = [
    "flex:1 1 auto",
    "width:100%",
    "max-width:920px",
    "min-height:100%",
    "margin:0 auto",
    "overflow:visible",
    "padding:18px",
    "box-sizing:border-box",
    "outline:none",
    "background:transparent",
    "caret-color:var(--nv-markdown-text, #1f2937)",
  ].join(";");
  previewPane.appendChild(preview);

  editorSurface.append(sourcePane, previewPane);

  const renderPreviewNow = () => {
    preview.innerHTML = renderMarkdown(textarea.value, { filePath });
    if (!preview.innerHTML.trim()) preview.innerHTML = "<p><br></p>";
  };

  const updateCount = () => {
    const currentWordCount = countWords(preview.innerText || textarea.value);
    setWordCount(currentWordCount);
  };

  const syncRenderedEditorToSource = () => {
    textarea.value = serializeMarkdownFromRenderedElement(preview);
    recordEditedFile(filePath);
    updateCount();
  };

  preview.addEventListener("input", syncRenderedEditorToSource);
  preview.addEventListener("click", (event) => {
    if (event.target.closest?.("a")) event.preventDefault();
  });

  try {
    const res = await fetch(`/Notebook/${filePath}`);
    if (!res.ok) throw new Error(res.statusText);

    const mdText = await res.text();
    textarea.value = mdText;
    renderPreviewNow();
    updateCount();

    window.getEditorMarkdown = () => textarea.value;

    window.setEditorMarkdown = (md) => {
      textarea.value = md || "";
      renderPreviewNow();
      updateCount();
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
  }

  const cleanupHotkeys = registerMDFallbackHotkeys(preview, filePath);
  container.__nvActiveEditorCleanup = () => {
    cleanupHotkeys();
    if (window.__nvMarkdownActivePath === filePath) window.__nvMarkdownActivePath = null;
  };
}
