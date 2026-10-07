// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewPHP.mjs
// This file defines browser-side View PHP logic for the Nodevision UI. It renders interface components and handles user interactions.

import { normalizeServedNotebookPath, toNotebookAssetUrl } from "/utils/notebookPath.mjs";
import { installHtmlFrameZoom } from './HtmlFrameZoom.mjs';

export const wantsIframe = true;

export async function renderFile(path, viewPanel, iframe, serverBase) {

  // Ensure iframe is attached inside the panel
  if (!viewPanel.contains(iframe)) {
    viewPanel.innerHTML = ""; 
    viewPanel.appendChild(iframe);
  }

  Object.assign(iframe.style, {
    width: "100%",
    height: "100%",
    border: "none",
    display: "block"
  });

  // Cross-origin safe error handler
  iframe.onerror = () => {
    iframe.srcdoc = `<p style="color:red;">Error loading PHP file: ${path}</p>`;
  };

  // Runtime view controls never inject authored styles or intercept inaccessible frames.
  const release = installHtmlFrameZoom(viewPanel, iframe);
  viewPanel._dispose = () => { release(); iframe.onerror = null; };

  // Load the PHP file
  iframe.removeAttribute('srcdoc');
  iframe.src = toNotebookAssetUrl(normalizeServedNotebookPath(path), { base: serverBase });
}
