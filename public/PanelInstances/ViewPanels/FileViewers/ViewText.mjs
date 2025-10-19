// Nodevision/public/PanelInstances/ViewPanels/ViewText.mjs
// Purpose: Handles viewing of text-based files (HTML, CSS, TXT, JS, etc.) in the View Panel

/**
 * Renders an HTML file inside an iframe with a scaling transform.
 * @param {string} path - The relative file path inside /Notebook
 * @param {HTMLIFrameElement} iframe - The iframe element to render in
 * @param {string} serverBase - The server base path (e.g., http://localhost:3000/Notebook)
 * @param {number} scale - Scaling factor for preview
 */
export function renderHTML(path, iframe, serverBase, scale = 1.0) {
  console.log(`[ViewText] Rendering HTML: ${path}`);
  iframe.onload = null;
  iframe.onerror = () => {
    iframe.srcdoc = '<p style="color:red;">Error loading HTML content.</p>';
  };
  iframe.onload = () => {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const styleEl = iframeDoc.createElement('style');
    styleEl.innerHTML = `
      body {
        transform: scale(${scale});
        transform-origin: 0 0;
        width: ${100 / scale}%;
        height: ${100 / scale}%;
      }
    `;
    iframeDoc.head.appendChild(styleEl);
  };
  iframe.src = `${serverBase}/${path}`;
}

/**
 * Renders CSS file content with live style previews.
 * @param {string} filePath - The CSS file path
 * @param {HTMLElement} viewPanel - The panel container element
 */
export async function renderCSS(filePath, viewPanel) {
  console.log(`[ViewText] Rendering CSS: ${filePath}`);
  viewPanel.innerHTML = '';

  let cssContent = '';
  try {
    const res = await fetch(`/Notebook/${filePath}`);
    cssContent = await res.text();
  } catch (err) {
    viewPanel.innerHTML = `<p style="color:red;">Failed to load CSS: ${err}</p>`;
    return;
  }

  let samples = {};
  try {
    const res = await fetch('/cssPreviewSamples.json');
    samples = await res.json();
  } catch {
    samples = {};
  }

  const selectorRegex = /([^{]+)\s*\{/g;
  const selectors = [];
  let match;
  while ((match = selectorRegex.exec(cssContent)) !== null) {
    selectors.push(match[1].trim());
  }

  const container = document.createElement('div');
  container.style.cssText = 'font-family:sans-serif; padding:1em;';
  
  const styleEl = document.createElement('style');
  styleEl.textContent = cssContent;
  container.appendChild(styleEl);

  selectors.forEach(sel => {
    const block = document.createElement('div');
    block.style.marginBottom = '1em';

    const label = document.createElement('div');
    label.textContent = sel;
    label.style.fontSize = '0.9em';
    label.style.color = '#700';
    block.appendChild(label);

    const snippetHTML = samples[sel] || `<div style="border:1px dashed #ccc; padding:0.5em; color:#500;">${sel}</div>`;
    const snippetDiv = document.createElement('div');
    snippetDiv.innerHTML = snippetHTML;
    block.appendChild(snippetDiv);

    container.appendChild(block);
  });

  viewPanel.appendChild(container);
}

/**
 * Renders generic text (e.g., .txt, .js, .json) as preformatted code.
 * @param {string} filename - File path
 * @param {HTMLElement} viewPanel - The container to render into
 * @param {string} serverBase - Base path
 */
export async function renderText(filename, viewPanel, serverBase) {
  console.log(`[ViewText] Rendering text: ${filename}`);
  viewPanel.innerHTML = '';
  try {
    const response = await fetch(`${serverBase}/${filename}`);
    const text = await response.text();
    const pre = document.createElement('pre');
    pre.style.cssText = 'background:#f4f4f4; padding:1em; overflow:auto; white-space:pre-wrap;';
    pre.textContent = text;
    viewPanel.appendChild(pre);
  } catch (err) {
    console.error('Error loading text file:', err);
    viewPanel.innerHTML = '<p>Error loading text file.</p>';
  }
}

// Expose globally (optional)
window.renderHTML = renderHTML;
window.renderCSS = renderCSS;
window.renderText = renderText;
