// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PhpEditorFiles.mjs
// This module shares notebook paths, text persistence and legacy save hooks for the PHP editor.


export const SAVE_ENDPOINT = "/api/save";

export const NOTEBOOK_PREFIX = "/Notebook/";

export function normalizePath(filePath = "") {
  const text = String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (text.startsWith("Notebook/")) return text.slice("Notebook/".length);
  return text;
}

export function toNotebookUrl(filePath = "") {
  return `${NOTEBOOK_PREFIX}${normalizePath(filePath)}`;
}

export function notebookDir(filePath = "") {
  const cleaned = normalizePath(filePath);
  const idx = cleaned.lastIndexOf("/");
  if (idx === -1) return "";
  return cleaned.slice(0, idx);
}

export function buildNotebookBaseHref(filePath = "") {
  const dir = notebookDir(filePath);
  const segments = (dir || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment));
  const pathSegment = segments.length ? `${segments.join("/")}/` : "";
  return `${NOTEBOOK_PREFIX}${pathSegment}`;
}

export async function fetchTextFile(filePath) {
  const res = await fetch(toNotebookUrl(filePath), { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

export async function saveTextFile(filePath, content) {
  const res = await fetch(SAVE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: normalizePath(filePath), content })
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `${res.status} ${res.statusText}`);
  }
  return true;
}

export function bindSaveHooks(state) {
  window.getEditorMarkdown = () => state.code;
  window.setEditorMarkdown = (next) => {
    state.code = String(next || "");
  };
  window.saveMDFile = async (path) => saveTextFile(path || state.filePath, state.code);
}

export function cleanupSaveHooks() {
  try {
    delete window.getEditorMarkdown;
    delete window.setEditorMarkdown;
    delete window.saveMDFile;
  } catch (_) {
    window.getEditorMarkdown = undefined;
    window.setEditorMarkdown = undefined;
    window.saveMDFile = undefined;
  }
}
