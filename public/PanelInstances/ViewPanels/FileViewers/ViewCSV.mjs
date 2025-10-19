// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewCSV.mjs
// Purpose: Render CSV files in a table view

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    const response = await fetch(`${serverBase}/${filename}`);
    const text = await response.text();

    const rows = text.trim().split(/\r?\n/).map(r => r.split(','));
    let html = '<table style="border-collapse:collapse;font-family:sans-serif;">';

    html += '<thead><tr>';
    rows[0].forEach(header => {
      html += `<th style="border:1px solid #ccc;padding:4px;background:#eee;">${header}</th>`;
    });
    html += '</tr></thead><tbody>';

    rows.slice(1).forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        html += `<td style="border:1px solid #ccc;padding:4px;">${cell}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    viewPanel.innerHTML = html;
  } catch (err) {
    console.error('Error loading CSV:', err);
    viewPanel.innerHTML = '<p style="color:red;">Error loading CSV file.</p>';
  }
}
