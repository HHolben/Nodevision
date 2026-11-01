// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/saveFile.mjs
// This module dispatches save requests to the active native editor while preserving document ownership and editor priority. Shared helpers resolve editor context and SVG serialization, while this entry point coordinates save notifications and failure handling.

import {
  activeHtmlEditorContext, finishInlineImageSave, htmlEditorPath,
  markdownEditorPath, readEditorSaveContext, refuseMismatchedEditorSave,
} from "./saveFile/EditorContext.mjs";
import { saveSvgEditor } from "./saveFile/SvgSave.mjs";
import {
  notifyFileSaved,
  resolveFilePath,
  sameSavePath,
  saveRasterCanvas,
  saveViaApi,
} from "./saveFile/utils.mjs";

// Editors with their own panel API own the complete save operation.
function activePanelApi(selector, property) {
  const nodes = window.activeCell?.querySelectorAll?.(selector) || [];
  return [...nodes].find((node) => !node.closest('[hidden],[aria-hidden="true"]'))?.[property];
}

// Dispatch saves in the established editor-priority order.
export default async function saveFile(options = {}) {
  const requestedPath =
    typeof options === "string" ? options : options?.path;
  const terrainMap = activePanelApi("[data-nv-map-editor]", "__nvMapApi")
    || (window.NodevisionState?.currentMode === "NVMAPediting" ? window.NVMapLayersContext?.api : null);
  if (terrainMap) {
    if (requestedPath && !sameSavePath(requestedPath, terrainMap.filePath)) return false;
    return terrainMap.save();
  }
  const gox = activePanelApi("[data-nv-gox]", "__nvGoxApi");
  if (gox) {
    if (typeof gox.save !== "function" || (requestedPath && !sameSavePath(requestedPath, gox.filePath))) return false;
    return gox.save();
  }
  const activeHtmlContext = activeHtmlEditorContext(requestedPath);
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
    const context = readEditorSaveContext(filePath, activeHtmlContext);
    const {
      mode, inGraphicalEditor, activePdfPath, activeGifPath, inMarkdownEditor,
      inWysiwygEditor, inMidiEditor, inKMLEditor, fileExt, canSaveRasterCanvas,
    } = context;
    await finishInlineImageSave();

    if (mode === "EPUBediting" && (activeHtmlContext?.save || typeof window.saveWYSIWYGFile === "function")) {
      const editorPath = activeHtmlContext?.filePath || htmlEditorPath();
      if (refuseMismatchedEditorSave("EPUB Editor", editorPath, filePath)) return false;
      const saved = activeHtmlContext?.save
        ? await activeHtmlContext.save(filePath)
        : await window.saveWYSIWYGFile(filePath);
      if (saved === false) return false;
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
    if (!options?.graphicalEditor && window.monacoEditor && typeof window.monacoEditor.getValue === "function") {
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
    if (mode === "CSVediting" && window.__nvCsvEditor) {
      const editor = window.__nvCsvEditor;
      if (refuseMismatchedEditorSave("CSV Editor", editor.filePath, filePath)) return false;
      const content = editor.serializeDelimitedRows(editor.getRows(), editor.delimiter);
      await saveViaApi({ path: filePath, sourcePath: editor.filePath, content });
      return notifyFileSaved(filePath);
    }
    if (typeof window.getEditorMarkdown === "function" && (!options?.graphicalEditor || mode === "MDediting" || sameSavePath(markdownEditorPath(), filePath))) {
      const editorPath = markdownEditorPath();
      if (refuseMismatchedEditorSave("Markdown Editor", editorPath, filePath)) return false;
      const content = window.getEditorMarkdown();
      await saveViaApi({ path: filePath, sourcePath: editorPath || filePath, content });
      return notifyFileSaved(filePath);
    }
    if (context.inSvgEditor) return await saveSvgEditor(context);
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
      await saveViaApi({
        path: filePath,
        sourcePath: editorPath || filePath,
        content,
        editorKind: activeHtmlContext?.saveKind || "html-wysiwyg",
      });
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
      const saved = activeHtmlContext?.save
        ? await activeHtmlContext.save(filePath)
        : await window.saveWYSIWYGFile(filePath);
      if (saved === false) return false;
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

// Preserve the global entry points used by existing toolbars and hotkeys.
if (typeof window !== "undefined") {
  window.saveFile = saveFile;
  window.saveCurrentFile = saveFile;
}
