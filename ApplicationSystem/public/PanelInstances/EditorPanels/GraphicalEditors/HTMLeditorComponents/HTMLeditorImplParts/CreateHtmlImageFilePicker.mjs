// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateHtmlImageFilePicker.mjs
// This module implements create Html Image File Picker behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { readFileAsDataUrl } from "./PickLocalImageFile.mjs";
import { notebookPathFromPickedImageFile, normalizeNotebookPathInput } from "./MakeLayoutCanvasResizable.mjs";
import { sanitizeImageFilename } from "./IsVirtualEditorPath.mjs";

// Create Html Image File Picker operations.
export function createHtmlImageFilePicker(owner) {
  return resolve => {
    const overlay = document.createElement("div");
    overlay.style.cssText = ["position:fixed", "inset:0", "background:rgba(0,0,0,0.6)", "display:flex", "align-items:center", "justify-content:center", "z-index:25050"].join(";");
    const box = document.createElement("div");
    box.style.cssText = "background:#fff;padding:10px;max-width:90vw;max-height:90vh;overflow:auto;";
    const canvas = document.createElement("canvas");
    canvas.width = owner.image.width;
    canvas.height = owner.image.height;
    canvas.style.cssText = "max-width:80vw;max-height:70vh;cursor:crosshair;border:1px solid #999;";
    const ctx = canvas.getContext("2d");
    ctx.drawImage(owner.image, 0, 0);
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;
    let selecting = false;
    function redrawSelection() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(owner.image, 0, 0);
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const w = Math.abs(endX - startX);
      const h = Math.abs(endY - startY);
      if (w > 0 && h > 0) {
        ctx.strokeStyle = "#e02020";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
      }
    }
    canvas.addEventListener("mousedown", evt => {
      const rect = canvas.getBoundingClientRect();
      selecting = true;
      startX = evt.clientX - rect.left;
      startY = evt.clientY - rect.top;
      endX = startX;
      endY = startY;
    });
    canvas.addEventListener("mousemove", evt => {
      if (!selecting) return;
      const rect = canvas.getBoundingClientRect();
      endX = evt.clientX - rect.left;
      endY = evt.clientY - rect.top;
      redrawSelection();
    });
    canvas.addEventListener("mouseup", () => {
      selecting = false;
      redrawSelection();
    });
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;margin-top:8px;";
    const cropBtn = document.createElement("button");
    cropBtn.type = "button";
    cropBtn.textContent = "Crop";
    cropBtn.addEventListener("click", () => {
      const x = Math.round(Math.min(startX, endX));
      const y = Math.round(Math.min(startY, endY));
      const w = Math.round(Math.abs(endX - startX));
      const h = Math.round(Math.abs(endY - startY));
      if (!w || !h) {
        alert("Select an area to crop.");
        return;
      }
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const outCtx = out.getContext("2d");
      outCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
      document.body.removeChild(overlay);
      resolve(out.toDataURL("image/png"));
    });
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(overlay);
      resolve(null);
    });
    actions.appendChild(cropBtn);
    actions.appendChild(cancelBtn);
    box.appendChild(canvas);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  };
}

export function createAddEventListenerChangeHandler(owner) {
  return async () => {
    const file = owner.imageDialogState.hiddenExistingFileInput.files?.[0];
    if (!file) return;
    owner.imageDialogState.hiddenExistingFileInput.value = "";
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const name = file.name || "image.png";
      const notebookPath = notebookPathFromPickedImageFile(file);
      const fallbackPath = normalizeNotebookPathInput([owner.imageDialogState.defaultDir, sanitizeImageFilename(name)].filter(Boolean).join("/"));
      const sourceValue = notebookPath || fallbackPath;
      owner.imageDialogState.localFileState = {
        dataUrl,
        name,
        notebookPath,
        sourceValue
      };
      owner.imageDialogState.existingSourceInput.value = sourceValue;
      owner.imageDialogState.existingSourceInput.dataset.localFile = "true";
      owner.imageDialogState.updateLocalFileStatus();
    } catch (err) {
      owner.imageDialogState.existingSourceFileStatus.textContent = err?.message || "Unable to read selected file.";
      owner.imageDialogState.localFileState = {
        dataUrl: "",
        name: "",
        notebookPath: "",
        sourceValue: ""
      };
      delete owner.imageDialogState.existingSourceInput.dataset.localFile;
    }
  };
}
