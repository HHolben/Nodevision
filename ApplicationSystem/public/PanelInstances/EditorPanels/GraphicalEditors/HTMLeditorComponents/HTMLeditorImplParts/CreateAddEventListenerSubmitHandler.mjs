// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateAddEventListenerSubmitHandler.mjs
// This module implements create Add Event Listener Submit Handler behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { normalizeNewImageFormat, normalizeNewImageFilename, clampImageDimension, createGeneratedImageDataUrl, sourceInputToInlineDataUrl, getNotebookPathFromSourceInput } from "./GetNotebookPathFromSourceInput.mjs";
import { normalizeNotebookPathInput, isExternalOrNonNotebookAbsoluteSource, sameNotebookImagePath } from "./MakeLayoutCanvasResizable.mjs";
import { saveNotebookImageFromDataUrl } from "./PickLocalImageFile.mjs";
import { sourceFromNotebookPath, sanitizeImageFilename, hydrateEditorImage } from "./IsVirtualEditorPath.mjs";
import { normalizeFallbackReferencesForSource } from "/utils/referenceFallbacks.mjs";
import { markHtmlEditorDirty, insertNodeAtCaret } from "./EnsureHTMLLayoutStyles.mjs";
import { syncEditorImageTextPresentation, updateSelectedImageState } from "./UpdateSelectedImageState.mjs";
import { createImageElementFromInsertion } from "./OpenInsertImageForm.mjs";
import { markSelectedImage } from "./GetImageEditorDescriptor.mjs";
import { buildImageContextFromElement } from "./BuildImageContextFromElement.mjs";

// Create Add Event Listener Submit Handler operations.
export function createAddEventListenerSubmitHandler(owner) {
  return async evt => {
    evt.preventDefault();
    owner.imageDialogState.errorEl.textContent = "";
    owner.imageDialogState.applyBtn.disabled = true;
    try {
      const sourceMode = owner.imageDialogState.selectedValue(owner.imageDialogState.sourceRadios);
      const storageMode = owner.imageDialogState.selectedValue(owner.imageDialogState.storageRadios);
      let insertion = null;
      if (sourceMode === "new") {
        const format = normalizeNewImageFormat(owner.imageDialogState.newFormatSelect.value);
        const filename = normalizeNewImageFilename(owner.imageDialogState.newNameInput.value, format);
        const width = clampImageDimension(owner.imageDialogState.newWidthInput.value, 512);
        const height = clampImageDimension(owner.imageDialogState.newHeightInput.value, 512);
        const dataUrl = createGeneratedImageDataUrl(format, width, height);
        if (storageMode === "inline") {
          insertion = {
            src: dataUrl,
            linkedNotebookPath: "",
            mode: "inline-new"
          };
        } else {
          const notebookPath = normalizeNotebookPathInput([owner.imageDialogState.defaultDir, filename].filter(Boolean).join("/"));
          if (!notebookPath) throw new Error("Could not resolve referenced image path.");
          await saveNotebookImageFromDataUrl(notebookPath, dataUrl);
          insertion = {
            src: sourceFromNotebookPath(notebookPath, owner.editorFilePath),
            linkedNotebookPath: notebookPath,
            mode: "referenced-new"
          };
        }
      } else {
        const existingSource = String(owner.imageDialogState.existingSourceInput.value || "").trim();
        const localFileSelected = Boolean(owner.imageDialogState.localFileState.dataUrl && owner.imageDialogState.existingSourceInput.dataset.localFile === "true");
        if (!existingSource && !localFileSelected) {
          throw new Error("Enter an existing image source or select a local file.");
        }
        if (storageMode === "inline") {
          const inlineDataUrl = localFileSelected ? owner.imageDialogState.localFileState.dataUrl : await sourceInputToInlineDataUrl(existingSource, owner.editorFilePath);
          insertion = {
            src: inlineDataUrl,
            linkedNotebookPath: "",
            mode: "inline-existing"
          };
        } else if (localFileSelected) {
          if (isExternalOrNonNotebookAbsoluteSource(existingSource)) {
            throw new Error("For referenced local files, enter a Notebook destination path.");
          }
          const sanitizedName = sanitizeImageFilename(owner.imageDialogState.localFileState.name || "image.png");
          const specifiedPath = normalizeNotebookPathInput(existingSource);
          const fallbackPath = normalizeNotebookPathInput([owner.imageDialogState.defaultDir, sanitizedName].filter(Boolean).join("/"));
          const selectedPath = normalizeNotebookPathInput(owner.imageDialogState.localFileState.notebookPath);
          const selectedWasKept = selectedPath && sameNotebookImagePath(specifiedPath, selectedPath);
          const notebookPath = selectedWasKept ? selectedPath : specifiedPath || fallbackPath;
          if (!notebookPath) {
            throw new Error("Enter a destination path for the selected file.");
          }
          if (!selectedWasKept) {
            await saveNotebookImageFromDataUrl(notebookPath, owner.imageDialogState.localFileState.dataUrl);
          }
          insertion = {
            src: sourceFromNotebookPath(notebookPath, owner.editorFilePath),
            linkedNotebookPath: notebookPath,
            mode: "referenced-existing"
          };
        } else {
          const notebookPath = getNotebookPathFromSourceInput(existingSource, owner.editorFilePath);
          if (notebookPath) {
            insertion = {
              src: sourceFromNotebookPath(notebookPath, owner.editorFilePath),
              linkedNotebookPath: notebookPath,
              mode: "referenced-existing"
            };
          } else {
            insertion = {
              src: existingSource,
              linkedNotebookPath: "",
              mode: "referenced-existing"
            };
          }
        }
      }
      insertion.fallbacks = normalizeFallbackReferencesForSource(owner.imageDialogState.fallbackList.getFallbacks(), {
        sourcePath: owner.editorFilePath,
        primary: insertion.src
      });
      if (typeof owner.options.applyInsertion === "function") {
        const beforeHtml = String(owner.wysiwyg.innerHTML || "");
        const applied = await owner.options.applyInsertion(insertion, {
          wysiwyg: owner.wysiwyg,
          editorFilePath: owner.editorFilePath,
          preferredInsertRange: owner.preferredInsertRange
        });
        if (!applied) throw new Error("Failed to apply image to selected text.");
        owner.wysiwyg.__nvProgrammaticHistory?.record?.(beforeHtml);
        markHtmlEditorDirty(owner.wysiwyg, owner.editorFilePath);
        syncEditorImageTextPresentation(owner.wysiwyg, owner.editorFilePath);
        owner.imageDialogState.closePanel();
        return;
      }
      const img = createImageElementFromInsertion(insertion);
      if (!img) throw new Error("Failed to prepare image insertion.");
      const beforeHtml = String(owner.wysiwyg.innerHTML || "");
      insertNodeAtCaret(owner.wysiwyg, img, {
        preferredRange: owner.preferredInsertRange
      });
      owner.wysiwyg.__nvProgrammaticHistory?.record?.(beforeHtml);
      markHtmlEditorDirty(owner.wysiwyg, owner.editorFilePath);
      hydrateEditorImage(img, owner.editorFilePath).catch(err => {
        console.warn("Failed to hydrate inserted image:", err);
      });
      markSelectedImage(owner.wysiwyg, img);
      updateSelectedImageState(buildImageContextFromElement(img, owner.editorFilePath));
      owner.imageDialogState.closePanel();
    } catch (err) {
      owner.imageDialogState.errorEl.textContent = err?.message || String(err);
    } finally {
      owner.imageDialogState.applyBtn.disabled = false;
    }
  };
}
