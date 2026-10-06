// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditorParts/ModuleState.mjs
// This module implements module state operations for CodeEditor, preserving the existing document and instance ownership contracts.

import { markEditorClean } from "./ShowCommonVarOverlay.mjs";
import { setStatus } from "/StatusBar.mjs";
import { toNotebookAssetUrl, normalizeNotebookRelativePath } from "/utils/notebookPath.mjs";

export const moduleState = {
  codeEditorFileSavedListenerInstalled: false,
  editorInstance: null,
  editorContainer: null,
  editorInstanceContainer: null,
  lastEditedPath: null,
  currentLoadedEncoding: "utf8",
  currentLoadedBom: false,
  currentLoadedIsBinary: false,
  currentLoadedFileFormat: "text",
  currentLoadedNbtWasGzip: false,
  currentNbtTagPath: "/",
  nbtTagContextListeners: new Set(),
  previewOutputEl: null,
  previewStatusEl: null,
  commonVarOverlay: null,
  commonVarData: [],
  savedVersionId: null,
  unsavedPromptEl: null,
  unsavedPromptOpen: false,
  editorLoadRequestId: 0,
  pendingEditedPath: null,
  codeEditorLiveCleanup: null
};

export function handleCodeEditorFileSaved(evt) {
  const savedPath = evt?.detail?.filePath;
  if (!savedPath || savedPath !== window.__nvCodeEditorActivePath) return;
  markEditorClean();
}

export function installCodeEditorFileSavedListener() {
  if (moduleState.codeEditorFileSavedListenerInstalled) return;
  window.addEventListener("nodevision-file-saved", handleCodeEditorFileSaved);
  moduleState.codeEditorFileSavedListenerInstalled = true;
}

export const CODE_EDITOR_LIVE_PROVIDER_ID = "nodevision-code-editor";

export const CODE_EDITOR_MIN_FONT_SIZE = 8;

export const CODE_EDITOR_MAX_FONT_SIZE = 40;

export const CODE_EDITOR_FONT_SIZE_STEP = 1;

export const CODE_EDITOR_DEFAULT_FONT_SIZE_FALLBACK = 14;

export const TAG_END = 0;

export const TAG_BYTE = 1;

export const TAG_SHORT = 2;

export const TAG_INT = 3;

export const TAG_LONG = 4;

export const TAG_FLOAT = 5;

export const TAG_DOUBLE = 6;

export const TAG_BYTE_ARRAY = 7;

export const TAG_STRING = 8;

export const TAG_LIST = 9;

export const TAG_COMPOUND = 10;

export const TAG_INT_ARRAY = 11;

export const TAG_LONG_ARRAY = 12;

export const NBT_TAG_NAME_BY_ID = Object.freeze({
  [TAG_END]: "End",
  [TAG_BYTE]: "Byte",
  [TAG_SHORT]: "Short",
  [TAG_INT]: "Int",
  [TAG_LONG]: "Long",
  [TAG_FLOAT]: "Float",
  [TAG_DOUBLE]: "Double",
  [TAG_BYTE_ARRAY]: "Byte_Array",
  [TAG_STRING]: "String",
  [TAG_LIST]: "List",
  [TAG_COMPOUND]: "Compound",
  [TAG_INT_ARRAY]: "Int_Array",
  [TAG_LONG_ARRAY]: "Long_Array",
});

export const NBT_TAG_ID_BY_NAME = Object.freeze({
  end: TAG_END,
  byte: TAG_BYTE,
  short: TAG_SHORT,
  int: TAG_INT,
  integer: TAG_INT,
  long: TAG_LONG,
  float: TAG_FLOAT,
  double: TAG_DOUBLE,
  bytearray: TAG_BYTE_ARRAY,
  string: TAG_STRING,
  list: TAG_LIST,
  compound: TAG_COMPOUND,
  intarray: TAG_INT_ARRAY,
  integerarray: TAG_INT_ARRAY,
  longarray: TAG_LONG_ARRAY,
});

export function isNbtFilePath(filePath) {
  return String(filePath || "").trim().replace(/[?#].*$/, "").toLowerCase().endsWith(".nbt");
}

export function normalizeEditorPath(filePath) {
  return String(filePath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "");
}

export function isLatestEditorLoad(requestId, filePath) {
  return requestId === moduleState.editorLoadRequestId && normalizeEditorPath(moduleState.pendingEditedPath) === normalizeEditorPath(filePath);
}

export function clampCodeEditorFontSize(value, fallback = CODE_EDITOR_DEFAULT_FONT_SIZE_FALLBACK) {
  const n = Number(value);
  const base = Number.isFinite(n) ? n : fallback;
  return Math.max(CODE_EDITOR_MIN_FONT_SIZE, Math.min(CODE_EDITOR_MAX_FONT_SIZE, Math.round(base)));
}

export function codeEditorFontSize(editor, session = null) {
  if (!editor) return clampCodeEditorFontSize(session?.fontSize);
  try {
    const option = monaco?.editor?.EditorOption?.fontSize;
    if (option !== undefined && typeof editor.getOption === "function") {
      return clampCodeEditorFontSize(editor.getOption(option), session?.fontSize);
    }
  } catch {
    return clampCodeEditorFontSize(session?.fontSize);
  }
  return clampCodeEditorFontSize(session?.fontSize);
}

export function applyCodeEditorFontSize(editor, size, session = null) {
  if (!editor?.updateOptions) return false;
  const nextSize = clampCodeEditorFontSize(size, session?.defaultFontSize);
  editor.updateOptions({ fontSize: nextSize });
  if (session) session.fontSize = nextSize;
  window.requestAnimationFrame?.(() => editor.layout?.());
  setStatus("Code editor", "Font size " + nextSize + "px");
  return true;
}

export function zoomCodeEditorFont(editor, direction, session = null) {
  if (!editor?.updateOptions) return false;
  const currentSize = codeEditorFontSize(editor, session);
  const defaultSize = clampCodeEditorFontSize(session?.defaultFontSize, CODE_EDITOR_DEFAULT_FONT_SIZE_FALLBACK);
  const nextSize = direction === "reset"
    ? defaultSize
    : currentSize + (direction === "in" ? CODE_EDITOR_FONT_SIZE_STEP : -CODE_EDITOR_FONT_SIZE_STEP);
  return applyCodeEditorFontSize(editor, nextSize, session);
}

export function nbtNotebookUrl(filePath) {
  return toNotebookAssetUrl(normalizeNotebookRelativePath(filePath));
}

export function normalizeTagName(name) {
  return String(name || "")
    .trim()
    .replace(/[\s_-]+/g, "")
    .toLowerCase();
}
