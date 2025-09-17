// public/SwitchToCSVediting.js
// Purpose: TODO: Add description of module purpose

/**
 * SwitchToCSVediting.js
 * Fetches a CSV file and renders it as a table of text inputs for easy editing.
 */
(function() {
  // Determine active node and file path
  let activeNode = window.ActiveNode;
  if (!activeNode) {
    const params = new URLSearchParams(window.location.search);
    activeNode = params.get('activeNode');
  }
  if (!activeNode) {
    console.error('SwitchToCSVediting: No activeNode specified');
    return;
  }
  if (!activeNode.toLowerCase().endsWith('.csv')) {
    activeNode += '.csv';
  }
  const filePath = `Notebook/${activeNode}`;
  window.currentActiveFilePath = filePath;

  // Switch application mode
  if (window.AppState && typeof AppState.setMode === 'function') {
    AppState.setMode('CSV Editing');
  } else {
    window.currentMode = 'CSV Editing';
  }

  // Locate the info panel container
  const infoPanel = document.getElementById('content-frame-container');
  if (!infoPanel) {
    console.error("SwitchToCSVediting: '#content-frame-container' not found.");
    return;
  }

  // Render CSV into table of text inputs
  function renderCSV(path, container) {
    fetch(`/api/fileCSVContent?path=${encodeURIComponent(path)}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(text => {
        const rows = text.trim().split(/\r?\n/).map(r => r.split(/,(?=(?:[^"]*"[^"]*")*[^\"]*$)/));
        // build HTML
        let html = '<table style="border-collapse:collapse;width:100%;">';
        // header
        html += '<thead><tr>';
        rows[0].forEach((hdr, i) => {
          html += `<th style="border:1px solid #ccc;padding:4px"><input type=\"text\" value=\"${hdr.replace(/"/g,'&quot;')}\" data-row=\"0\" data-col=\"${i}\" style=\"width:100%;box-sizing:border-box;padding:2px\"></th>`;
        });
        html += '</tr></thead><tbody>';
        // body
        rows.slice(1).forEach((row, ri) => {
          html += '<tr>';
          row.forEach((cell, ci) => {
            const escaped = cell.replace(/"/g,'&quot;');
            html += `<td style="border:1px solid #ccc;padding:0"><input type=\"text\" value=\"${escaped}\" data-row=\"${ri+1}\" data-col=\"${ci}\" style=\"width:100%;box-sizing:border-box;padding:2px\"></td>`;
          });
          html += '</tr>';
        });
        html += '</tbody></table>';

        container.innerHTML = html;
        addSaveButton(path, container);
      })
      .catch(err => {
        console.error('SwitchToCSVediting: Error loading CSV:', err);
        container.innerHTML = `<p style="color:red">Error loading CSV: ${err.message}</p>`;
      });
  }

  // Add Save CSV toolbar button
  function addSaveButton(path, container) {
    if (document.getElementById('save-csv-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'save-csv-btn';
    btn.textContent = 'Save CSV';
    btn.style.margin = '8px';
    btn.addEventListener('click', () => saveCSV(path, container));
    container.insertAdjacentElement('beforebegin', btn);
  }

  // Gather inputs and serialize to CSV
  function saveCSV(path, container) {
    const inputs = Array.from(container.querySelectorAll('input[type=text]'));
    // determine max row/col
    let maxRow = 0, maxCol = 0;
    inputs.forEach(inp => {
      const r = parseInt(inp.dataset.row);
      const c = parseInt(inp.dataset.col);
      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;
    });
    // build 2D array
    const data = Array.from({ length: maxRow+1 }, () => Array(maxCol+1).fill(''));
    inputs.forEach(inp => {
      data[parseInt(inp.dataset.row)][parseInt(inp.dataset.col)] = inp.value;
    });
    // serialize
    const csv = data.map(row => row.map(cell => {
      const s = cell.replace(/"/g,'""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(',')).join('\n');

    fetch('/api/save', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ path, content: csv })
    })
    .then(res => res.ok ? res.text() : Promise.reject(res.statusText))
    .then(() => alert('CSV saved successfully!'))
    .catch(err => alert('Error saving CSV: ' + err));
  }

  // Kick off render
  renderCSV(filePath, infoPanel);
})();
