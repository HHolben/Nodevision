// === InfoPanel.js ===
var iframe = document.getElementById('content-frame');

function updateInfoPanel(element) {
  var infoPanel = document.getElementById('element-info');
  if (!infoPanel) {
    console.error('Info panel element not found.');
    return;
  }
  
  var serverBase = 'http://localhost:3000/Notebook';
  var infoHTML = '';

  // Cytoscape element
  if (element && typeof element.id === 'function') {
    console.log('updating info panel for ' + element.id());
    infoPanel.innerHTML = '';
    iframe.src = '';

    if (element.isNode && element.isNode()) {
      infoHTML = '<strong>Node:</strong> ' + element.data('label') + '<br>';
      window.ActiveNode = element.id();
      infoHTML += '<strong>ID:</strong> ' + window.ActiveNode + '<br>';
      
      if (element.data('type') === 'region') {
        infoHTML += '<strong>Type:</strong> Region<br>';
        infoHTML += '<button id="expand-btn">Expand</button>';
        if (element.isParent && element.isParent()) {
          infoHTML += '<button id="collapse-btn">Collapse</button>';
        }
        infoPanel.innerHTML = infoHTML;
        attachRegionButtons(element);
        return;
      }
      
      // node file
      var filename = element.id();
      var lower = filename.toLowerCase();
      if (lower.endsWith('.csv')) {
        renderCSV(filename, infoPanel, serverBase);
        return;
      } else if (lower.endsWith('.scad')) {
        renderSCAD(filename, infoPanel, serverBase);
        return;
      } else {
        infoHTML += '<strong>Type:</strong> Node<br>';
        infoPanel.innerHTML = infoHTML;
        renderHTML(filename, iframe, serverBase, 0.5);
        return;
      }
    }
    else if (element.isEdge && element.isEdge()) {
      infoHTML = '<strong>Edge:</strong> ' + element.id() + '<br>';
      infoHTML += '<strong>Source:</strong> ' + element.source().id() + '<br>';
      infoHTML += '<strong>Target:</strong> ' + element.target().id() + '<br>';
      infoHTML += '<strong>Type:</strong> ' + (element.data('type') || 'Edge') + '<br>';
      infoPanel.innerHTML = infoHTML;
      return;
    }
  }

  // plain file selected via fileView
  console.log('selected ' + element);
  var filename = element;
  window.ActiveNode = filename;
  iframe.src = '';
  var lower = filename.toLowerCase();

  if (lower.endsWith('.csv')) {
    renderCSV(filename, infoPanel, serverBase);
    return;
  } else if (lower.endsWith('.scad')) {
    renderSCAD(filename, infoPanel, serverBase);
    return;
    } else if (lower.endsWith('.xml')) {
    window.renderQTI(filename, infoPanel, serverBase);
    return;
    } else {
    infoPanel.innerHTML = '<p>File: ' + filename + '</p>';
    renderHTML(filename, iframe, serverBase, 0.5);
    return;
  }
}

function attachRegionButtons(element) {
  var exp = document.getElementById('expand-btn');
  if (exp) exp.addEventListener('click', function() { expandRegion(element); });
  var col = document.getElementById('collapse-btn');
  if (col) col.addEventListener('click', function() { collapseRegion(element); });
}

// expose globally
window.renderCSV = renderCSV;
window.renderHTML = renderHTML;
window.renderSCAD = renderSCAD;
window.updateInfoPanel = updateInfoPanel;
