// Nodevision/ApplicationSystem/public/Commands/handlers/EditorCommands.mjs
// This module adapts editor commands to Nodevision's current editor bridges and save callback.

import { emitNodevisionEvent } from "../NodevisionEventRegistry.mjs";

function currentEditorPath() {
  return window.__nvCodeEditorActivePath || window.NodevisionState?.activeEditorFilePath || window.currentActiveFilePath || "";
}

function dispatchEditorOpen(path) {
  window.selectedFilePath = path;
  window.currentActiveFilePath = path;
  window.dispatchEvent(new CustomEvent("toolbarAction", { detail: { id: "CodeEditor", type: "EditorPanel", replaceActive: false } }));
}

export async function openEditorCommand([path]) {
  if (typeof window.openCodeEditor === "function") await window.openCodeEditor(path);
  else dispatchEditorOpen(path);
  emitNodevisionEvent("editor.opened", { path });
  return { ok: true, path };
}

export async function saveEditorCommand() {
  const path = currentEditorPath();
  const mod = await import("/ToolbarCallbacks/file/saveFile.mjs");
  const saved = await mod.default({ path });
  if (saved) emitNodevisionEvent("editor.saved", { path });
  return { ok: Boolean(saved), path };
}

export function currentEditorFileCommand() {
  const path = currentEditorPath();
  return { path, hasFile: Boolean(path) };
}

export function getEditorContentCommand() {
  if (window.monacoEditor?.getValue) return window.monacoEditor.getValue();
  if (typeof window.getEditorMarkdown === "function") return window.getEditorMarkdown();
  if (typeof window.getEditorHTML === "function") return window.getEditorHTML();
  return "";
}

export function setEditorContentCommand([content]) {
  if (window.monacoEditor?.setValue) {
    window.monacoEditor.setValue(content);
    return { ok: true, editor: "monaco" };
  }
  if (typeof window.setEditorMarkdown === "function") {
    window.setEditorMarkdown(content);
    return { ok: true, editor: "markdown" };
  }
  if (typeof window.setEditorHTML === "function") {
    window.setEditorHTML(content);
    return { ok: true, editor: "html" };
  }
  return { ok: false, reason: "No active editor content bridge is available." };
}
