// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/viewNodevisionDocument.mjs
// This file defines browser-side view Nodevision Document logic for the Nodevision UI. It renders interface components and handles user interactions.
// as a raw document in a new browser tab (not as a deployment).

import { toNotebookDeploymentUrl } from "/utils/notebookPath.mjs";

export default function viewNodevisionDocument() {
  const activeNode = window.selectedFilePath;

  if (!activeNode) {
    alert("No active document is selected.");
    return;
  }

  const docUrl = toNotebookDeploymentUrl(activeNode);

  // Open in new tab
  window.open(docUrl, "_blank");
}
