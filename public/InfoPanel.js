var iframe = document.getElementById('content-frame');

function updateInfoPanel(element) {
  const infoPanel = document.getElementById('element-info');
  if (!infoPanel) {
    console.error('Info panel element not found.');
    return;
  }
  
  let infoHTML = '';
  const serverBase = window.location.origin + '/Notebook';

  // Cytoscape element handling
  if (element && typeof element.id === 'function') {
    console.log("updating info panel for " + element.id());
    
    if (element.isNode && element.isNode()) {
      infoHTML = `<strong>Node:</strong> ${element.data('label')}<br>`;
      window.ActiveNode = element.id();
      infoHTML += `<strong>ID:</strong> ${window.ActiveNode}<br>`;

      if (element.data('type') === 'region') {
        infoHTML += `<strong>Type:</strong> Region<br>`;
        iframe.src = '';
        infoHTML += `<button id="expand-btn" aria-label="Expand region">Expand</button>`;
        if (element.isParent && element.isParent()) {
          infoHTML += `<button id="collapse-btn" aria-label="Collapse region">Collapse</button>`;
        }
      } else {
        infoHTML += `<strong>Type:</strong> Node<br>`;
        iframe.onload = null;
        iframe.src = `${serverBase}/${element.id()}`;
        iframe.onerror = function() {
          iframe.srcdoc = '<p>Error loading content.</p>';
        };
        iframe.onload = function() {
          const scale = 0.5;
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const styleEl = iframeDoc.createElement('style');
          styleEl.innerHTML = `body { transform: scale(${scale}); transform-origin: 0 0; width: ${100/scale}%; height: ${100/scale}%; }`;
          iframeDoc.head.appendChild(styleEl);
        };
      }
    }
    else if (element.isEdge && element.isEdge()) {
      infoHTML = `<strong>Edge:</strong> ${element.id()}<br>`;
      infoHTML += `<strong>Source:</strong> ${element.source().id()}<br>`;
      infoHTML += `<strong>Target:</strong> ${element.target().id()}<br>`;
      infoHTML += `<strong>Type:</strong> ${element.data('type') || 'Edge'}<br>`;
      iframe.src = '';
    }
    
    infoPanel.innerHTML = infoHTML;

    // region buttons
    if (element.data('type') === 'region') {
      const expandBtn = document.getElementById('expand-btn');
      if (expandBtn) expandBtn.addEventListener('click', () => expandRegion(element));
      if (element.isParent && element.isParent()) {
        const collapseBtn = document.getElementById('collapse-btn');
        if (collapseBtn) collapseBtn.addEventListener('click', () => collapseRegion(element));
      }
    }
  }
  
  // Plain file handling (non-Cytoscape element)
  else {
    console.log("selected " + element);
    window.ActiveNode = element;
    iframe.src = '';

    // CSV file: fetch and render as table
    if (typeof element === 'string' && element.toLowerCase().endsWith('.csv')) {
      fetch(`${serverBase}/${element}`)
        .then(response => response.text())
        .then(text => {
          const rows = text.trim().split(/\r?\n/).map(r => r.split(','));
          let tableHTML = '<table style="border-collapse: collapse;">';
          // Header
          tableHTML += '<thead><tr>';
          rows[0].forEach(header => {
            tableHTML += `<th style="border: 1px solid #ccc; padding: 2px;">${header}</th>`;
          });
          tableHTML += '</tr></thead>';
          
          // Body
          tableHTML += '<tbody>';
          rows.slice(1).forEach(row => {
            tableHTML += '<tr>';
            row.forEach(cell => {
              tableHTML += `<td style="border: 1px solid #ccc; padding: 2px;">${cell}</td>`;
            });
            tableHTML += '</tr>';
          });
          tableHTML += '</tbody></table>';
          
          infoPanel.innerHTML = tableHTML;
        })
        .catch(err => {
          console.error('Error loading CSV:', err);
          infoPanel.innerHTML = '<p>Error loading CSV file.</p>';
        });
    }
    
    // Other file types (e.g., HTML)
    else {
      infoHTML = `<p>File: ${element}</p>`;
      infoPanel.innerHTML = infoHTML;
      iframe.src = `${serverBase}/${element}`;
    }
  }
}
