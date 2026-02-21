// Nodevision/public/ToolbarCallbacks/file/saveFile.mjs
// Unified save callback for all supported editor modes.

const RASTER_EDITING_MODES = new Set([
  "PNGediting",
  "JPGediting",
  "JPEGediting",
  "GIFediting",
  "BMPediting",
  "WEBPediting",
]);

const RASTER_FILE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "webp",
]);

function resolveFilePath(preferredPath) {
  return (
    preferredPath ||
    window.NodevisionState?.activeEditorFilePath ||
    window.currentActiveFilePath ||
    window.filePath ||
    window.selectedFilePath ||
    window.NodevisionState?.selectedFile ||
    null
  );
}

async function saveViaApi(payload) {
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok || !data?.success) {
    const detail = data?.error || `${res.status} ${res.statusText}`;
    throw new Error(detail);
  }

  return data;
}

async function saveRasterCanvas(filePath) {
  const canvas = window.rasterCanvas;
  if (!(canvas instanceof HTMLCanvasElement)) return false;

  if (typeof window.saveRasterImage === "function") {
    if (window.saveRasterImage.length >= 2) {
      await window.saveRasterImage(canvas, filePath);
    } else {
      await window.saveRasterImage(filePath);
    }
    return true;
  }

  const dataURL = canvas.toDataURL("image/png");
  const base64Data = dataURL.replace(/^data:image\/png;base64,/, "");
  await saveViaApi({
    path: filePath,
    content: base64Data,
    encoding: "base64",
    mimeType: "image/png",
  });
  return true;
}

function getFileExtension(pathValue = "") {
  const clean = String(pathValue || "")
    .trim()
    .replace(/[?#].*$/, "");
  const dot = clean.lastIndexOf(".");
  if (dot === -1) return "";
  return clean.slice(dot + 1).toLowerCase();
}

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
    return !!(await window.saveVirtualWorldFile(filePath));
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
    const isRasterPath = RASTER_FILE_EXTENSIONS.has(fileExt);
    const isRasterMode = RASTER_EDITING_MODES.has(mode);

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
      return true;
    }

    // 1) Explicit editor state checks.
    const canSaveRasterCanvas =
      (isRasterMode || (isRasterPath && !inWysiwygEditor)) &&
      !window.NodevisionState?.htmlImageEditingInline;
    if (canSaveRasterCanvas && (await saveRasterCanvas(filePath))) {
      return true;
    }
    if (window.monacoEditor && typeof window.monacoEditor.getValue === "function") {
      const content = window.monacoEditor.getValue();
      await saveViaApi({
        path: filePath,
        content,
        encoding: window.currentFileEncoding || "utf8",
        bom: Boolean(window.currentFileBom),
      });
      return true;
    }
    if (typeof window.getEditorMarkdown === "function") {
      const content = window.getEditorMarkdown();
      await saveViaApi({ path: filePath, content });
      return true;
    }
    if (inWysiwygEditor && typeof window.getEditorHTML === "function") {
      const content = window.getEditorHTML();
      await saveViaApi({ path: filePath, content });
      return true;
    }

    // 2) Editor-specific save hooks (guarded by mode/context).
    if (inMidiEditor && typeof window.saveMIDIFile === "function") {
      await window.saveMIDIFile(filePath);
      return true;
    }
    if (inSvgEditor && typeof window.currentSaveSVG === "function") {
      await window.currentSaveSVG(filePath);
      return true;
    }
    if ((inMarkdownEditor || inGraphicalEditor) && typeof window.saveMDFile === "function") {
      await window.saveMDFile(filePath);
      return true;
    }
    if ((inWysiwygEditor || inGraphicalEditor) && typeof window.saveWYSIWYGFile === "function") {
      await window.saveWYSIWYGFile(filePath);
      return true;
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
      return true;
    }

    // 4) Generic text fallback for simple editors.
    const markdownEl = document.getElementById("markdown-editor");
    if (markdownEl && "value" in markdownEl) {
      await saveViaApi({ path: filePath, content: markdownEl.value });
      return true;
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
