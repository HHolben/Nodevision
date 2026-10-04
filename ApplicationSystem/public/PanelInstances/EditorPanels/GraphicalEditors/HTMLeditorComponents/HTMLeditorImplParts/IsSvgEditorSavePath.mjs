// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/IsSvgEditorSavePath.mjs
// This module implements is Svg Editor Save Path behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { normalizeEditorSavePath, sameEditorSavePath } from "./RegisterHTMLFallbackHotkeys.mjs";
import { mountHtmlEditorShell } from "./MountHtmlEditorShell.mjs";
import { connectHtmlEditorInput } from "./ConnectHtmlEditorInput.mjs";
import { initializeHtmlEditorTools } from "./InitializeHtmlEditorTools.mjs";
import { createHtmlEditorCleanup } from "./CreateSetEditorHtmlForPathHandler.mjs";

// Is Svg Editor Save Path operations.
export function isSvgEditorSavePath(pathValue) {
  const normalized = normalizeEditorSavePath(pathValue).toLowerCase();
  const name = normalized.split("/").pop() || normalized;
  return name.endsWith(".svg");
}

export function resolveEditorHookSavePath(editorLabel, editorPath, requestedPath) {
  const targetPath = requestedPath || editorPath;
  if (targetPath && editorPath && !sameEditorSavePath(targetPath, editorPath)) {
    console.error(editorLabel + ": refusing to save editor content into a different path.", {
      editorPath,
      savePath: targetPath
    });
    throw new Error(editorLabel + " save path mismatch");
  }
  return targetPath;
}

// --------------------------------------------------
// Main HTML Editor
// --------------------------------------------------

export async function renderEditor(filePath, container, options = {}) {
  const htmlSession = {};
  mountHtmlEditorShell({
    get container() {
      return container;
    },
    get htmlSession() {
      return htmlSession;
    },
    get filePath() {
      return filePath;
    },
    get options() {
      return options;
    }
  });
  connectHtmlEditorInput({
    get container() {
      return container;
    },
    get htmlSession() {
      return htmlSession;
    },
    get filePath() {
      return filePath;
    }
  });
  const stageResult46 = await initializeHtmlEditorTools({
    get htmlSession() {
      return htmlSession;
    },
    get container() {
      return container;
    },
    get filePath() {
      return filePath;
    }
  });
  if (stageResult46) return stageResult46.value;
  return createHtmlEditorCleanup({
    get container() {
      return container;
    },
    get htmlSession() {
      return htmlSession;
    }
  });
}
