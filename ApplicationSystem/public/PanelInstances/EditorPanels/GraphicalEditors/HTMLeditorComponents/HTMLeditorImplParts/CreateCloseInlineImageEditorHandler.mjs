// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateCloseInlineImageEditorHandler.mjs
// This module implements create Close Inline Image Editor Handler behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { rebuildLayoutDividersForContainer } from "/panels/workspace.mjs";
import { inferExtensionFromPath, encodeNotebookUrl, sourceFromNotebookPath } from "./IsVirtualEditorPath.mjs";
import { RASTER_IMAGE_EXTENSIONS, SVG_IMAGE_EXTENSIONS } from "./EnsureHTMLLayoutStyles.mjs";
import { saveNotebookImageFromDataUrl, saveNotebookText } from "./PickLocalImageFile.mjs";
import { sourceInputToInlineDataUrl } from "./GetNotebookPathFromSourceInput.mjs";
import { normalizeNotebookPathInput } from "./MakeLayoutCanvasResizable.mjs";
import { updateToolbarState } from "../../../../../panels/createToolbar.mjs";
import { markSelectedImage } from "./GetImageEditorDescriptor.mjs";
import { updateSelectedImageState } from "./UpdateSelectedImageState.mjs";
import { buildImageContextFromElement } from "./BuildImageContextFromElement.mjs";
import { prepareInlineImageEditor } from "./PrepareInlineImageEditor.mjs";
import { mountInlineImageEditor } from "./MountInlineImageEditor.mjs";

// Create Close Inline Image Editor Handler operations.
export function createCloseInlineImageEditorHandler(owner) {
  return async ({
    applyChanges = true
  } = {}) => {
    const session = owner.imageToolsState.inlineEditorSession;
    if (!session) return;
    owner.imageToolsState.inlineEditorSession = null;
    const dismissInlineSvgLayersPanel = () => {
      const htmlEditorCell = container?.closest?.(".panel-cell");
      const splitContainer = htmlEditorCell?.parentElement;
      if (!htmlEditorCell || !splitContainer) return false;
      if (!splitContainer.classList?.contains?.("panel-row")) return false;
      if (splitContainer.dataset?.nvSvgEditingSplit !== "1") return false;
      const layersCell = splitContainer.querySelector(':scope > .panel-cell[data-id="SVGLayersPanel"]');
      if (!layersCell) return false;
      const parent = splitContainer.parentElement;
      if (!parent) return false;
      const originalFlex = splitContainer.style.flex || htmlEditorCell.style.flex || "1 1 0";
      splitContainer.replaceWith(htmlEditorCell);
      htmlEditorCell.style.flex = originalFlex;
      rebuildLayoutDividersForContainer(parent);
      window.activeCell = htmlEditorCell;
      window.highlightActiveCell?.(htmlEditorCell);
      return true;
    };
    if (applyChanges) {
      try {
        const ext = inferExtensionFromPath(session.editorPath);
        if (RASTER_IMAGE_EXTENSIONS.has(ext)) {
          const canvas = session.inlineRasterCanvas || window.rasterCanvas;
          if (canvas instanceof HTMLCanvasElement && session.host.contains(canvas)) {
            await saveNotebookImageFromDataUrl(session.editorPath, canvas.toDataURL("image/png"));
          }
        } else if (SVG_IMAGE_EXTENSIONS.has(ext)) {
          const serializer = session.inlineGetEditorHTML || (typeof window.getEditorHTML === "function" ? window.getEditorHTML : null);
          if (typeof serializer === "function") {
            const svgMarkup = serializer();
            if (typeof svgMarkup === "string" && svgMarkup.trim()) {
              await saveNotebookText(session.editorPath, svgMarkup, "image/svg+xml");
            }
          }
        }
      } catch (err) {
        console.warn("Failed to save inline image editor changes:", err);
      }
    }
    if (typeof session.editorCleanup === "function") {
      try {
        session.editorCleanup();
      } catch (err) {
        console.warn("Inline image editor cleanup failed:", err);
      }
    }
    if (session.targetImage) {
      try {
        if (session.temporaryPath) {
          const inlineUpdated = await sourceInputToInlineDataUrl(encodeNotebookUrl(session.temporaryPath), owner.editorFilePath);
          session.targetImage.setAttribute("src", inlineUpdated);
          session.targetImage.removeAttribute("data-nv-linked-path");
        } else {
          const preservedSrc = String(session.originalSrcAttribute || "").trim();
          const fallbackSrc = sourceFromNotebookPath(session.editorPath, owner.editorFilePath);
          session.targetImage.setAttribute("src", preservedSrc || fallbackSrc);
          session.targetImage.setAttribute("data-nv-linked-path", normalizeNotebookPathInput(session.editorPath));
        }
      } catch (err) {
        console.warn("Failed to sync edited image back into document:", err);
      }
    }
    if (session.frame?.isConnected && session.targetImage) {
      session.frame.replaceWith(session.targetImage);
    }
    owner.imageToolsState.restoreGlobalEditorFileContext(session);
    owner.imageToolsState.restoreGlobalEditorRuntime(session);
    window.NodevisionState.htmlImageEditingInline = false;
    window.NodevisionState.htmlInlineImageEditorMode = null;
    updateToolbarState({
      currentMode: session.previousMode,
      htmlImageSelected: Boolean(session.targetImage?.isConnected),
      htmlImagePath: session.temporaryPath ? null : session.editorPath,
      htmlImageEditingInline: false,
      htmlInlineImageEditorMode: null
    });
    dismissInlineSvgLayersPanel();
    if (session.targetImage?.isConnected) {
      markSelectedImage(owner.wysiwyg, session.targetImage);
      updateSelectedImageState(buildImageContextFromElement(session.targetImage, owner.editorFilePath));
      owner.imageToolsState.setSelectedImageForHandles(session.targetImage);
      window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
        detail: {
          heading: "Edit Image Here",
          force: false,
          toggle: false
        }
      }));
    }
  };
}

export function createToggleSelectedImageInlineEditorHandler(owner) {
  return async () => {
    const inlineImageState = {};
    const stageResult47 = await prepareInlineImageEditor({
      get inlineImageState() {
        return inlineImageState;
      },
      get owner() {
        return owner;
      }
    });
    if (stageResult47) return stageResult47.value;
    await mountInlineImageEditor({
      get inlineImageState() {
        return inlineImageState;
      },
      get owner() {
        return owner;
      }
    });
  };
}
