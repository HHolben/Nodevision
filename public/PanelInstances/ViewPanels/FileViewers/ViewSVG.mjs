// Nodevision/public/PanelInstances/ViewPanels/ViewSVG.mjs
// Purpose: Handles viewing of SVG files in the View Panel

/**
 * Renders an SVG file inside an iframe.
 * @param {string} filename - The SVG file name or path relative to /Notebook
 * @param {HTMLElement} viewPanel - The panel container element
 * @param {string} serverBase - The base URL of the server (e.g., http://localhost:3000/Notebook)
 */
export function renderSVG(filename, viewPanel, serverBase) {
  console.log(`[ViewSVG] Rendering SVG: ${filename}`);

  // Clear the panel
  viewPanel.innerHTML = '';

  // Create iframe to display the SVG
  const iframe = document.createElement('iframe');
  iframe.src = `${serverBase}/${filename}`;
  iframe.width = '100%';
  iframe.height = '600px';
  iframe.style.border = '1px solid #ccc';
  iframe.style.background = 'white';
  iframe.style.display = 'block';

  viewPanel.appendChild(iframe);
}

// Expose globally (optional)
window.renderSVG = renderSVG;
