// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/MountInlineImageEditor.mjs
// This module implements mount Inline Image Editor behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { updateToolbarState } from "../../../../../panels/createToolbar.mjs";

// Mount Inline Image Editor operations.
export async function mountInlineImageEditor(scope) {
  try {
    scope.inlineImageState.mod = await import(scope.inlineImageState.editorDescriptor.modulePath);
    if (typeof scope.inlineImageState.mod.renderEditor !== "function") {
      throw new Error("Editor module missing renderEditor()");
    }
    scope.inlineImageState.instance = await scope.inlineImageState.mod.renderEditor(scope.inlineImageState.linkedPath, scope.inlineImageState.host);
    scope.inlineImageState.inlineGetEditorHTML = typeof window.getEditorHTML === "function" ? window.getEditorHTML : null;
    scope.inlineImageState.inlineSelectSVGElement = window.selectSVGElement;
    scope.inlineImageState.inlineSVGEditorContext = window.SVGEditorContext;
    scope.inlineImageState.inlineToggleSVGLayersPanel = window.toggleSVGLayersPanel;
    scope.inlineImageState.inlineRasterCanvas = window.rasterCanvas instanceof HTMLCanvasElement ? window.rasterCanvas : scope.inlineImageState.host.querySelector("canvas");
    scope.owner.imageToolsState.restoreGlobalEditorFileContext({
      previousSelectedFile: scope.inlineImageState.previousSelectedFile,
      previousActiveEditorFilePath: scope.inlineImageState.previousActiveEditorFilePath,
      previousCurrentActiveFilePath: scope.inlineImageState.previousCurrentActiveFilePath,
      previousFilePath: scope.inlineImageState.previousFilePath,
      previousSelectedFilePath: scope.inlineImageState.previousSelectedFilePath
    });
    window.getEditorHTML = scope.inlineImageState.previousGetEditorHTML;
    window.setEditorHTML = scope.inlineImageState.previousSetEditorHTML;
    window.saveWYSIWYGFile = scope.inlineImageState.previousSaveWYSIWYGFile;
    window.selectSVGElement = scope.inlineImageState.previousSelectSVGElement;
    window.SVGEditorContext = scope.inlineImageState.previousSVGEditorContext;
    window.toggleSVGLayersPanel = scope.inlineImageState.previousToggleSVGLayersPanel;
    window.rasterCanvas = scope.inlineImageState.inlineRasterCanvas || null;
    if (scope.inlineImageState.editorMode === "SVG Editing") {
      window.selectSVGElement = scope.inlineImageState.inlineSelectSVGElement;
      window.SVGEditorContext = scope.inlineImageState.inlineSVGEditorContext;
      window.toggleSVGLayersPanel = scope.inlineImageState.inlineToggleSVGLayersPanel;
    }
    window.NodevisionState.currentMode = scope.inlineImageState.editorMode;
    window.NodevisionState.htmlImageEditingInline = true;
    window.NodevisionState.htmlInlineImageEditorMode = scope.inlineImageState.editorMode;
    updateToolbarState({
      currentMode: scope.inlineImageState.editorMode,
      htmlImageSelected: true,
      htmlImagePath: scope.inlineImageState.temporaryPath ? null : scope.inlineImageState.linkedPath,
      htmlImageEditingInline: true,
      htmlInlineImageEditorMode: scope.inlineImageState.editorMode
    });
    scope.owner.imageToolsState.showEditorSubToolbarForMode(scope.inlineImageState.editorMode);
    if (scope.inlineImageState.editorMode === "PNGediting") {
      scope.inlineImageState.inlineCanvas = scope.inlineImageState.inlineRasterCanvas || scope.inlineImageState.host.querySelector("canvas");
      if (scope.inlineImageState.inlineCanvas instanceof HTMLCanvasElement) {
        scope.inlineImageState.inlineCanvas.style.width = "100%";
        scope.inlineImageState.inlineCanvas.style.height = "100%";
        scope.inlineImageState.inlineCanvas.style.display = "block";
      }
    }
    if (scope.inlineImageState.instance && typeof scope.inlineImageState.instance.destroy === "function") {
      scope.inlineImageState.editorCleanup = scope.inlineImageState.instance.destroy;
    }
    scope.owner.imageToolsState.inlineEditorSession = {
      targetImage: scope.inlineImageState.targetImage,
      originalSrcAttribute: scope.inlineImageState.targetImage.getAttribute("src") || "",
      frame: scope.inlineImageState.frame,
      host: scope.inlineImageState.host,
      editorPath: scope.inlineImageState.linkedPath,
      temporaryPath: scope.inlineImageState.temporaryPath,
      previousMode: scope.inlineImageState.previousMode,
      previousSelectedFile: scope.inlineImageState.previousSelectedFile,
      previousActiveEditorFilePath: scope.inlineImageState.previousActiveEditorFilePath,
      previousCurrentActiveFilePath: scope.inlineImageState.previousCurrentActiveFilePath,
      previousFilePath: scope.inlineImageState.previousFilePath,
      previousSelectedFilePath: scope.inlineImageState.previousSelectedFilePath,
      previousGetEditorHTML: scope.inlineImageState.previousGetEditorHTML,
      previousSetEditorHTML: scope.inlineImageState.previousSetEditorHTML,
      previousSaveWYSIWYGFile: scope.inlineImageState.previousSaveWYSIWYGFile,
      previousSelectSVGElement: scope.inlineImageState.previousSelectSVGElement,
      previousSVGEditorContext: scope.inlineImageState.previousSVGEditorContext,
      previousToggleSVGLayersPanel: scope.inlineImageState.previousToggleSVGLayersPanel,
      previousRasterCanvas: scope.inlineImageState.previousRasterCanvas,
      inlineGetEditorHTML: scope.inlineImageState.inlineGetEditorHTML,
      inlineRasterCanvas: scope.inlineImageState.inlineRasterCanvas || null,
      editorCleanup: scope.inlineImageState.editorCleanup
    };
  } catch (err) {
    if (scope.inlineImageState.frame.isConnected && scope.inlineImageState.targetImage) {
      scope.inlineImageState.frame.replaceWith(scope.inlineImageState.targetImage);
    }
    scope.owner.imageToolsState.restoreGlobalEditorFileContext({
      previousSelectedFile: scope.inlineImageState.previousSelectedFile,
      previousActiveEditorFilePath: scope.inlineImageState.previousActiveEditorFilePath,
      previousCurrentActiveFilePath: scope.inlineImageState.previousCurrentActiveFilePath,
      previousFilePath: scope.inlineImageState.previousFilePath,
      previousSelectedFilePath: scope.inlineImageState.previousSelectedFilePath
    });
    scope.owner.imageToolsState.restoreGlobalEditorRuntime({
      previousGetEditorHTML: scope.inlineImageState.previousGetEditorHTML,
      previousSetEditorHTML: scope.inlineImageState.previousSetEditorHTML,
      previousSaveWYSIWYGFile: scope.inlineImageState.previousSaveWYSIWYGFile,
      previousSelectSVGElement: scope.inlineImageState.previousSelectSVGElement,
      previousSVGEditorContext: scope.inlineImageState.previousSVGEditorContext,
      previousToggleSVGLayersPanel: scope.inlineImageState.previousToggleSVGLayersPanel,
      previousRasterCanvas: scope.inlineImageState.previousRasterCanvas
    });
    updateToolbarState({
      currentMode: scope.inlineImageState.previousMode,
      htmlImageSelected: true,
      htmlImagePath: scope.inlineImageState.context?.linkedNotebookPath || null,
      htmlImageEditingInline: false,
      htmlInlineImageEditorMode: null
    });
    window.NodevisionState.htmlImageEditingInline = false;
    window.NodevisionState.htmlInlineImageEditorMode = null;
    if (scope.inlineImageState.targetImage?.isConnected) {
      scope.owner.imageToolsState.setSelectedImageForHandles(scope.inlineImageState.targetImage);
    } else {
      scope.owner.imageToolsState.setSelectedImageForHandles(null);
    }
    alert(`Failed to open editor: ${err.message}`);
  }
}
