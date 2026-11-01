// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/saveFile/SvgSave.mjs
// This module saves SVG editor documents through their native hooks or a preserved DOM serialization fallback. It retains path and file-type guards and delegates oversized-request recovery to the shared SVG save service.

import { saveSvgRequest } from "../../../FileInterop/SvgSaveRecovery.mjs";
import { cleanupSvgCloneForSave } from "../../../PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgPreservation.mjs";
import { notifyFileSaved, sameSavePath } from "./utils.mjs";
import { refuseMismatchedEditorSave, svgEditorPath } from "./EditorContext.mjs";

// Prefer the owning SVG editor so its history and dirty state remain authoritative.
export async function saveSvgEditor({ filePath, fileExt, svgEditorElement }) {
  if (window.SVGEditorContext?.save && sameSavePath(window.SVGEditorContext.filePath, filePath)) {
    if (await window.SVGEditorContext.save(filePath) === false) return false;
    return notifyFileSaved(filePath);
  }
  if (typeof window.currentSaveSVG === "function") {
    const editorPath = svgEditorPath();
    if (refuseMismatchedEditorSave("SVG Editor", editorPath, filePath)) return false;
    if (fileExt !== "svg") {
      console.error("[saveFile] Refusing to save SVG Editor buffer into a non-SVG path.", { savePath: filePath });
      return false;
    }
    if (await window.currentSaveSVG(filePath) === false) return false;
    return notifyFileSaved(filePath);
  }
  // Serialize a cleaned SVG clone when no editor-owned save hook is available.
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
  const svgContent = new XMLSerializer().serializeToString(cleanupSvgCloneForSave(svgSource.cloneNode(true)));
  if (!await saveSvgRequest({ path: filePath, sourcePath: editorPath || filePath, content: svgContent })) return false;
  return notifyFileSaved(filePath);
}
