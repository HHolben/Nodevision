// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewALTO.mjs
// This module loads and renders ALTO XML files, displaying OCR text in reading order with structural grouping.

export async function renderFile(filePath, panel) {
  const serverBase = '/Notebook';
  panel.innerHTML = '';

  if (!filePath || !filePath.toLowerCase().endsWith('.xml')) {
    panel.innerHTML = `<p>No ALTO XML file selected.</p>`;
    return;
  }

  console.log('[ViewALTO] loading', filePath);

  try {
    const response = await fetch(`${serverBase}/${filePath}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    const xmlText = await response.text();
    const xml = new DOMParser().parseFromString(xmlText, 'application/xml');

    if (xml.querySelector('parsererror')) {
      throw new Error('Invalid XML document.');
    }

    if (!xml.documentElement.localName.toLowerCase().includes('alto')) {
      throw new Error('Not an ALTO XML document.');
    }

    renderALTO(xml, panel);

  } catch (err) {
    console.error('[ViewALTO] Error:', err);
    panel.innerHTML = `
      <p style="color:red;">Error loading ALTO file.</p>
      <pre>${err.message}</pre>
    `;
  }
}

/* ------------------------------ RENDERING ------------------------------ */

function renderALTO(xml, container) {
  const pages = xml.querySelectorAll('Page');
  if (!pages.length) {
    container.innerHTML = '<p>No pages found in ALTO document.</p>';
    return;
  }

  const root = document.createElement('div');
  root.style.fontFamily = 'serif';
  root.style.lineHeight = '1.4';

  pages.forEach((page, pageIndex) => {
    const pageDiv = document.createElement('section');
    pageDiv.style.border = '1px solid #ccc';
    pageDiv.style.margin = '1em 0';
    pageDiv.style.padding = '0.5em';

    const heading = document.createElement('h3');
    heading.textContent = `Page ${pageIndex + 1}`;
    heading.style.borderBottom = '1px solid #ddd';
    pageDiv.appendChild(heading);

    renderPage(page, pageDiv);
    root.appendChild(pageDiv);
  });

  container.appendChild(root);
}

function renderPage(page, container) {
  const blocks = page.querySelectorAll('TextBlock');

  blocks.forEach(block => {
    const blockDiv = document.createElement('div');
    blockDiv.style.marginBottom = '0.75em';

    const lines = block.querySelectorAll('TextLine');

    lines.forEach(line => {
      const lineDiv = document.createElement('div');
      lineDiv.style.whiteSpace = 'nowrap';

      const strings = line.querySelectorAll('String');

      strings.forEach(str => {
        const span = document.createElement('span');
        span.textContent = str.getAttribute('CONTENT') || '';
        span.style.marginRight = '0.25em';

        // Optional metadata (hover)
        span.title = buildTooltip(str);
        lineDiv.appendChild(span);
      });

      blockDiv.appendChild(lineDiv);
    });

    container.appendChild(blockDiv);
  });
}

/* ------------------------------ HELPERS ------------------------------ */

function buildTooltip(node) {
  const attrs = ['HPOS', 'VPOS', 'WIDTH', 'HEIGHT', 'WC'];
  return attrs
    .filter(a => node.hasAttribute(a))
    .map(a => `${a}: ${node.getAttribute(a)}`)
    .join('\n');
}
