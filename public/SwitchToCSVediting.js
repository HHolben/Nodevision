/**
 * SwitchToCSVediting.js
 * Enables an Excel-like CSV editing mode within Nodevision.
 *
 * Loads a CSV file into an editable HTML table, allows in-browser edits,
 * and saves changes back to the server in CSV format.
 */

// Utility: parse CSV string into 2D array
function parseCSV(csvText) {
    const rows = csvText.trim().split(/\r?\n/);
    return rows.map(row => row.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/));
  }
  
  // Utility: serialize 2D array into CSV string
  function serializeCSV(data) {
    return data.map(row =>
      row.map(cell => {
        // Escape quotes
        const safe = String(cell).replace(/"/g, '""');
        // Wrap in quotes if contains comma or quote or newline
        return /[",\n]/.test(safe) ? `"${safe}"` : safe;
      }).join(',')
    ).join('\n');
  }
  
  // Build editable table from data array
  function buildTable(data) {
    const table = document.createElement('table');
    table.id = 'csv-editor-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
  
    data.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      row.forEach((cell, colIndex) => {
        const td = document.createElement(rowIndex === 0 ? 'th' : 'td');
        td.contentEditable = 'true';
        td.textContent = cell;
        td.style.border = '1px solid #ccc';
        td.style.padding = '4px';
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    return table;
  }
  
  // Expose save function on window for toolbar access
  window.saveCSVFile = function(filePath) {
    const table = document.getElementById('csv-editor-table');
    if (!table) return;
    const data = Array.from(table.rows).map(tr =>
      Array.from(tr.cells).map(cell => cell.textContent)
    );
    const csv = serializeCSV(data);
  
    fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content: csv })
    })
    .then(res => res.text())
    .then(msg => {
      const status = document.getElementById('csv-message');
      status.textContent = 'CSV saved successfully!';
      setTimeout(() => status.textContent = '', 3000);
    })
    .catch(err => {
      console.error('Error saving CSV:', err);
      document.getElementById('csv-error').textContent = 'Error saving CSV: ' + err.message;
    });
  };
  
  // Add "File > Save CSV" to toolbar
  function updateCSVToolbar(filePath) {
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;
  
    let fileDropdown = toolbar.querySelector('.dropdown[data-category="File"]');
    if (!fileDropdown) {
      fileDropdown = document.createElement('div');
      fileDropdown.className = 'dropdown';
      fileDropdown.setAttribute('data-category', 'File');
  
      const btn = document.createElement('button');
      btn.className = 'dropbtn';
      btn.textContent = 'File';
      fileDropdown.appendChild(btn);
  
      const content = document.createElement('div');
      content.className = 'dropdown-content';
      fileDropdown.appendChild(content);
      toolbar.appendChild(fileDropdown);
    }
  
    const saveItem = document.createElement('button');
    saveItem.textContent = 'Save CSV';
    saveItem.addEventListener('click', e => {
      e.preventDefault();
      window.saveCSVFile(filePath);
    });
    fileDropdown.querySelector('.dropdown-content').appendChild(saveItem);
  }
  
  // Main IIFE: initialize CSV editing mode
  (function() {
    // Determine active node / file path
    let activeNode = window.ActiveNode;
    if (!activeNode) {
      const params = new URLSearchParams(window.location.search);
      activeNode = params.get('activeNode');
    }
    if (!activeNode) return console.error('No activeNode specified for CSV editing');
  
    const filePath = `Notebook/${activeNode}`;
    window.currentActiveFilePath = filePath;
  
    // Switch mode
    if (window.AppState && typeof AppState.setMode === 'function') {
      AppState.setMode('CSV Editing');
    } else {
      window.currentMode = 'CSV Editing';
    }
  
    // Prepare container
    const container = document.getElementById('content-frame-container');
    if (!container) return console.error("#content-frame-container not found");
  
    container.innerHTML = `
      <div id="csv-editor-wrapper">
        <p id="csv-message"></p>
        <p id="csv-error" style="color:red"></p>
      </div>
    `;
  
    // Load CSV contents
    fetch(`/api/fileCSVContent?path=${encodeURIComponent(filePath)}`)
      .then(res => { if (!res.ok) throw new Error('Network error'); return res.text(); })
      .then(csvText => {
        const data = parseCSV(csvText);
        const table = buildTable(data);
        document.getElementById('csv-editor-wrapper').appendChild(table);
        updateCSVToolbar(filePath);
      })
      .catch(err => {
        console.error('Error loading CSV:', err);
        document.getElementById('csv-error').textContent = 'Error loading CSV: ' + err.message;
      });
  })();
  
  // Keyboard navigation: Enter moves down a cell
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.tagName.toLowerCase() === 'td') {
      e.preventDefault();
      const cell = e.target;
      const row = cell.parentElement;
      const table = row.parentElement;
      const colIndex = Array.prototype.indexOf.call(row.cells, cell);
      const rowIndex = Array.prototype.indexOf.call(table.rows, row);
      // Move to next row, same column
      const nextRow = table.rows[rowIndex + 1];
      if (nextRow) {
        nextRow.cells[colIndex].focus();
      }
    }
  });
  