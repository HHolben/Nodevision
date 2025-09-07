// Nodevision/public/SwitchToSVGediting/loadSVG.js
console.log("loadSVG.js loaded");

function loadSVG(filePath) {
  console.log("Loading SVG file:", filePath);
  const iframe = document.getElementById("content-frame");
  if (!iframe) return;

  iframe.src = filePath; // simple approach: load SVG into iframe
}

// Expose globally
window.loadSVG = loadSVG;
