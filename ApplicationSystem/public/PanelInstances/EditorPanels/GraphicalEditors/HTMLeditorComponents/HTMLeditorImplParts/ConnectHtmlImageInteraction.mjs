// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/ConnectHtmlImageInteraction.mjs
// This module implements connect Html Image Interaction behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createOnClickHandler } from "./CreateStartCornerTransformHandler.mjs";
import { createCropSelectedImageHandler } from "./CreateCropSelectedImageHandler.mjs";
import { createCloseInlineImageEditorHandler, createToggleSelectedImageInlineEditorHandler } from "./CreateCloseInlineImageEditorHandler.mjs";
import { markSelectedImage } from "./GetImageEditorDescriptor.mjs";
import { updateSelectedImageState } from "./UpdateSelectedImageState.mjs";

// Connect Html Image Interaction operations.
export function connectHtmlImageInteraction(scope) {
  scope.imageToolsState.onClick = createOnClickHandler({
    get imageToolsState() {
      return scope.imageToolsState;
    },
    get wysiwyg() {
      return scope.wysiwyg;
    },
    get editorFilePath() {
      return scope.editorFilePath;
    }
  });
  scope.wysiwyg.addEventListener("click", scope.imageToolsState.onClick);
  scope.imageToolsState.cropSelectedImage = createCropSelectedImageHandler({
    get editorFilePath() {
      return scope.editorFilePath;
    },
    get wysiwyg() {
      return scope.wysiwyg;
    },
    get imageToolsState() {
      return scope.imageToolsState;
    }
  });
  scope.imageToolsState.closeInlineImageEditor = createCloseInlineImageEditorHandler({
    get imageToolsState() {
      return scope.imageToolsState;
    },
    get editorFilePath() {
      return scope.editorFilePath;
    },
    get wysiwyg() {
      return scope.wysiwyg;
    }
  });
  scope.imageToolsState.toggleSelectedImageInlineEditor = createToggleSelectedImageInlineEditorHandler({
    get imageToolsState() {
      return scope.imageToolsState;
    },
    get editorFilePath() {
      return scope.editorFilePath;
    }
  });
  scope.imageToolsState.openSelectedImageEditorUndocked = async () => {
    await scope.imageToolsState.toggleSelectedImageInlineEditor();
  };
  scope.imageToolsState.finishInlineImageEditor = async () => {
    await scope.imageToolsState.closeInlineImageEditor({
      applyChanges: true
    });
  };
  scope.imageToolsState.cancelInlineImageEditor = async () => {
    await scope.imageToolsState.closeInlineImageEditor({
      applyChanges: false
    });
  };
  return {
    value: {
      cropSelectedImage: scope.imageToolsState.cropSelectedImage,
      toggleSelectedImageInlineEditor: scope.imageToolsState.toggleSelectedImageInlineEditor,
      openSelectedImageEditorUndocked: scope.imageToolsState.openSelectedImageEditorUndocked,
      finishInlineImageEditor: scope.imageToolsState.finishInlineImageEditor,
      cancelInlineImageEditor: scope.imageToolsState.cancelInlineImageEditor,
      isInlineImageEditorOpen() {
        return Boolean(scope.imageToolsState.inlineEditorSession);
      },
      destroy() {
        void scope.imageToolsState.closeInlineImageEditor({
          applyChanges: false
        });
        scope.wysiwyg.removeEventListener("click", scope.imageToolsState.onClick);
        window.removeEventListener("resize", scope.imageToolsState.onGlobalGeometryChange);
        window.removeEventListener("nv-panel-zoom-pan-updated", scope.imageToolsState.onGlobalGeometryChange);
        window.removeEventListener("scroll", scope.imageToolsState.onGlobalGeometryChange, true);
        scope.wysiwyg.removeEventListener("scroll", scope.imageToolsState.onGlobalGeometryChange, true);
        scope.wysiwyg.removeEventListener("input", scope.imageToolsState.onGlobalGeometryChange);
        if (scope.imageToolsState.handleSyncRaf) {
          window.cancelAnimationFrame(scope.imageToolsState.handleSyncRaf);
          scope.imageToolsState.handleSyncRaf = 0;
        }
        scope.imageToolsState.removed = true;
        scope.imageToolsState.setSelectedImageForHandles(null);
        scope.imageToolsState.cornerHandles.forEach(handle => handle.remove());
        scope.imageToolsState.cornerHandles.clear();
        markSelectedImage(scope.wysiwyg, null);
        updateSelectedImageState(null);
      }
    }
  };
}
