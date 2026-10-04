// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/MountHtmlImageDialog.mjs
// This module implements mount Html Image Dialog behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createInsertImagePanel } from "./GetNotebookPathFromSourceInput.mjs";
import { getDefaultNotebookImageDir } from "./IsVirtualEditorPath.mjs";
import { attachFallbackReferenceList } from "/ToolbarJSONfiles/referenceFallbackRows.mjs";

// Mount Html Image Dialog operations.
export async function mountHtmlImageDialog(scope) {
  scope.imageDialogState.panel = await createInsertImagePanel(scope.options.title || "Insert Image");
  scope.imageDialogState.defaultDir = getDefaultNotebookImageDir(scope.editorFilePath);
  scope.imageDialogState.form = document.createElement("form");
  scope.imageDialogState.form.style.cssText = "display:flex;flex-direction:column;gap:10px;font:12px monospace;";
  scope.imageDialogState.form.innerHTML = `
    <fieldset style="border:1px solid #c6c6c6;padding:8px;">
      <legend>Image Source</legend>
      <label style="display:block;margin-bottom:6px;">
        <input type="radio" name="nv-image-source" value="new" checked />
        New Image
      </label>
      <label style="display:block;">
        <input type="radio" name="nv-image-source" value="existing" />
        Existing Image
      </label>
    </fieldset>

    <fieldset style="border:1px solid #c6c6c6;padding:8px;">
      <legend>Storage Mode</legend>
      <label style="display:block;margin-bottom:6px;">
        <input type="radio" name="nv-image-storage" value="referenced" checked />
        Referenced (src points to file path)
      </label>
      <label style="display:block;">
        <input type="radio" name="nv-image-storage" value="inline" />
        Inline (embed as data URL)
      </label>
    </fieldset>

    <div id="nv-new-image-fields" style="display:flex;flex-direction:column;gap:8px;">
      <label>
        New Image Format
        <select id="nv-insert-new-format" style="display:block;width:100%;margin-top:4px;">
          <option value="png" selected>PNG</option>
          <option value="svg">SVG</option>
        </select>
      </label>
      <label id="nv-new-name-row">
        New Image File Name
        <input id="nv-insert-new-name" type="text" placeholder="image.png" style="display:block;width:100%;margin-top:4px;" />
      </label>
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <label style="flex:1;">
          Width (px)
          <input id="nv-insert-new-width" type="number" min="1" max="4096" value="512" style="display:block;width:100%;margin-top:4px;" />
        </label>
        <label style="flex:1;">
          Height (px)
          <input id="nv-insert-new-height" type="number" min="1" max="4096" value="512" style="display:block;width:100%;margin-top:4px;" />
        </label>
      </div>
      <div id="nv-new-referenced-target" style="font-size:11px;color:#4b4b4b;"></div>
    </div>

    <div id="nv-existing-image-fields" style="display:none;flex-direction:column;gap:8px;">
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <label style="flex:1;">
          Existing Source (Notebook path or URL)
          <input id="nv-insert-existing-source" type="text" placeholder="images/example.png or https://..." style="display:block;width:100%;margin-top:4px;" />
        </label>
        <button type="button" id="nv-insert-existing-source-file" style="font:12px monospace;padding:6px 10px;border:1px solid #666;background:#fff;cursor:pointer;">Choose File...</button>
      </div>
      <div id="nv-insert-existing-file-status" style="font-size:11px;color:#4b4b4b;">No local file selected.</div>
    </div>

    <div id="nv-insert-image-fallbacks"></div>

    <div id="nv-insert-image-error" style="color:#b00020;min-height:16px;"></div>

    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button type="button" id="nv-insert-cancel">Cancel</button>
      <button type="submit" id="nv-insert-apply">Insert</button>
    </div>
  `;
  scope.imageDialogState.panel.body.appendChild(scope.imageDialogState.form);
  scope.imageDialogState.sourceRadios = Array.from(scope.imageDialogState.form.querySelectorAll('input[name="nv-image-source"]'));
  scope.imageDialogState.storageRadios = Array.from(scope.imageDialogState.form.querySelectorAll('input[name="nv-image-storage"]'));
  scope.imageDialogState.newFields = scope.imageDialogState.form.querySelector("#nv-new-image-fields");
  scope.imageDialogState.existingFields = scope.imageDialogState.form.querySelector("#nv-existing-image-fields");
  scope.imageDialogState.newFormatSelect = scope.imageDialogState.form.querySelector("#nv-insert-new-format");
  scope.imageDialogState.newNameRow = scope.imageDialogState.form.querySelector("#nv-new-name-row");
  scope.imageDialogState.newNameInput = scope.imageDialogState.form.querySelector("#nv-insert-new-name");
  scope.imageDialogState.newWidthInput = scope.imageDialogState.form.querySelector("#nv-insert-new-width");
  scope.imageDialogState.newHeightInput = scope.imageDialogState.form.querySelector("#nv-insert-new-height");
  scope.imageDialogState.newReferencedTarget = scope.imageDialogState.form.querySelector("#nv-new-referenced-target");
  scope.imageDialogState.existingSourceInput = scope.imageDialogState.form.querySelector("#nv-insert-existing-source");
  scope.imageDialogState.fallbackList = attachFallbackReferenceList({
    container: scope.imageDialogState.form.querySelector("#nv-insert-image-fallbacks"),
    primaryInput: scope.imageDialogState.existingSourceInput
  });
  scope.imageDialogState.existingSourceFileBtn = scope.imageDialogState.form.querySelector("#nv-insert-existing-source-file");
  scope.imageDialogState.existingSourceFileStatus = scope.imageDialogState.form.querySelector("#nv-insert-existing-file-status");
  scope.imageDialogState.errorEl = scope.imageDialogState.form.querySelector("#nv-insert-image-error");
  scope.imageDialogState.cancelBtn = scope.imageDialogState.form.querySelector("#nv-insert-cancel");
  scope.imageDialogState.applyBtn = scope.imageDialogState.form.querySelector("#nv-insert-apply");
  if (scope.options.applyLabel && scope.imageDialogState.applyBtn) scope.imageDialogState.applyBtn.textContent = String(scope.options.applyLabel);
  scope.imageDialogState.hiddenExistingFileInput = document.createElement("input");
  scope.imageDialogState.hiddenExistingFileInput.type = "file";
  scope.imageDialogState.hiddenExistingFileInput.accept = "image/*";
  scope.imageDialogState.hiddenExistingFileInput.style.display = "none";
  scope.imageDialogState.localFileState = {
    dataUrl: "",
    name: "",
    notebookPath: "",
    sourceValue: ""
  };
  scope.imageDialogState.updateLocalFileStatus = () => {
    if (!scope.imageDialogState.existingSourceFileStatus) return;
    if (!scope.imageDialogState.localFileState.dataUrl) {
      scope.imageDialogState.existingSourceFileStatus.textContent = "No local file selected.";
      return;
    }
    scope.imageDialogState.existingSourceFileStatus.textContent = scope.imageDialogState.localFileState.notebookPath ? `Selected Notebook file: ${scope.imageDialogState.localFileState.notebookPath}` : `Selected local file: ${scope.imageDialogState.localFileState.name}`;
  };
}
