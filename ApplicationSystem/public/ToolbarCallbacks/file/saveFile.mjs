// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/saveFile.mjs
// This file defines browser-side save File logic for the Nodevision UI. It renders interface components and handles user interactions.

import {
  getFileExtension,
  isRasterContext,
  notifyFileSaved,
  resolveFilePath,
  sameSavePath,
  saveRasterCanvas,
  saveViaApi,
} from "./saveFile/utils.mjs";

function firstSavePath(...paths) {
  return paths.find((path) => String(path || "").trim()) || "";
}

function refuseMismatchedEditorSave(editorLabel, editorPath, savePath) {
  if (!editorPath || !savePath || sameSavePath(editorPath, savePath)) return false;
  console.error("[saveFile] Refusing to save " + editorLabel + " buffer into a different path.", {
    editorPath,
    savePath,
  });
  return true;
}

function markdownEditorPath() {
  return firstSavePath(window.__nvMarkdownActivePath, window.__nvCodeEditorActivePath);
}

function activeHtmlEditorContext() {
  const activeCellContext = window.activeCell?.__nvHtmlEditorContext || null;
  const focusedCellContext = document.activeElement?.closest?.(".panel-cell")?.__nvHtmlEditorContext || null;
  const globalContext = window.__nvActiveHtmlEditorContext || null;
  for (const context of [activeCellContext, focusedCellContext, globalContext]) {
    if (context?.kind !== "html" || !context.filePath) continue;
    if (typeof context.activate === "function") context.activate();
    return context;
  }
  return null;
}

function htmlEditorPath() {
  return firstSavePath(
    activeHtmlEditorContext()?.filePath,
    window.__nvWysiwygActivePath,
    window.__nvHtmlEditorActivePath,
  );
}

function svgEditorPath() {
  return firstSavePath(window.__nvSvgEditorActivePath);
}

function pdfEditorPath() {
  return firstSavePath(window.__nvPdfEditorActivePath);
}

export default async function saveFile(options = {}) {
  const requestedPath =
    typeof options === "string" ? options : options?.path;
  const activeHtmlContext = activeHtmlEditorContext();
  const filePath = resolveFilePath(requestedPath || activeHtmlContext?.filePath);
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

    if (mode === "EPUBediting" && (activeHtmlContext?.save || typeof window.saveWYSIWYGFile === "function")) {
      const editorPath = activeHtmlContext?.filePath || htmlEditorPath();
      if (refuseMismatchedEditorSave("EPUB Editor", editorPath, filePath)) return false;
      if (activeHtmlContext?.save) await activeHtmlContext.save(filePath);
      else await window.saveWYSIWYGFile(filePath);
      return notifyFileSaved(filePath);
    }

    // 1) Explicit editor state checks.
    if (mode === "GIFediting" && typeof window.GIFEditorContext?.save === "function") {
      const editorPath = activeGifPath || filePath;
      if (refuseMismatchedEditorSave("GIF Editor", editorPath, filePath)) return false;
      await window.GIFEditorContext.save(filePath);
      return notifyFileSaved(filePath);
    }
    if (canSaveRasterCanvas && (await saveRasterCanvas(filePath))) {
      return notifyFileSaved(filePath);
    }
    if (activePdfPath && sameSavePath(activePdfPath, filePath) && typeof window.currentSavePDFAnnotations === "function") {
      await window.currentSavePDFAnnotations(filePath);
      return notifyFileSaved(activePdfPath);
    }
    if (mode === "CodeEditing" && typeof window.saveCodeFile === "function") {
      const codeEditorPath = window.__nvCodeEditorActivePath || window.currentActiveFilePath;
      if (codeEditorPath && !sameSavePath(codeEditorPath, filePath)) {
        console.error("[saveFile] Refusing to save Code Editor buffer into a different path.", {
          editorPath: codeEditorPath,
          savePath: filePath,
        });
        return false;
      }
      await window.saveCodeFile(filePath);
      return notifyFileSaved(filePath);
    }
    if (window.monacoEditor && typeof window.monacoEditor.getValue === "function") {
      const monacoPath = window.__nvCodeEditorActivePath || window.currentActiveFilePath;
      if (monacoPath && !sameSavePath(monacoPath, filePath)) {
        console.error("[saveFile] Refusing to save Monaco buffer into a different path.", {
          editorPath: monacoPath,
          savePath: filePath,
        });
        return false;
      }
      const content = window.monacoEditor.getValue();
      await saveViaApi({
        path: filePath,
        sourcePath: monacoPath || filePath,
        content,
        encoding: window.currentFileEncoding || "utf8",
        bom: Boolean(window.currentFileBom),
      });
      return notifyFileSaved(filePath);
    }
    if (typeof window.getEditorMarkdown === "function") {
      const editorPath = markdownEditorPath();
      if (refuseMismatchedEditorSave("Markdown Editor", editorPath, filePath)) return false;
      const content = window.getEditorMarkdown();
      await saveViaApi({ path: filePath, sourcePath: editorPath || filePath, content });
      return notifyFileSaved(filePath);
    }
    if (inSvgEditor && typeof window.currentSaveSVG === "function") {
      const editorPath = svgEditorPath();
      if (refuseMismatchedEditorSave("SVG Editor", editorPath, filePath)) return false;
      if (fileExt !== "svg") {
        console.error("[saveFile] Refusing to save SVG Editor buffer into a non-SVG path.", { savePath: filePath });
        return false;
      }
      await window.currentSaveSVG(filePath);
      return notifyFileSaved(filePath);
    }
    if (inSvgEditor) {
      const editorPath = svgEditorPath();
      if (refuseMismatchedEditorSave("SVG Editor", editorPath, filePath)) return false;
      if (fileExt !== "svg") {
        console.error("[saveFile] Refusing to save SVG Editor buffer into a non-SVG path.", { savePath: filePath });
        return false;
      }
      const svgSource =
        svgEditorElement instanceof SVGElement
          ? svgEditorElement
          : svgEditorElement?.querySelector?.("svg");
      if (!svgSource) throw new Error("SVG editor root is missing an SVG element.");
      const svgContent = new XMLSerializer().serializeToString(svgSource);
      await saveViaApi({ path: filePath, sourcePath: editorPath || filePath, content: svgContent });
      return notifyFileSaved(filePath);
    }
    if (inWysiwygEditor && (activeHtmlContext?.getHTML || typeof window.getEditorHTML === "function")) {
      const editorPath = activeHtmlContext?.filePath || htmlEditorPath();
      if (refuseMismatchedEditorSave("HTML/WYSIWYG Editor", editorPath, filePath)) return false;
      if (fileExt === "svg") {
        console.error("[saveFile] Refusing to save HTML/WYSIWYG content into an SVG path.", {
          editorPath,
          savePath: filePath,
        });
        return false;
      }
      const getHTML = activeHtmlContext?.getHTML || window.getEditorHTML;
      const content = getHTML();
      await saveViaApi({ path: filePath, sourcePath: editorPath || filePath, content });
      return notifyFileSaved(filePath);
    }

    // 2) Editor-specific save hooks (guarded by mode/context).
    if (inMidiEditor && typeof window.saveMIDIFile === "function") {
      await window.saveMIDIFile(filePath);
      return notifyFileSaved(filePath);
    }
    if (inKMLEditor && typeof window.currentSaveKML === "function") {
      await window.currentSaveKML(filePath);
      return notifyFileSaved(filePath);
    }
    if ((inMarkdownEditor || inGraphicalEditor) && typeof window.saveMDFile === "function") {
      const editorPath = markdownEditorPath();
      if (refuseMismatchedEditorSave("Markdown Editor", editorPath, filePath)) return false;
      await window.saveMDFile(filePath);
      return notifyFileSaved(filePath);
    }
    if ((inWysiwygEditor || inGraphicalEditor) && (activeHtmlContext?.save || typeof window.saveWYSIWYGFile === "function")) {
      const editorPath = activeHtmlContext?.filePath || htmlEditorPath();
      if (refuseMismatchedEditorSave("HTML/WYSIWYG Editor", editorPath, filePath)) return false;
      if (fileExt === "svg") {
        console.error("[saveFile] Refusing to save HTML/WYSIWYG content into an SVG path.", {
          editorPath,
          savePath: filePath,
        });
        return false;
      }
      if (activeHtmlContext?.save) await activeHtmlContext.save(filePath);
      else await window.saveWYSIWYGFile(filePath);
      return notifyFileSaved(filePath);
    }

    // 3) Generic text fallback for simple editors.
    const markdownEl = document.getElementById("markdown-editor");
    if (markdownEl && "value" in markdownEl) {
      await saveViaApi({ path: filePath, sourcePath: filePath, content: markdownEl.value });
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
