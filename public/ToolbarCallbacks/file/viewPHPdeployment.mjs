// Nodevision/public/ToolbarCallbacks/file/viewPHPdeployment.mjs
// This toolbar callback opens the currently selected Notebook file in a new browser tab for viewing or deployment testing.

export default function viewPHPdeployment() {


    
  const activeNode = window.selectedFilePath;

  if (!activeNode) {
    alert("No active node is selected.");
    return;
  }

  // Construct URL to the Notebook file
  const deploymentUrl = `http://localhost:8080/${activeNode}`;

  // Open in new tab
  window.open(deploymentUrl, "_blank");
}
