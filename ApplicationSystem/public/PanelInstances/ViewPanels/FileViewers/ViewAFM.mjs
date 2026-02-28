// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewAFM.mjs
// Purpose: Display Adobe Font Metrics (.afm) files in a readable table

export async function renderFile(filePath, panel) {
  const serverBase = '/Notebook';
  panel.innerHTML = '';

  if (!filePath || !filePath.toLowerCase().endsWith('.afm')) {
    panel.innerHTML = `<p>No AFM file selected.</p>`;
    return;
  }

  console.log('[ViewAFM] loading', filePath);

  try {
    const response = await fetch(`${serverBase}/${filePath}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    const text = await response.text();
    const afm = parseAFM(text);

    renderFontInfo(afm.info, panel);
    renderGlyphTable(afm.glyphs, panel);

  } catch (err) {
    console.error('[ViewAFM] Error:', err);
    panel.innerHTML = `<p style="color:red;">Error loading AFM file: ${err.message}</p>`;
  }
}

/* ------------------------------ AFM PARSER ------------------------------ */

function parseAFM(text) {
  const lines = text.split(/\r?\n/);

  const info = {};
  const glyphs = [];

  let inCharMetrics = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed === 'StartCharMetrics') {
      inCharMetrics = true;
      continue;
    }

    if (trimmed === 'EndCharMetrics') {
      inCharMetrics = false;
      continue;
    }

    if (inCharMetrics) {
      const glyph = parseCharMetric(trimmed);
      if (glyph) glyphs.push(glyph);
      continue;
    }

    // Global font info
    const space = trimmed.indexOf(' ');
    if (space > 0) {
      const key = trimmed.slice(0, space);
      const value = trimmed.slice(space + 1);
      info[key] = value;
    }
  }

  return { info, glyphs };
}

function parseCharMetric(line) {
  // Example:
  // C 65 ; WX 722 ; N A ; B 14 0 708 674 ;
  const parts = line.split(';').map(p => p.trim());

  const glyph = {};

  for (const part of parts) {
    const [key, ...rest] = part.split(' ');
    const value = rest.join(' ');

    switch (key) {
      case 'C':
        glyph.code = parseInt(value, 10);
        break;
      case 'WX':
        glyph.width = parseInt(value, 10);
        break;
      case 'N':
        glyph.name = value;
        break;
      case 'B':
        glyph.bbox = value;
        break;
    }
  }

  return glyph.name ? glyph : null;
}

/* ---------------------------- RENDERING ---------------------------- */

function renderFontInfo(info, container) {
  let html = `
    <h3>Font Information</h3>
    <table style="border-collapse:collapse;">
      <tbody>
  `;

  for (const [key, value] of Object.entries(info)) {
    html += `
      <tr>
        <td style="border:1px solid #ccc;padding:4px;font-weight:bold;">${key}</td>
        <td style="border:1px solid #ccc;padding:4px;">${value}</td>
      </tr>
    `;
  }

  html += `</tbody></table>`;
  container.insertAdjacentHTML('beforeend', html);
}

function renderGlyphTable(glyphs, container) {
  const max = Math.min(glyphs.length, 200);

  let html = `
    <h3>Glyph Metrics (showing ${max} of ${glyphs.length})</h3>
    <table style="border-collapse:collapse;">
      <thead>
        <tr>
          <th style="border:1px solid #ccc;padding:4px">Code</th>
          <th style="border:1px solid #ccc;padding:4px">Name</th>
          <th style="border:1px solid #ccc;padding:4px">Width</th>
          <th style="border:1px solid #ccc;padding:4px">Bounding Box</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (let i = 0; i < max; i++) {
    const g = glyphs[i];
    html += `
      <tr>
        <td style="border:1px solid #ccc;padding:4px">${g.code ?? ''}</td>
        <td style="border:1px solid #ccc;padding:4px">${g.name}</td>
        <td style="border:1px solid #ccc;padding:4px">${g.width ?? ''}</td>
        <td style="border:1px solid #ccc;padding:4px">${g.bbox ?? ''}</td>
      </tr>
    `;
  }

  html += `</tbody></table>`;
  container.insertAdjacentHTML('beforeend', html);
}
