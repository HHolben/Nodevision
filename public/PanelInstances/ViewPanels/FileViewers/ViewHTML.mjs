// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewHTML.mjs
// Purpose: Display HTML files in an iframe with scaling support

export async function renderFile(path, viewPanel, iframe, serverBase) {
  iframe.onload = null;
  iframe.onerror = () => {
    iframe.srcdoc = '<p>Error loading content.</p>';
  };
  iframe.onload = () => {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const styleEl = iframeDoc.createElement('style');
    styleEl.innerHTML = `
      body {
        transform: scale(0.5);
        transform-origin: 0 0;
        width: 200%;
        height: 200%;
      }
    `;
    iframeDoc.head.appendChild(styleEl);
  };
  iframe.src = `${serverBase}/${path}`;
}
