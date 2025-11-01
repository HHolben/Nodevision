// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewHTML.mjs
// Purpose: Display HTML files directly inside the viewPanel with scaling support.

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
    } catch (err) {
      console.warn("⚠️ Could not inject scaling style:", err);
    }
  };

  // Load the actual HTML file
  iframe.src = `${serverBase}/${path}`;
}
