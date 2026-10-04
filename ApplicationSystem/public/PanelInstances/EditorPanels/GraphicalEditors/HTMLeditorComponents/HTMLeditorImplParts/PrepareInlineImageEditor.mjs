// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/PrepareInlineImageEditor.mjs
// This module implements prepare Inline Image Editor behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { prepareImageForUndockedEditor } from "./OpenInsertImageForm.mjs";
import { getImageEditorDescriptor, getImageEditorMode } from "./GetImageEditorDescriptor.mjs";
import { updateToolbarState } from "../../../../../panels/createToolbar.mjs";

// Prepare Inline Image Editor operations.
export async function prepareInlineImageEditor(scope) {
  scope.inlineImageState.context = window.NodevisionState?.activeHtmlImageContext;
  if (!scope.inlineImageState.context?.element) {
    alert("Select an image first.");
    return {
      value: void 0
    };
  }
  scope.inlineImageState.targetImage = scope.inlineImageState.context.element;
  if (scope.owner.imageToolsState.inlineEditorSession?.targetImage === scope.inlineImageState.targetImage) {
    await scope.owner.imageToolsState.closeInlineImageEditor({
      applyChanges: true
    });
    return {
      value: void 0
    };
  }
  if (scope.owner.imageToolsState.inlineEditorSession) {
    await scope.owner.imageToolsState.closeInlineImageEditor({
      applyChanges: true
    });
  }
  scope.inlineImageState.prepared = null;
  try {
    scope.inlineImageState.prepared = await prepareImageForUndockedEditor(scope.inlineImageState.context, scope.owner.editorFilePath);
  } catch (err) {
    alert(`Failed to prepare image for editor: ${err.message}`);
    return {
      value: void 0
    };
  }
  if (!scope.inlineImageState.prepared?.editorPath) {
    alert("Selected image cannot be edited yet. Use a linked or inline Notebook-supported image.");
    return {
      value: void 0
    };
  }
  scope.inlineImageState.linkedPath = scope.inlineImageState.prepared.editorPath;
  scope.inlineImageState.temporaryPath = scope.inlineImageState.prepared.temporaryPath || null;
  scope.inlineImageState.editorDescriptor = getImageEditorDescriptor(scope.inlineImageState.linkedPath);
  if (!scope.inlineImageState.editorDescriptor) {
    alert("No image editor is available for this file type.");
    return {
      value: void 0
    };
  }
  scope.inlineImageState.targetRect = scope.inlineImageState.targetImage.getBoundingClientRect();
  scope.inlineImageState.fallbackWidth = scope.inlineImageState.targetImage.clientWidth || scope.inlineImageState.targetImage.width || scope.inlineImageState.targetImage.naturalWidth || 320;
  scope.inlineImageState.fallbackHeight = scope.inlineImageState.targetImage.clientHeight || scope.inlineImageState.targetImage.height || scope.inlineImageState.targetImage.naturalHeight || 240;
  scope.inlineImageState.editorWidth = Math.max(80, Math.round(scope.inlineImageState.targetRect.width || scope.inlineImageState.fallbackWidth));
  scope.inlineImageState.editorHeight = Math.max(80, Math.round(scope.inlineImageState.targetRect.height || scope.inlineImageState.fallbackHeight));
  scope.inlineImageState.targetDisplay = window.getComputedStyle(scope.inlineImageState.targetImage).display;
  scope.inlineImageState.frameDisplay = scope.inlineImageState.targetDisplay && scope.inlineImageState.targetDisplay !== "inline" ? scope.inlineImageState.targetDisplay : "inline-block";
  scope.inlineImageState.frame = document.createElement("div");
  scope.inlineImageState.frame.className = "panel nv-inline-image-editor-frame nv-inline-embedded-panel";
  scope.inlineImageState.frame.dataset.nvPanelMode = "embedded";
  scope.inlineImageState.frame.dataset.panelClass = "EmbeddedPanel";
  scope.inlineImageState.frame.setAttribute("contenteditable", "false");
  scope.inlineImageState.frame.style.cssText = ["position:relative", `display:${scope.inlineImageState.frameDisplay}`, "vertical-align:middle", `width:${scope.inlineImageState.editorWidth}px`, `height:${scope.inlineImageState.editorHeight}px`, "max-width:100%", "overflow:hidden", "border:1px solid #6a7f9c", "background:#fff", "box-sizing:border-box"].join(";");
  scope.inlineImageState.panelHeader = document.createElement("div");
  scope.inlineImageState.panelHeader.className = "panel-header nv-inline-embedded-panel-header";
  scope.inlineImageState.panelTitle = document.createElement("span");
  scope.inlineImageState.panelTitle.className = "nv-inline-embedded-panel-title";
  scope.inlineImageState.panelTitle.textContent = "Embedded Image Editor";
  scope.inlineImageState.panelHeader.appendChild(scope.inlineImageState.panelTitle);
  scope.inlineImageState.panelControls = document.createElement("div");
  scope.inlineImageState.panelControls.className = "nv-inline-embedded-panel-controls";
  scope.inlineImageState.finishBtn = document.createElement("button");
  scope.inlineImageState.finishBtn.type = "button";
  scope.inlineImageState.finishBtn.textContent = "Finish";
  scope.inlineImageState.finishBtn.addEventListener("click", () => {
    scope.owner.imageToolsState.closeInlineImageEditor({
      applyChanges: true
    });
  });
  scope.inlineImageState.panelControls.appendChild(scope.inlineImageState.finishBtn);
  scope.inlineImageState.panelHeader.appendChild(scope.inlineImageState.panelControls);
  scope.inlineImageState.frame.appendChild(scope.inlineImageState.panelHeader);
  scope.inlineImageState.body = document.createElement("div");
  scope.inlineImageState.body.className = "nv-inline-embedded-panel-content";
  scope.inlineImageState.frame.appendChild(scope.inlineImageState.body);
  scope.inlineImageState.host = document.createElement("div");
  scope.inlineImageState.host.className = "nv-inline-image-editor-host";
  scope.inlineImageState.host.style.cssText = "position:absolute;inset:0;overflow:hidden;";
  scope.inlineImageState.body.appendChild(scope.inlineImageState.host);
  if (scope.inlineImageState.targetImage.parentNode) {
    scope.owner.imageToolsState.setSelectedImageForHandles(null);
    scope.inlineImageState.targetImage.replaceWith(scope.inlineImageState.frame);
  } else {
    alert("Unable to place inline editor for selected image.");
    return {
      value: void 0
    };
  }
  scope.inlineImageState.previousMode = window.NodevisionState?.currentMode || "HTMLediting";
  scope.inlineImageState.previousSelectedFile = window.NodevisionState?.selectedFile || null;
  scope.inlineImageState.previousActiveEditorFilePath = window.NodevisionState?.activeEditorFilePath || null;
  scope.inlineImageState.previousCurrentActiveFilePath = window.currentActiveFilePath || null;
  scope.inlineImageState.previousFilePath = window.filePath || null;
  scope.inlineImageState.previousSelectedFilePath = window.selectedFilePath || null;
  scope.inlineImageState.previousGetEditorHTML = window.getEditorHTML;
  scope.inlineImageState.previousSetEditorHTML = window.setEditorHTML;
  scope.inlineImageState.previousSaveWYSIWYGFile = window.saveWYSIWYGFile;
  scope.inlineImageState.previousSelectSVGElement = window.selectSVGElement;
  scope.inlineImageState.previousSVGEditorContext = window.SVGEditorContext;
  scope.inlineImageState.previousToggleSVGLayersPanel = window.toggleSVGLayersPanel;
  scope.inlineImageState.previousRasterCanvas = window.rasterCanvas || null;
  scope.inlineImageState.editorMode = getImageEditorMode(scope.inlineImageState.linkedPath);
  scope.inlineImageState.panelTitle.textContent = scope.inlineImageState.editorMode === "SVG Editing" ? "Embedded SVG Editor" : "Embedded Raster Editor";
  window.NodevisionState = window.NodevisionState || {};
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
  scope.inlineImageState.editorCleanup = null;
}
