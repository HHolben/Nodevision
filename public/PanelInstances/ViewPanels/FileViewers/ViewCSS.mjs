// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewCSS.mjs
// Purpose: Preview CSS selectors with live sample rendering

export async function renderFile(filePath, viewPanel, iframe, serverBase) {
  viewPanel.innerHTML = '';

  let cssContent = '';
  try {
    const res = await fetch(`${serverBase}/${filePath}`);
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
