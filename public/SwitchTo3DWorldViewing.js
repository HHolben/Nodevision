// Nodevision/public/SwitchTo3DWorldViewing.js

document.addEventListener('DOMContentLoaded', function() {
  const toolbarButton = document.getElementById('toolbar-3d-world-viewing');
  if (!toolbarButton) {
    console.error("Toolbar button with ID 'toolbar-3d-world-viewing' not found.");
    return;
  }

  toolbarButton.addEventListener('click', function(event) {
    event.preventDefault();
    switchTo3DWorldViewing();
  });
});

function switchTo3DWorldViewing() {
  const contentFrame = document.getElementById('content-frame');
  if (!contentFrame) {
    console.error("Content frame with ID 'content-frame' not found.");
    return;
  }

  // Add a VR mode query parameter so the page knows to load the 3D world
  contentFrame.src = '3DWorldViewing.html?vr=1';
}
