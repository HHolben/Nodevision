// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewSVG.mjs
// Purpose: Render SVG files in an iframe inside the View Panel

/**
 * Renders an SVG file inside the view panel.
 * @param {string} filename - Path to the file relative to /Notebook
 * @param {HTMLElement} viewPanel - The panel container element
 */
export async function renderFile(filename, viewPanel) {
  console.log(`[ViewSVG] renderFile → ${filename}`);
  if (!viewPanel) throw new Error("ViewSVG: viewPanel container is required.");

  const serverBase = '/Notebook';

  // Clear panel
  viewPanel.innerHTML = '';

  // Create an iframe for the SVG
  const iframe = document.createElement('iframe');
  iframe.src = `${serverBase}/${filename}`;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = '1px solid #ccc';
  iframe.style.background = 'white';
  iframe.style.display = 'block';

  viewPanel.appendChild(iframe);
}

// Optional global exposure
window.ViewSVG = { renderFile };
