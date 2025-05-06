// === InfoSCAD.js ===
function renderSCAD(filename, infoPanel, serverBase) {
  fetch(serverBase + '/' + filename)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then(text => {
      const pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.fontFamily = 'monospace';
      pre.style.background = '#f9f9f9';
      pre.style.border = '1px solid #ccc';
      pre.style.padding = '10px';
      pre.textContent = text;
      infoPanel.innerHTML = '';
      infoPanel.appendChild(pre);
    })
    .catch(err => {
      console.error('Error loading SCAD file:', err);
      infoPanel.innerHTML = '<p>Error loading SCAD file.</p>';
    });
}
