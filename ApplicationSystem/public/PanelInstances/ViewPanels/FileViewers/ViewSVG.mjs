// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewSVG.mjs
// This file defines browser-side View SVG logic for the Nodevision UI. It renders interface components and handles user interactions.

export const wantsIframe = true;

function cleanBase(base = "/Notebook") {
  return String(base || "/Notebook").replace(/\/+$/, "") || "/Notebook";
}

/**
 * Renders an SVG file inside the view panel.
 * @param {string} filename - Path to the file relative to /Notebook
 * @param {HTMLElement} viewPanel - The panel container element
 * @param {HTMLIFrameElement} iframe - The shared FileView iframe
 * @param {string} serverBase - The server base path for the active Notebook route
 */
export async function renderFile(filename, viewPanel, iframe, serverBase = "/Notebook") {
  console.log(`[ViewSVG] renderFile -> ${filename}`);
  if (!viewPanel) throw new Error("ViewSVG: viewPanel container is required.");
  viewPanel.dataset.nvZoomInlineFit = "stretch-on-zoom-out";

  if (!iframe) {
    iframe = document.createElement("iframe");
  }

  if (!viewPanel.contains(iframe)) {
    viewPanel.innerHTML = "";
    viewPanel.appendChild(iframe);
  }

  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "1px solid #ccc";
  iframe.style.background = "white";
  iframe.style.display = "block";

  iframe.src = cleanBase(serverBase) + "/" + String(filename || "").replace(/^\/+/, "");
}

// Optional global exposure
window.ViewSVG = { renderFile };
