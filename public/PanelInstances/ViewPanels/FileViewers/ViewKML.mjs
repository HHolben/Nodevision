// Nodevision/public/PanelInstances/ViewPanels/ViewKML.mjs
// Purpose: Render KML (Keyhole Markup Language) files in a Nodevision view panel

export async function setupPanel(panel, instanceVars = {}) {
  const filePath = window.selectedFilePath || instanceVars.filePath || '';
  const serverBase = '/Notebook';

  console.log('ViewKML: loading', filePath);

  panel.innerHTML = '';

  if (!filePath.toLowerCase().endsWith('.kml')) {
    panel.innerHTML = `<p>No KML file selected.</p>`;
    return;
  }

  try {
    const response = await fetch(`${serverBase}/${filePath}`);
    if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);

    const kmlText = await response.text();
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, 'application/xml');

    const placemarks = [...kmlDoc.getElementsByTagName('Placemark')];
    if (placemarks.length === 0) {
      panel.innerHTML = `<p>No placemarks found in this KML file.</p>`;
      return;
    }

    // Create and style table
    const table = document.createElement('table');
    table.style.cssText =
      'width:100%; border-collapse:collapse; font-family:sans-serif; font-size:14px;';

    table.innerHTML = `
      <thead>
        <tr style="background:#f2f2f2; text-align:left;">
          <th style="padding:6px; border:1px solid #ccc;">Name</th>
          <th style="padding:6px; border:1px solid #ccc;">Description</th>
          <th style="padding:6px; border:1px solid #ccc;">Coordinates</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    placemarks.forEach(pm => {
      const name = pm.getElementsByTagName('name')[0]?.textContent || '(unnamed)';
      const desc = pm.getElementsByTagName('description')[0]?.textContent || '';
      const coords = pm.getElementsByTagName('coordinates')[0]?.textContent.trim() || '';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="padding:6px; border:1px solid #ccc;">${name}</td>
        <td style="padding:6px; border:1px solid #ccc;">${desc}</td>
        <td style="padding:6px; border:1px solid #ccc; font-family:monospace;">${coords}</td>
      `;
      tbody.appendChild(row);
    });

    panel.appendChild(table);

  } catch (err) {
    console.error('Error rendering KML:', err);
    panel.innerHTML = `<p style="color:red;">Error loading KML file: ${err.message}</p>`;
  }
}
