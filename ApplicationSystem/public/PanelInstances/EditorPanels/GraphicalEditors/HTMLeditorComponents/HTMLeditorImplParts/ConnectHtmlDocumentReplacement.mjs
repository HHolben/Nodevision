// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/ConnectHtmlDocumentReplacement.mjs
// This module implements connect Html Document Replacement behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { updateToolbarState } from "../../../../../panels/createToolbar.mjs";
import { createSetEditorHtmlForPathHandler } from "./CreateSetEditorHtmlForPathHandler.mjs";

// Connect Html Document Replacement operations.
export function connectHtmlDocumentReplacement(scope) {
  updateToolbarState({
    fileIsDirty: false
  });
  scope.htmlSession.setEditorHtmlForPath = createSetEditorHtmlForPathHandler({
    get htmlSession() {
      return scope.htmlSession;
    },
    get container() {
      return scope.container;
    },
    get filePath() {
      return scope.filePath;
    }
  });
  scope.htmlSession.htmlEditorContext.setHTML = scope.htmlSession.setEditorHtmlForPath;
  window.setEditorHTML = scope.htmlSession.setEditorHtmlForPath;
  window.saveWYSIWYGFile = scope.htmlSession.saveHtmlForPath;
}
