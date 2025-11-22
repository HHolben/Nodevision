// Nodevision/public/ToolbarCallbacks/file/viewNodevisionDocument.mjs
// This toolbar callback opens the currently selected Notebook file
// as a raw document in a new browser tab (not as a deployment).

export default function viewNodevisionDocument() {
  const activeNode = window.selectedFilePath;

  if (!activeNode) {
    alert("No active document is selected.");
    return;
  }

  // Resolve the raw document URL based on current site origin.
  // Example result: http://localhost:3000/Notebook/path/to/file.html
  const docUrl = `${window.location.origin}/Notebook/${activeNode}`;

  // Open in new tab
  window.open(docUrl, "_blank");
}
