// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/AttachCanvasTools.mjs
// This module implements attach Canvas Tools behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { markEditorOnly } from "./RemoveTextStylesFromWysiwygSelection.mjs";
import { createCanvasItem } from "./MakeLayoutCanvasResizable.mjs";
import { makeCanvasItemInteractive } from "./AppendEditorHandlesToItem.mjs";
import { chooseImageInsertion } from "./GetImageEditorDescriptor.mjs";
import { createImageElementFromInsertion } from "./OpenInsertImageForm.mjs";

// Attach Canvas Tools operations.
export function attachCanvasTools(canvas, editorFilePath) {
  let tools = canvas.querySelector(".nv-canvas-tools");
  if (!tools) {
    tools = document.createElement("div");
    tools.className = "nv-canvas-tools";
    canvas.appendChild(tools);
  }
  markEditorOnly(tools);
  let addTextBtn = tools.querySelector('button[data-action="add-text"]');
  if (!addTextBtn) {
    addTextBtn = document.createElement("button");
    addTextBtn.type = "button";
    addTextBtn.dataset.action = "add-text";
    addTextBtn.textContent = "+ Text";
    tools.appendChild(addTextBtn);
  }
  let addImageBtn = tools.querySelector('button[data-action="add-image"]');
  if (!addImageBtn) {
    addImageBtn = document.createElement("button");
    addImageBtn.type = "button";
    addImageBtn.dataset.action = "add-image";
    addImageBtn.textContent = "+ Image";
    tools.appendChild(addImageBtn);
  }
  let hint = canvas.querySelector(".nv-canvas-hint");
  if (!hint) {
    hint = document.createElement("div");
    hint.className = "nv-canvas-hint";
    hint.textContent = "Layout canvas: add text/images and drag them to position.";
    hint.style.fontSize = "12px";
    hint.style.color = "#666";
    hint.style.marginTop = "2px";
    canvas.appendChild(hint);
  }
  markEditorOnly(hint);
  if (tools.dataset.nvBound !== "true") {
    const addTextBlock = () => {
      const content = document.createElement("div");
      content.textContent = "Edit this text";
      const item = createCanvasItem({
        typeLabel: "Text",
        x: 24 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
        y: 36 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
        width: 240,
        height: 120,
        contentNode: content,
        editable: true
      });
      canvas.appendChild(item);
      makeCanvasItemInteractive(item, canvas);
      const editable = item.querySelector('.nv-item-content[contenteditable="true"]');
      if (editable) editable.focus();
    };
    const addImageBlock = async () => {
      const insertion = await chooseImageInsertion(editorFilePath);
      const img = createImageElementFromInsertion(insertion);
      if (!img) return;
      const item = createCanvasItem({
        typeLabel: "Media",
        x: 40 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
        y: 48 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
        width: 280,
        height: 200,
        contentNode: img,
        editable: false
      });
      canvas.appendChild(item);
      makeCanvasItemInteractive(item, canvas);
    };
    addTextBtn.addEventListener("click", addTextBlock);
    addImageBtn.addEventListener("click", addImageBlock);
    tools.dataset.nvBound = "true";
  }
}
