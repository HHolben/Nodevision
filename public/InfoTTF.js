// === InfoTTF.js ===
/**
 * Fetch and render TTF font metadata into an info panel.
 *
 * @param {string} filename   - The relative path to the .ttf file within the Notebook folder.
 * @param {HTMLElement} infoPanel - The DOM element where info should be injected.
 * @param {string} serverBase - Base URL of your Nodevision server (e.g. '/api').
 */
function renderTTF(filename, infoPanel, serverBase) {
  // Build the URL for your server endpoint that returns JSON metadata.
  // You’ll need a matching server route like:
  //    GET /api/font-info?file=fonts/MyFont.ttf
  const url = `${serverBase}/font-info?file=${encodeURIComponent(filename)}`;

  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(info => {
      // Build a simple HTML table of key → value pairs
      let html = '<table style="border-collapse:collapse;">';
      for (const [key, value] of Object.entries(info)) {
        html += `
          <tr>
            <th style="border:1px solid #ccc;padding:4px;text-align:left;">${key}</th>
            <td style="border:1px solid #ccc;padding:4px;">${value}</td>
          </tr>`;
      }
      html += '</table>';
      infoPanel.innerHTML = html;
    })
    .catch(err => {
      console.error('Error loading font info:', err);
      infoPanel.innerHTML = '<p>Error loading font metadata.</p>';
    });
}

// Example usage in your InfoPanel.js:
document.getElementById('fontSelect').addEventListener('change', e => {
  const filename  = e.target.value;              // e.g. "fonts/MyFont.ttf"
  const serverBase = '/api';                     // adjust to your server mounting
  const infoPanel = document.getElementById('infoPanel');
  renderTTF(filename, infoPanel, serverBase);
});

export { renderTTF };
