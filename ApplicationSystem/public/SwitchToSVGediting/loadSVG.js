// Nodevision/ApplicationSystem/public/SwitchToSVGediting/loadSVG.js
// This file defines browser-side load SVG logic for the Nodevision UI. It renders interface components and handles user interactions.
console.log("loadSVG.js loaded");

function loadSVG(filePath) {
  console.log("Loading SVG file:", filePath);
  const iframe = document.getElementById("content-frame");
  if (!iframe) return;

  iframe.src = filePath; // simple approach: load SVG into iframe
}

// Expose globally
window.loadSVG = loadSVG;
