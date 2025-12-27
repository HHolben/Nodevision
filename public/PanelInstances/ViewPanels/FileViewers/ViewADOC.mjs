// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewADOC.mjs
// Purpose: Display AsciiDoc (.adoc) files as a readable formatted preview

export async function renderFile(filePath, panel) {
  const serverBase = '/Notebook';
  panel.innerHTML = '';

  if (!filePath || !filePath.toLowerCase().endsWith('.adoc')) {
    panel.innerHTML = `<p>No AsciiDoc file selected.</p>`;
    return;
  }

  console.log('[ViewADOC] loading', filePath);

  try {
    const response = await fetch(`${serverBase}/${filePath}`);
    if (!response.ok)
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);

    const text = await response.text();
    renderAsciiDoc(text, panel);

  } catch (err) {
    console.error('[ViewADOC] Error:', err);
    panel.innerHTML = `
      <p style="color:red;">
        Error loading AsciiDoc file: ${err.message}
      </p>`;
  }
}

/* --------------------------- RENDERER --------------------------- */

function renderAsciiDoc(text, container) {
  const wrapper = document.createElement('div');
  wrapper.style.fontFamily = 'serif';
  wrapper.style.lineHeight = '1.6';
  wrapper.style.padding = '1em';
  wrapper.style.maxWidth = '900px';

  const lines = text.split('\n');
  let html = '';

  for (let line of lines) {
    // Section titles
    if (/^={1,6}\s+/.test(line)) {
      const level = line.match(/^=+/)[0].length;
      const title = escapeHTML(line.replace(/^=+\s*/, ''));
      html += `<h${Math.min(level, 6)}>${title}</h${Math.min(level, 6)}>`;
      continue;
    }

    // Unordered lists
    if (/^\*\s+/.test(line)) {
      html += `<ul><li>${escapeHTML(line.replace(/^\*\s+/, ''))}</li></ul>`;
      continue;
    }

    // Ordered lists
    if (/^\.\s+/.test(line)) {
      html += `<ol><li>${escapeHTML(line.replace(/^\.\s+/, ''))}</li></ol>`;
      continue;
    }

    // Literal blocks
    if (line.startsWith('----')) {
      html += `<hr>`;
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      html += `<br>`;
      continue;
    }

    // Default paragraph
    html += `<p>${escapeHTML(line)}</p>`;
  }

  wrapper.innerHTML = `
    <h3>AsciiDoc Preview</h3>
    <p style="font-size:0.8em;color:#666;">
      Simplified preview. Advanced AsciiDoc features are not rendered.
    </p>
    ${html}
  `;

  container.appendChild(wrapper);
}

/* ---------------------------- UTILS ---------------------------- */

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
