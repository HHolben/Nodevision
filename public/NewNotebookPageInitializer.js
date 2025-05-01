window.initializeNewNotebookPage = function() {
    console.log('Initializing new notebook page...');
  
    const fileName = document.getElementById('fileNameInput').value.trim();
    const fileExtension = document.getElementById('fileExtension').value;
  
    if (!fileName) {
      alert('Please enter a file name.');
      return;
    }
  
    // Timestamp in UTC
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];               // YYYY-MM-DD
    const timeString = now.toISOString().split('T')[1].split('Z')[0]; // HH:MM:SS
  
    // Build content based on extension
    let newContent;
    switch (fileExtension) {
      case '.html':
        newContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8"><title>${fileName}</title></head>
  <body>
    <h1>${fileName}</h1>
    <p>Created on ${dateString} at ${timeString} UTC</p>
  </body>
  </html>`;
        break;
      case '.php':
        newContent = `
  <?php
    echo '<h1>${fileName}</h1>';
    echo '<p>Created on ${dateString} at ${timeString} UTC</p>';
  ?>`;
        break;
      case '.js':
        newContent = `
  // ${fileName}.js
  console.log('Created on ${dateString} at ${timeString} UTC');
  `;
        break;
      case '.ipynb':
        newContent = JSON.stringify({
          cells: [
            { cell_type: 'markdown', metadata: {}, source: [
              `# ${fileName}`,
              `*Created on ${dateString} at ${timeString} UTC*`
            ] }
          ],
          metadata: {},
          nbformat: 4,
          nbformat_minor: 5
        }, null, 2);
        break;
      default:
        alert('Unsupported extension.');
        return;
    }
  
    // Determine target path (inside selected region or root)
    const region = window.ActiveNode || '';
    const filePath = region
      ? `${region}/${fileName}${fileExtension}`
      : `${fileName}${fileExtension}`;
  
    // POST to your existing /api/initialize
    fetch('/api/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: filePath, htmlContent: newContent })
    })
    .then(res => {
      if (!res.ok) throw new Error(res.statusText);
      return res.text();
    })
    .then(msg => {
      console.log(msg);
      alert(`Page created: ${filePath}`);
      // Add node to Cytoscape if loaded
      if (window.cy) {
        const node = {
          group: 'nodes',
          data: {
            id: filePath,
            label: fileName,
            link: filePath,
            parent: region
          }
        };
        window.cy.add(node);
        window.cy.layout({ name: 'cose' }).run();
      }
    })
    .catch(err => {
      console.error(err);
      alert('Failed to create page.');
    });
  };
  
  // wire up button (in case toolbar re-renders)
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('createNotebookPageBtn');
    if (btn) {
      btn.addEventListener('click', window.initializeNewNotebookPage);
    }
  });
  