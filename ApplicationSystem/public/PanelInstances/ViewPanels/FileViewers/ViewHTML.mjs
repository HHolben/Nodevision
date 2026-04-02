// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewHTML.mjs
// This file defines browser-side View HTML logic for the Nodevision UI. It renders interface components and handles user interactions.
import { createHtmlLayersContext } from "/PanelInstances/Common/Layers/htmlLayersContext.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

export const wantsIframe = true;

export async function renderFile(path, viewPanel, iframe, serverBase) {
  
  
  // Ensure the iframe is attached *inside* the panel
  if (!viewPanel.contains(iframe)) {
    viewPanel.innerHTML = ""; // clear previous content
    viewPanel.appendChild(iframe);
  }

  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.style.display = "block";

  // Reset previous layer context when switching files
  window.HTMLViewLayersContext = null;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = "HTMLviewing";
  updateToolbarState({ currentMode: "HTMLviewing" });

  // Set up error and load handlers
  iframe.onerror = () => {
    iframe.srcdoc = `<p style="color:red;">Error loading ${path}</p>`;
  };

  iframe.onload = () => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const styleEl = iframeDoc.createElement("style");
      styleEl.textContent = `
        html, body {
          transform: scale(0.8);
          transform-origin: 0 0;
          width: 125%;
          height: 125%;
          margin: 0;
          padding: 0;
          overflow: auto;
          background: white;
        }
      `;
      iframeDoc.head.appendChild(styleEl);

      // Expose a layer context for the Layers panel (view mode)
      const body = iframeDoc.body;
      if (body) {
        window.HTMLViewLayersContext = createHtmlLayersContext(body, { title: "HTML Layers (View)" });
      }
    } catch (err) {
      console.warn("⚠️ Could not inject scaling style:", err);
    }
  };

  // Load the actual HTML file
  iframe.src = `${serverBase}/${path}`;
}
