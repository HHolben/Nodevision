// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/viewNodevisionDeployment.mjs
// This file defines browser-side view Nodevision Deployment logic for the Nodevision UI. It renders interface components and handles user interactions.

import { toNotebookDeploymentUrl } from "/utils/notebookPath.mjs";

export default function viewNodevisionDeployment() {
  const activeNode = window.selectedFilePath;

  if (!activeNode) {
    alert("No active node is selected.");
    return;
  }

  const deploymentUrl = toNotebookDeploymentUrl(activeNode);

  // Open in new tab
  window.open(deploymentUrl, "_blank");
}
