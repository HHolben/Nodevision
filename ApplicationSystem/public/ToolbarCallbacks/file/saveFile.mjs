// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/saveFile.mjs
// This file defines browser-side save File logic for the Nodevision UI. It renders interface components and handles user interactions.

import {
  getFileExtension,
  isRasterContext,
  notifyFileSaved,
  resolveFilePath,
  saveRasterCanvas,
  saveViaApi,
} from "./saveFile/utils.mjs";

export default async function saveFile(options = {}) {
  const requestedPath =
    typeof options === "string" ? options : options?.path;
  const filePath = resolveFilePath(requestedPath);
  if (!filePath) {
    console.error("[saveFile] Cannot save: file path is missing.");
    return false;
  }

  const inActiveGameView =
    String(window.activePanel || "").toLowerCase() === "gameview"
    && typeof window.saveVirtualWorldFile === "function";
  if (inActiveGameView) {
    const saved = !!(await window.saveVirtualWorldFile(filePath));
    return saved ? notifyFileSaved(filePath) : false;
  }

  try {
    const mode = window.NodevisionState?.currentMode || window.currentMode || "";
    const inGraphicalEditor =
      window.NodevisionState?.activePanelType === "GraphicalEditor" ||
      !!document.getElementById("graphical-editor");
    const inSvgEditor =
      !!document.getElementById("svg-editor-root") ||
      !!document.getElementById("svg-editor");
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
    const fileExt = getFileExtension(filePath);
    const { canSaveRasterCanvas } = isRasterContext({ mode, fileExt, inWysiwygEditor });

    // Inline image editing embeds raster/SVG editors into HTML/EPUB.
    // Finalize that session first so save targets the parent document,
    // not the temporary inline editor canvas path.
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

    if (mode === "EPUBediting" && typeof window.saveWYSIWYGFile === "function") {
      await window.saveWYSIWYGFile(filePath);
      return notifyFileSaved(filePath);
    }

    // 1) Explicit editor state checks.
    if (canSaveRasterCanvas && (await saveRasterCanvas(filePath))) {
      return notifyFileSaved(filePath);
    }
    if (window.monacoEditor && typeof window.monacoEditor.getValue === "function") {
      const content = window.monacoEditor.getValue();
      await saveViaApi({
        path: filePath,
        content,
        encoding: window.currentFileEncoding || "utf8",
        bom: Boolean(window.currentFileBom),
      });
      return notifyFileSaved(filePath);
    }
    if (typeof window.getEditorMarkdown === "function") {
      const content = window.getEditorMarkdown();
      await saveViaApi({ path: filePath, content });
      return notifyFileSaved(filePath);
    }
    if (inWysiwygEditor && typeof window.getEditorHTML === "function") {
      const content = window.getEditorHTML();
      await saveViaApi({ path: filePath, content });
      return notifyFileSaved(filePath);
    }

    // 2) Editor-specific save hooks (guarded by mode/context).
    if (inMidiEditor && typeof window.saveMIDIFile === "function") {
      await window.saveMIDIFile(filePath);
      return notifyFileSaved(filePath);
    }
    if (inSvgEditor && typeof window.currentSaveSVG === "function") {
      await window.currentSaveSVG(filePath);
      return notifyFileSaved(filePath);
    }
    if ((inMarkdownEditor || inGraphicalEditor) && typeof window.saveMDFile === "function") {
      await window.saveMDFile(filePath);
      return notifyFileSaved(filePath);
    }
    if ((inWysiwygEditor || inGraphicalEditor) && typeof window.saveWYSIWYGFile === "function") {
      await window.saveWYSIWYGFile(filePath);
      return notifyFileSaved(filePath);
    }

    // 3) Generic SVG fallback.
    if (inSvgEditor) {
      const svgEditor =
        document.getElementById("svg-editor-root") ||
        document.getElementById("svg-editor");
      const svgContent =
        svgEditor instanceof SVGElement
          ? new XMLSerializer().serializeToString(svgEditor)
          : svgEditor.outerHTML;
      await saveViaApi({ path: filePath, content: svgContent });
      return notifyFileSaved(filePath);
    }

    // 4) Generic text fallback for simple editors.
    const markdownEl = document.getElementById("markdown-editor");
    if (markdownEl && "value" in markdownEl) {
      await saveViaApi({ path: filePath, content: markdownEl.value });
      return notifyFileSaved(filePath);
    }

    console.error("[saveFile] Cannot save: editor state not recognized.");
    return false;
  } catch (err) {
    console.error(`[saveFile] Failed to save "${filePath}":`, err);
    return false;
  }
}

if (typeof window !== "undefined") {
  window.saveFile = saveFile;
  window.saveCurrentFile = saveFile;
}
