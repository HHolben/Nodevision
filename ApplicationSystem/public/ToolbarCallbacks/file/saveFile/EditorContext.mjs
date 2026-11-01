// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/saveFile/EditorContext.mjs
// This module resolves the editor context and path ownership used by native save commands. It also finalizes inline image sessions before parent documents are serialized, preserving the existing save guards and editor precedence.

import { getFileExtension, isRasterContext, sameSavePath } from "./utils.mjs";

// Resolve editor ownership without writing to a different document.
export function firstSavePath(...paths) {
  return paths.find((path) => String(path || "").trim()) || "";
}

export function refuseMismatchedEditorSave(editorLabel, editorPath, savePath) {
  if (!editorPath || !savePath || sameSavePath(editorPath, savePath)) return false;
  console.error("[saveFile] Refusing to save " + editorLabel + " buffer into a different path.", {
    editorPath,
    savePath,
  });
  return true;
}

export function markdownEditorPath() {
  return firstSavePath(window.__nvMarkdownActivePath, window.__nvCodeEditorActivePath);
}

export function activeHtmlEditorContext(preferredPath = "") {
  const activeCellContext = window.activeCell?.__nvHtmlEditorContext || null;
  const focusedCellContext = document.activeElement?.closest?.(".panel-cell")?.__nvHtmlEditorContext || null;
  const globalContext = window.__nvActiveHtmlEditorContext || null;
  for (const context of [activeCellContext, focusedCellContext, globalContext]) {
    if (context?.kind !== "html" || !context.filePath) continue;
    if (preferredPath && !sameSavePath(preferredPath, context.filePath)) continue;
    if (typeof context.activate === "function") context.activate();
    return context;
  }
  return null;
}

export function htmlEditorPath() {
  return firstSavePath(
    activeHtmlEditorContext()?.filePath,
    window.__nvWysiwygActivePath,
    window.__nvHtmlEditorActivePath,
  );
}

export function svgEditorPath() {
  return firstSavePath(window.__nvSvgEditorActivePath);
}

export function pdfEditorPath() {
  return firstSavePath(window.__nvPdfEditorActivePath);
}

// Capture editor state before an inline image session changes the active tools.
export function readEditorSaveContext(filePath, activeHtmlContext) {
  const mode = window.NodevisionState?.currentMode || window.currentMode || "";
  const inGraphicalEditor =
    window.NodevisionState?.activePanelType === "GraphicalEditor" ||
    !!document.getElementById("graphical-editor");
  const svgEditorElement =
    document.getElementById("svg-editor-root") ||
    document.getElementById("svg-editor");
  const activeSvgPath = svgEditorPath();
  const activePdfPath = pdfEditorPath();
  const activeGifPath = firstSavePath(window.__nvGifEditorActivePath, window.GIFEditorContext?.filePath);
  const inSvgEditor =
    !!svgEditorElement &&
    (String(mode).toLowerCase().includes("svg") ||
      (activeSvgPath && sameSavePath(activeSvgPath, filePath)));
  const inMarkdownEditor =
    mode === "MDediting" ||
    !!document.getElementById("markdown-editor") ||
    typeof window.getEditorMarkdown === "function";
  const inWysiwygEditor =
    mode === "HTMLediting" ||
    mode === "CSVediting" ||
    !!document.getElementById("wysiwyg") ||
    typeof window.getEditorHTML === "function";
  const inMidiEditor = mode === "MIDIediting";
  const inKMLEditor = mode === "KMLeditorMode" || mode === "KMLeditingMode";
  const fileExt = getFileExtension(filePath);
  const { canSaveRasterCanvas } = isRasterContext({ mode, fileExt, inWysiwygEditor });

  return {
    filePath, activeHtmlContext, mode, inGraphicalEditor, svgEditorElement,
    activePdfPath, activeGifPath, inSvgEditor, inMarkdownEditor,
    inWysiwygEditor, inMidiEditor, inKMLEditor, fileExt, canSaveRasterCanvas,
  };
}

// Complete embedded image edits before serializing their parent document.
export async function finishInlineImageSave() {
  if (window.NodevisionState?.htmlImageEditingInline) {
    if (typeof window.HTMLWysiwygTools?.finishInlineImageEditor !== "function") {
      throw new Error("Inline image editor is active but cannot be finalized for document save.");
    }
    try {
      await window.HTMLWysiwygTools.finishInlineImageEditor();
    } catch (inlineErr) {
      console.warn("[saveFile] Failed to finalize inline image editor before save:", inlineErr);
      throw inlineErr;
    }
    if (window.NodevisionState?.htmlImageEditingInline) {
      throw new Error("Inline image editor is still active; aborting save to avoid corrupting document markup.");
    }
  }
}
