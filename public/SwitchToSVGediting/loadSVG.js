// Nodevision/public/SwitchToSVGediting/loadSVG.js
// Purpose: TODO: Add description of module purpose
console.log("loadSVG.js loaded");

function loadSVG(filePath) {
  console.log("Loading SVG file:", filePath);
  const iframe = document.getElementById("content-frame");
  if (!iframe) return;

  iframe.src = filePath; // simple approach: load SVG into iframe
}

// Expose globally
window.loadSVG = loadSVG;
