// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/viewPHPdeployment.mjs
// This file defines browser-side view PHPdeployment logic for the Nodevision UI. It renders interface components and handles user interactions.

export default function viewPHPdeployment() {


    
  const activeNode = window.selectedFilePath;

  if (!activeNode) {
    alert("No active node is selected.");
    return;
  }

  // Open via Nodevision's /php proxy so the PHP port can vary.
  const deploymentUrl = `${window.location.origin}/php/${activeNode}`;

  // Open in new tab
  window.open(deploymentUrl, "_blank");
}
