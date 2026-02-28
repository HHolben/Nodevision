// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewAMF.mjs
// Viewer for AMF (Additive Manufacturing Format) files

export async function renderFile(filePath, panel, iframe, serverBase) {
  panel.innerHTML = '';

  if (!filePath || !filePath.toLowerCase().endsWith('.amf')) {
    panel.innerHTML = `<p>No AMF file selected.</p>`;
    return;
  }

  console.log('[ViewAMF] Loading', filePath);

  try {
    const response = await fetch(`${serverBase}/${filePath}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} – ${response.statusText}`);
    }

    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');

    const parseError = xml.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid AMF XML');
    }

    renderSummary(xml, panel);
    renderRawXML(text, panel);

  } catch (err) {
    console.error('[ViewAMF] Error:', err);
    panel.innerHTML = `
      <p style="color:red;">Error loading AMF file</p>
      <pre>${err.message}</pre>
    `;
  }
}

/* ----------------------------- SUMMARY VIEW ----------------------------- */

function renderSummary(xml, container) {
  const amf = xml.querySelector('amf');
  const unit = amf?.getAttribute('unit') || 'unknown';

  const objects = xml.querySelectorAll('object');
  const materials = xml.querySelectorAll('material');

  let html = `
    <h3>AMF Summary</h3>
    <p><strong>Units:</strong> ${unit}</p>
    <p><strong>Objects:</strong> ${objects.length}</p>
    <p><strong>Materials:</strong> ${materials.length}</p>
  `;

  if (materials.length) {
    html += `<h4>Materials</h4><ul>`;
    materials.forEach(mat => {
      const id = mat.getAttribute('id');
      const name = mat.querySelector('metadata[type="name"]')?.textContent;
      html += `<li>ID ${id}${name ? ` — ${name}` : ''}</li>`;
    });
    html += `</ul>`;
  }

  if (objects.length) {
    html += `<h4>Objects</h4><ul>`;
    objects.forEach(obj => {
      const id = obj.getAttribute('id');
      const vols = obj.querySelectorAll('volume').length;
      html += `<li>Object ${id} (${vols} volume${vols !== 1 ? 's' : ''})</li>`;
    });
    html += `</ul>`;
  }

  container.insertAdjacentHTML('beforeend', html);
}

/* ------------------------------ RAW XML -------------------------------- */

function renderRawXML(text, container) {
  const details = document.createElement('details');
  details.style.marginTop = '1em';

  const summary = document.createElement('summary');
  summary.textContent = 'View raw AMF XML';
  summary.style.cursor = 'pointer';

  const pre = document.createElement('pre');
  pre.textContent = text;
  pre.style.maxHeight = '300px';
  pre.style.overflow = 'auto';
  pre.style.background = '#f7f7f7';
  pre.style.padding = '10px';
  pre.style.border = '1px solid #ccc';

  details.appendChild(summary);
  details.appendChild(pre);
  container.appendChild(details);
}
