// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/OpenInsertImageForm.mjs
// This module implements open Insert Image Form behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { mountHtmlImageDialog } from "./MountHtmlImageDialog.mjs";
import { connectHtmlImageDialog } from "./ConnectHtmlImageDialog.mjs";
import { parseDataUrl, saveNotebookImageFromDataUrl } from "./PickLocalImageFile.mjs";
import { getDefaultNotebookImageDir, inferExtensionFromMime, sourceFromNotebookPath } from "./IsVirtualEditorPath.mjs";
import { normalizeNotebookPathInput } from "./MakeLayoutCanvasResizable.mjs";
import { buildTemporaryImageEditPath, decorateInsertedImage } from "./GetImageEditorDescriptor.mjs";
import { initializeHtmlImageHandles } from "./InitializeHtmlImageHandles.mjs";
import { connectHtmlImageInteraction } from "./ConnectHtmlImageInteraction.mjs";

// Open Insert Image Form operations.
export async function openInsertImageForm(wysiwyg, editorFilePath, preferredInsertRange = null, options = {}) {
  const imageDialogState = {};
  await mountHtmlImageDialog({
    get imageDialogState() {
      return imageDialogState;
    },
    get options() {
      return options;
    },
    get editorFilePath() {
      return editorFilePath;
    }
  });
  connectHtmlImageDialog({
    get imageDialogState() {
      return imageDialogState;
    },
    get editorFilePath() {
      return editorFilePath;
    },
    get options() {
      return options;
    },
    get wysiwyg() {
      return wysiwyg;
    },
    get preferredInsertRange() {
      return preferredInsertRange;
    }
  });
}

export async function ensureLinkedImageForEditor(context, editorFilePath) {
  if (!context) return null;
  if (context.linkedNotebookPath) return context.linkedNotebookPath;
  if (!context.isInline) return null;
  const dataUrl = context.element?.getAttribute("src") || "";
  if (!dataUrl.startsWith("data:image/")) return null;
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const defaultDir = getDefaultNotebookImageDir(editorFilePath);
  const ext = inferExtensionFromMime(parsed.mimeType) || "png";
  const suggested = [defaultDir, `image-${Date.now()}.${ext}`].filter(Boolean).join("/");
  const entered = prompt("Save inline image to Notebook before opening editor:", suggested);
  if (!entered) return null;
  const notebookPath = normalizeNotebookPathInput(entered);
  if (!notebookPath) return null;
  await saveNotebookImageFromDataUrl(notebookPath, dataUrl);
  context.element.setAttribute("src", sourceFromNotebookPath(notebookPath, editorFilePath));
  context.element.setAttribute("data-nv-linked-path", notebookPath);
  context.linkedNotebookPath = notebookPath;
  context.isInline = false;
  return notebookPath;
}

export async function prepareImageForUndockedEditor(context, editorFilePath) {
  if (!context?.element) return null;
  const linkedPath = context.linkedNotebookPath || "";
  if (linkedPath) {
    return {
      editorPath: linkedPath,
      temporaryPath: null
    };
  }
  const source = context.element.getAttribute("src") || context.element.currentSrc || "";
  if (!source.startsWith("data:image/")) return null;
  const parsed = parseDataUrl(source);
  const extension = inferExtensionFromMime(parsed?.mimeType || "") || context.extension || "png";
  const temporaryPath = buildTemporaryImageEditPath(editorFilePath, extension);
  await saveNotebookImageFromDataUrl(temporaryPath, source);
  return {
    editorPath: temporaryPath,
    temporaryPath
  };
}

export function registerImageInteractionTools(wysiwyg, editorFilePath) {
  const imageToolsState = {};
  initializeHtmlImageHandles({
    get imageToolsState() {
      return imageToolsState;
    },
    get wysiwyg() {
      return wysiwyg;
    }
  });
  const stageResult40 = connectHtmlImageInteraction({
    get imageToolsState() {
      return imageToolsState;
    },
    get wysiwyg() {
      return wysiwyg;
    },
    get editorFilePath() {
      return editorFilePath;
    }
  });
  if (stageResult40) return stageResult40.value;
}

export function createImageElementFromInsertion(insertion) {
  if (!insertion?.src) return null;
  const img = document.createElement("img");
  img.src = insertion.src;
  img.alt = "Inserted image";
  return decorateInsertedImage(img, insertion);
}
