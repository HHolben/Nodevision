// Nodevision/public/InfoPanel.js
// Purpose: Refresh the file on display in the info panel.

import { renderSTL } from './InfoSTL.js';
import { renderCSV } from './InfoCSV.js';
import { renderSCAD } from './InfoSCAD.js';
import { renderHTML } from './InfoHTML.js';
import { renderKML } from './InfoKML.js';
import { renderRasterImage } from './InfoPanelRaster.js'; // optional separation for raster
// Add other imports like InfoSVG.js, InfoPDF.js, etc.

const iframe = document.getElementById('content-frame');

export function updateInfoPanel(element) {
  const infoPanel = document.getElementById('element-info');
  if (!infoPanel) {
    console.error('Info panel element not found.');
    return;
  }

  const serverBase = 'http://localhost:3000/Notebook';
  let infoHTML = '';

  // Cytoscape element
  if (element && typeof element.id === 'function') {
    console.log('updating info panel for ' + element.id());
    infoPanel.innerHTML = '';
    iframe.src = '';

    if (element.isNode && element.isNode()) {
      infoHTML = `<strong>Node:</strong> ${element.data('label')}<br>`;
      const activeNode = element.id();
      infoHTML += `<strong>ID:</strong> ${activeNode}<br>`;

      if (element.data('type') === 'region') {
        infoHTML += `<strong>Type:</strong> Region<br>`;
        if (element.isParent && element.isParent()) {
          infoHTML += `<button id="collapse-btn">Collapse</button>`;
        }
        infoHTML += `<button id="expand-btn">Expand</button>`;
        infoPanel.innerHTML = infoHTML;
        attachRegionButtons(element);
        return;
      }

      const filename = element.id();
      const lower = filename.toLowerCase();
      if (lower.endsWith('.csv')) return renderCSV(filename, infoPanel, serverBase);
      if (lower.endsWith('.scad')) return renderSCAD(filename, infoPanel, serverBase);

      infoHTML += `<strong>Type:</strong> Node<br>`;
      infoPanel.innerHTML = infoHTML;
      return renderHTML(filename, iframe, serverBase, 0.5);
    }

    // Edge element
    if (element.isEdge && element.isEdge()) {
      infoHTML = `<strong>Edge:</strong> ${element.id()}<br>`;
      infoHTML += `<strong>Source:</strong> ${element.source().id()}<br>`;
      infoHTML += `<strong>Target:</strong> ${element.target().id()}<br>`;
      infoHTML += `<strong>Type:</strong> ${element.data('type') || 'Edge'}<br>`;
      infoPanel.innerHTML = infoHTML;
      return;
    }
  }

  // Plain file selected via fileView
  const filename = element;
  const lower = filename.toLowerCase();
  iframe.src = '';

  if (lower.endsWith('.csv')) return renderCSV(filename, infoPanel, serverBase);
  if (lower.endsWith('.scad')) return renderSCAD(filename, infoPanel, serverBase);
  if (lower.endsWith('.stl')) return renderSTL(filename);
  if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].some(ext => lower.endsWith(ext))) {
    return renderRasterImage(filename, infoPanel, serverBase);
  }

  // Fallback: render as HTML
  infoPanel.innerHTML = `<p>File: ${filename}</p>`;
  return renderHTML(filename, iframe, serverBase, 0.5);
}

function attachRegionButtons(element) {
  const exp = document.getElementById('expand-btn');
  if (exp) exp.addEventListener('click', () => expandRegion(element));
  const col = document.getElementById('collapse-btn');
  if (col) col.addEventListener('click', () => collapseRegion(element));
}
