// === InfoCSV.js ===
// This file declares a function, renderCSV which imports CSV files from the server, then defines the html to be used to display the CSV files contents in the info pane
function renderCSV(filename, infoPanel, serverBase) {
    fetch(serverBase + '/' + filename)
      .then(response => response.text())
      .then(text => {
        const rows = text.trim().split(/\r?\n/).map(r => r.split(','));
        let html = '<table style="border-collapse:collapse;">';
        // header
        html += '<thead><tr>';
        rows[0].forEach(header => {
          html += `<th style="border:1px solid #ccc;padding:2px">${header}</th>`;
        });
        html += '</tr></thead><tbody>';
        // body
        rows.slice(1).forEach(row => {
          html += '<tr>';
          row.forEach(cell => {
            html += `<td style="border:1px solid #ccc;padding:2px">${cell}</td>`;
          });
          html += '</tr>';
        });
        html += '</tbody></table>';
        infoPanel.innerHTML = html;
      })
      .catch(err => {
        console.error('Error loading CSV:', err);
        infoPanel.innerHTML = '<p>Error loading CSV file.</p>';
      });
  }
  