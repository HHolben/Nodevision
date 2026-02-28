// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewPHP.mjs
// Displays PHP files by loading them from the PHP server inside an iframe.

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

  // IMPORTANT:
  // ❌ DO NOT ACCESS iframe.contentDocument
  // ❌ DO NOT INJECT ANY STYLES OR SCRIPTS
  // Cross-origin = no access allowed.

  // Load the PHP file
  iframe.src = `${serverBase}/${path}`;
}
