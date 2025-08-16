// Nodevision/public/SwitchTo3DWorldViewing.js
(function () {
  console.log("SwitchTo3DWorldViewing.js loaded");

  // Locate the right-pane container (same as other modes use)
  const container = document.getElementById('content-frame-container');
  if (!container) {
    console.error("Right pane container not found.");
    return;
  }

  // Replace the contents with our 3D world iframe
  container.innerHTML = `
    <iframe 
      src="/3DWorld.html" 
      style="width: 100%; height: 100%; border: none;">
    </iframe>
  `;
})();
