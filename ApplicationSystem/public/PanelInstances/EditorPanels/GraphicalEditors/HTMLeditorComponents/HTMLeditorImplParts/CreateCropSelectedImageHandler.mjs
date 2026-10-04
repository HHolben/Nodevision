// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateCropSelectedImageHandler.mjs
// This module implements create Crop Selected Image Handler behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { openCropModalForImage } from "./UpdateImageTextStateFromSelection.mjs";
import { saveNotebookImageFromDataUrl } from "./PickLocalImageFile.mjs";
import { sourceFromNotebookPath } from "./IsVirtualEditorPath.mjs";
import { buildImageContextFromElement } from "./BuildImageContextFromElement.mjs";
import { updateSelectedImageState } from "./UpdateSelectedImageState.mjs";
import { markSelectedImage } from "./GetImageEditorDescriptor.mjs";

// Create Crop Selected Image Handler operations.
export function createCropSelectedImageHandler(owner) {
  return async () => {
    const context = window.NodevisionState?.activeHtmlImageContext;
    if (!context?.element) {
      alert("Select an image first.");
      return;
    }
    let croppedDataUrl = null;
    try {
      croppedDataUrl = await openCropModalForImage(context.element.src);
    } catch (err) {
      alert(`Crop failed: ${err.message}`);
      return;
    }
    if (!croppedDataUrl) return;
    if (context.linkedNotebookPath) {
      const mode = prompt("Save cropped result:\n1) Overwrite linked Notebook image\n2) Keep inline in this document", "1");
      if (String(mode || "").trim() === "1") {
        try {
          await saveNotebookImageFromDataUrl(context.linkedNotebookPath, croppedDataUrl);
          context.element.setAttribute("src", sourceFromNotebookPath(context.linkedNotebookPath, owner.editorFilePath));
          context.element.setAttribute("data-nv-linked-path", context.linkedNotebookPath);
        } catch (err) {
          alert(`Failed to overwrite linked image: ${err.message}`);
          return;
        }
      } else {
        context.element.setAttribute("src", croppedDataUrl);
        context.element.removeAttribute("data-nv-linked-path");
      }
    } else {
      context.element.setAttribute("src", croppedDataUrl);
      context.element.removeAttribute("data-nv-linked-path");
    }
    const refreshed = buildImageContextFromElement(context.element, owner.editorFilePath);
    updateSelectedImageState(refreshed);
    markSelectedImage(owner.wysiwyg, context.element);
    owner.imageToolsState.setSelectedImageForHandles(context.element);
  };
}
