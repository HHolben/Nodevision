// Nodevision/ApplicationSystem/public/Sessions/SketchFocusSave.mjs
// This module runs Sketch Focus finish prompts, resolves Notebook-relative save paths, confirms collisions, and writes files through Nodevision's normal save API.

import { openNodevisionOverlayPanel } from "../TemplateSystem/NodevisionOverlayPanel.mjs";
import { notifyFileSaved, saveViaApi } from "../ToolbarCallbacks/file/saveFile/utils.mjs";
import { emitNodevisionEvent } from "../Commands/NodevisionEventRegistry.mjs";
import { exportSketch, formatOptionsDefaults } from "./SketchFocusExport.mjs";
import { dirnameNotebookPath, joinNotebookPath, normalizeNotebookPath, notebookAssetUrl } from "./SketchFocusPath.mjs";

const EXTENSIONS = Object.freeze({ svg: "svg", png: "png", jpg: "jpg", gif: "gif" });

export async function finishSketchWorkflow(sketch, context = {}) {
  const selected = await openNodevisionOverlayPanel("SketchFocusExportPanel", { stage: "format", submitLabel: "Next" });
  if (!selected) return { saved: false, cancelled: true, stage: "format" };
  const format = EXTENSIONS[selected.format] ? selected.format : "png";
  const options = await openNodevisionOverlayPanel("SketchFocusExportPanel", {
    stage: "options",
    format,
    submitLabel: "Next",
    ...formatOptionsDefaults(format),
  });
  if (!options) return { saved: false, cancelled: true, format, stage: "options" };
  const extension = EXTENSIONS[format];
  const titled = await openNodevisionOverlayPanel("SketchFocusExportPanel", {
    stage: "title",
    extension,
    basename: "Untitled Sketch",
    submitLabel: "Save",
  });
  if (!titled) return { saved: false, cancelled: true, format, stage: "title" };
  const path = joinNotebookPath(defaultSketchDirectory(), titled.basename + "." + extension);
  if (await notebookFileExists(path)) {
    const overwrite = await confirmOverwrite(path);
    if (overwrite !== "replace") return { saved: false, cancelled: true, format, path, stage: "overwrite" };
  }
  const exported = await exportSketch(sketch, format, { ...options, title: titled.basename });
  await saveViaApi({
    path,
    sourcePath: path,
    content: exported.content,
    encoding: exported.encoding,
    mimeType: exported.mimeType,
  });
  emitNodevisionEvent("file.saved", { path });
  notifyFileSaved(path);
  return {
    saved: true,
    cancelled: false,
    path,
    format,
    mimeType: exported.mimeType,
    width: sketch.width,
    height: sketch.height,
    bytes: exported.bytes,
    contextSessionId: context?.session?.id || "",
  };
}

export function defaultSketchDirectory() {
  const state = window.NodevisionState || {};
  const selected = normalizeNotebookPath(state.selectedFile || window.selectedFilePath || "");
  if (state.selectedFileIsDirectory && selected) return selected;
  const active = normalizeNotebookPath(state.activeEditorFilePath || window.currentActiveFilePath || window.filePath || selected);
  if (!active) return "";
  return dirnameNotebookPath(active);
}
export async function notebookFileExists(path) {
  try {
    const response = await fetch(notebookAssetUrl(path), { cache: "no-store", headers: { Range: "bytes=0-0" } });
    return response.ok;
  } catch {
    return false;
  }
}

async function confirmOverwrite(path) {
  return openNodevisionOverlayPanel("SessionOverlayPanel", {
    title: "Replace Existing File?",
    heading: "Replace Existing File?",
    message: `${path} already exists.`,
    choices: [
      { label: "Cancel", value: "cancel" },
      { label: "Replace", value: "replace", primary: true },
    ],
  });
}
