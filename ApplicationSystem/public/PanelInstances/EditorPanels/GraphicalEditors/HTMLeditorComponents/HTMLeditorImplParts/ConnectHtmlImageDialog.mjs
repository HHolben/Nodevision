// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/ConnectHtmlImageDialog.mjs
// This module implements connect Html Image Dialog behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { normalizeNewImageFormat, normalizeNewImageFilename } from "./GetNotebookPathFromSourceInput.mjs";
import { normalizeNotebookPathInput, isExternalOrNonNotebookAbsoluteSource } from "./MakeLayoutCanvasResizable.mjs";
import { createAddEventListenerChangeHandler } from "./CreateHtmlImageFilePicker.mjs";
import { createAddEventListenerSubmitHandler } from "./CreateAddEventListenerSubmitHandler.mjs";

// Connect Html Image Dialog operations.
export function connectHtmlImageDialog(scope) {
  scope.imageDialogState.clearLocalFileSelection = () => {
    scope.imageDialogState.localFileState = {
      dataUrl: "",
      name: "",
      notebookPath: "",
      sourceValue: ""
    };
    if (scope.imageDialogState.existingSourceInput) {
      delete scope.imageDialogState.existingSourceInput.dataset.localFile;
    }
    scope.imageDialogState.updateLocalFileStatus();
  };
  scope.imageDialogState.form.appendChild(scope.imageDialogState.hiddenExistingFileInput);
  scope.imageDialogState.closePanel = () => {
    if (scope.imageDialogState.panel.panelEl.parentNode) scope.imageDialogState.panel.panelEl.parentNode.removeChild(scope.imageDialogState.panel.panelEl);
  };
  scope.imageDialogState.panel.closeBtn.addEventListener("click", scope.imageDialogState.closePanel, {
    once: true
  });
  scope.imageDialogState.cancelBtn.addEventListener("click", scope.imageDialogState.closePanel);
  scope.imageDialogState.selectedValue = radios => {
    const checked = radios.find(radio => radio.checked);
    return checked ? checked.value : "";
  };
  scope.imageDialogState.updateReferencedTargetHint = () => {
    const sourceMode = scope.imageDialogState.selectedValue(scope.imageDialogState.sourceRadios);
    const storageMode = scope.imageDialogState.selectedValue(scope.imageDialogState.storageRadios);
    if (sourceMode !== "new" || storageMode !== "referenced") {
      scope.imageDialogState.newReferencedTarget.textContent = "";
      return;
    }
    const format = normalizeNewImageFormat(scope.imageDialogState.newFormatSelect.value);
    const filename = normalizeNewImageFilename(scope.imageDialogState.newNameInput.value, format);
    const notebookPath = normalizeNotebookPathInput([scope.imageDialogState.defaultDir, filename].filter(Boolean).join("/"));
    scope.imageDialogState.newReferencedTarget.textContent = notebookPath ? `Will save to: ${notebookPath}` : "Will save to the current editor folder.";
  };
  scope.imageDialogState.syncVisibility = () => {
    const sourceMode = scope.imageDialogState.selectedValue(scope.imageDialogState.sourceRadios);
    const storageMode = scope.imageDialogState.selectedValue(scope.imageDialogState.storageRadios);
    scope.imageDialogState.newFields.style.display = sourceMode === "new" ? "flex" : "none";
    scope.imageDialogState.existingFields.style.display = sourceMode === "existing" ? "flex" : "none";
    if (scope.imageDialogState.newNameRow) {
      scope.imageDialogState.newNameRow.style.display = sourceMode === "new" && storageMode === "referenced" ? "block" : "none";
    }
    scope.imageDialogState.updateReferencedTargetHint();
  };
  scope.imageDialogState.sourceRadios.forEach(radio => radio.addEventListener("change", scope.imageDialogState.syncVisibility));
  scope.imageDialogState.storageRadios.forEach(radio => radio.addEventListener("change", scope.imageDialogState.syncVisibility));
  scope.imageDialogState.newFormatSelect.addEventListener("change", () => {
    const format = normalizeNewImageFormat(scope.imageDialogState.newFormatSelect.value);
    const current = String(scope.imageDialogState.newNameInput.value || "").trim();
    if (!current) {
      scope.imageDialogState.newNameInput.value = `image-${Date.now()}.${format}`;
    } else {
      const base = current.replace(/\.[^.]+$/, "");
      scope.imageDialogState.newNameInput.value = `${base}.${format}`;
    }
    scope.imageDialogState.updateReferencedTargetHint();
  });
  scope.imageDialogState.newNameInput.addEventListener("input", scope.imageDialogState.updateReferencedTargetHint);
  if (!scope.imageDialogState.newNameInput.value.trim()) {
    scope.imageDialogState.format = normalizeNewImageFormat(scope.imageDialogState.newFormatSelect.value);
    scope.imageDialogState.newNameInput.value = `image-${Date.now()}.${scope.imageDialogState.format}`;
  }
  scope.imageDialogState.syncVisibility();
  scope.imageDialogState.existingSourceInput.addEventListener("input", () => {
    if (scope.imageDialogState.existingSourceInput.dataset.localFile !== "true") return;
    if (isExternalOrNonNotebookAbsoluteSource(scope.imageDialogState.existingSourceInput.value)) {
      scope.imageDialogState.clearLocalFileSelection();
    }
  });
  if (scope.imageDialogState.existingSourceFileBtn) {
    scope.imageDialogState.existingSourceFileBtn.addEventListener("click", () => scope.imageDialogState.hiddenExistingFileInput.click());
  }
  scope.imageDialogState.hiddenExistingFileInput.addEventListener("change", createAddEventListenerChangeHandler({
    get imageDialogState() {
      return scope.imageDialogState;
    }
  }));
  scope.imageDialogState.updateLocalFileStatus();
  scope.imageDialogState.form.addEventListener("submit", createAddEventListenerSubmitHandler({
    get imageDialogState() {
      return scope.imageDialogState;
    },
    get editorFilePath() {
      return scope.editorFilePath;
    },
    get options() {
      return scope.options;
    },
    get wysiwyg() {
      return scope.wysiwyg;
    },
    get preferredInsertRange() {
      return scope.preferredInsertRange;
    }
  }));
}
