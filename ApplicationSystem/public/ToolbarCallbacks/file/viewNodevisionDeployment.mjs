// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/viewNodevisionDeployment.mjs
// This file defines browser-side view Nodevision Deployment logic for the Nodevision UI. It renders interface components and handles user interactions.

export default function viewNodevisionDeployment() {
  const activeNode = window.selectedFilePath;

  if (!activeNode) {
    alert("No active node is selected.");
    return;
  }

  // Construct URL to the Notebook file
  const deploymentUrl = `http://localhost:3000/Notebook/${activeNode}`;

  // Open in new tab
  window.open(deploymentUrl, "_blank");
}
