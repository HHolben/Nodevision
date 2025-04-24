// === InfoHTML.js ===
function renderHTML(path, iframe, serverBase, scale) {
    iframe.onload = null;
    iframe.onerror = () => {
      iframe.srcdoc = '<p>Error loading content.</p>';
    };
    iframe.onload = () => {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const styleEl = iframeDoc.createElement('style');
      styleEl.innerHTML = `body { transform: scale(${scale}); transform-origin: 0 0; width: ${100/scale}%; height: ${100/scale}%; }`;
      iframeDoc.head.appendChild(styleEl);
    };
    iframe.src = serverBase + '/' + path;
  }