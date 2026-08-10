// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/viewPHPdeployment.mjs
// This file defines browser-side view PHPdeployment logic for the Nodevision UI. It renders interface components and handles user interactions.

import { toPhpDeploymentUrl } from "/utils/notebookPath.mjs";

export default function viewPHPdeployment() {
  const activeNode = window.selectedFilePath;

  if (!activeNode) {
    alert("No active node is selected.");
    return;
  }

  const deploymentUrl = toPhpDeploymentUrl(activeNode);

  // Open in new tab
  window.open(deploymentUrl, "_blank");
}
