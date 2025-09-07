// Nodevision/public/SwitchToSVGediting/saveSVG.js
console.log("saveSVG.js loaded");

function saveSVG(filePath) {
  console.log("Saving SVG file:", filePath);
  const iframe = document.getElementById("content-frame");
  if (!iframe) return;

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  const svg = doc.querySelector("svg");
  if (!svg) {
    console.warn("No SVG found to save");
    return;
  }

  // Convert SVG element to string
  const svgData = new XMLSerializer().serializeToString(svg);
  
  // For now, just log it; later, you can POST to server
  console.log("SVG data ready to save:\n", svgData);
}

// Expose globally
window.saveSVG = saveSVG;
