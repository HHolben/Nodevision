// Nodevision/public/PanelInstances/ViewPanels/FileView.mjs
// Purpose: Panel for viewing files

const iframe = document.getElementById('content-frame');

export function updateViewPanel(element) {
  const viewPanel = document.getElementById('element-view');
  if (!viewPanel) {
    console.error('View panel element not found.');
    return;
  }

  viewPanel.innerHTML = ''; // clear panel
  iframe.src = '';

  const serverBase = 'http://localhost:3000/Notebook';

  // Handle Cytoscape elements
  if (element && typeof element.id === 'function') {
    if (element.isNode && element.isNode()) {
      window.ActiveNode = element.id();
      const label = element.data('label') || element.id();
      const type = element.data('type') || 'Node';

      viewPanel.innerHTML = `<strong>${type}:</strong> ${label}<br><strong>ID:</strong> ${window.ActiveNode}`;

      // Special handling for regions
      if (type === 'region') {
        if (element.isParent && element.isParent()) {
          const collapseBtn = document.createElement('button');
          collapseBtn.textContent = 'Collapse';
          collapseBtn.addEventListener('click', () => collapseRegion(element));
          viewPanel.appendChild(collapseBtn);
        }

        const expandBtn = document.createElement('button');
        expandBtn.textContent = 'Expand';
        expandBtn.addEventListener('click', () => expandRegion(element));
        viewPanel.appendChild(expandBtn);
        return;
      }

      // Render file content
      const filename = element.id();
      renderFile(filename, viewPanel, iframe, serverBase);
      return;
    } else if (element.isEdge && element.isEdge()) {
      viewPanel.innerHTML = `
        <strong>Edge:</strong> ${element.id()}<br>
        <strong>Source:</strong> ${element.source().id()}<br>
        <strong>Target:</strong> ${element.target().id()}<br>
        <strong>Type:</strong> ${element.data('type') || 'Edge'}
      `;
      return;
    }
  }

  // Plain file selection
  const filename = element;
  window.ActiveNode = filename;
  renderFile(filename, viewPanel, iframe, serverBase);
}

function renderFile(filename, viewPanel, iframe, serverBase) {
  const lower = filename.toLowerCase();

  if (lower.endsWith('.csv')) {
    renderCSV(filename, viewPanel, serverBase);
  } else if (lower.endsWith('.scad')) {
    renderSCAD(filename, viewPanel, serverBase);
  } else if (lower.endsWith('.stl')) {
    renderSTL(filename, viewPanel, serverBase);
  } else if (lower.endsWith('.svg')) {
    window.InfoSVG(filename, viewPanel, serverBase);
  } else if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].some(ext => lower.endsWith(ext))) {
    renderRasterImage(filename, viewPanel, serverBase);
  } else if (lower.endsWith('.pdf')) {
    renderPDF(filename, viewPanel, serverBase);
  } else {
    // Default: render as HTML in iframe
    renderHTML(filename, iframe, serverBase, 0.5);
  }
}

// Expose globally
window.updateViewPanel = updateViewPanel;
window.renderFile = renderFile;
