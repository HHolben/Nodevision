// Nodevision/public/InfoCSS.js
// Purpose: TODO: Add description of module purpose
(async () => {
  async function InfoCSS(filePath, infoPanel) {
    infoPanel.innerHTML = ''; // clear previous content

    // Load CSS file
    let cssContent = '';
    try {
      const res = await fetch(`/Notebook/${filePath}`);
      cssContent = await res.text();
    } catch (err) {
      infoPanel.innerHTML = `<p style="color:red;">Failed to load CSS: ${err}</p>`;
      return;
    }

    // Load samples
    let samples = {};
    try {
      const res = await fetch('/cssPreviewSamples.json');
      samples = await res.json();
    } catch {
      samples = {};
    }

    // Extract selectors (naive regex)
    const selectorRegex = /([^{]+)\s*\{/g;
    const selectors = [];
    let match;
    while ((match = selectorRegex.exec(cssContent)) !== null) {
      selectors.push(match[1].trim());
    }

    // Create a container for all previews
    const container = document.createElement('div');
    container.style.cssText = 'font-family:sans-serif; padding:1em;';
    
    // Add a <style> block scoped to container
    const styleEl = document.createElement('style');
    styleEl.textContent = cssContent;
    container.appendChild(styleEl);

    // Add preview blocks
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

    infoPanel.appendChild(container);
  }

  window.InfoCSS = InfoCSS;
})();
