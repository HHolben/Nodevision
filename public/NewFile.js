/*
 * Nodevision/public/NewFile.js
 * Adds a "New File" button to the toolbar, prompts for filename and extension,
 * generates initial content template, and creates the file via POST /api/file.
 */

(function() {
    // Generate default template based on extension
    function generateTemplate(name, ext) {
      const now = new Date();
      const iso = now.toISOString();
      const date = iso.split('T')[0];                // YYYY-MM-DD
      const time = iso.split('T')[1].split('Z')[0];  // HH:MM:SS
      switch (ext) {
        case '.html':
          return `<!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8"><title>${name}</title></head>
  <body>
    <h1>${name}</h1>
    <p>Created on ${date} at ${time} UTC</p>
  </body>
  </html>`;
        case '.js':
          return `// ${name}${ext}\n// Created on ${date} at ${time} UTC\nconsole.log('Hello from ${name}${ext}');`;
        case '.css':
          return `/* ${name}${ext} - Created on ${date} at ${time} UTC */\nbody {\n  font-family: sans-serif;\n}`;
        case '.md':
          return `# ${name}${ext}\n*Created on ${date} at ${time} UTC*\n\n`;
        default:
          return '';
      }
    }
  
    // Main handler to create a new file
    async function initializeNewFile() {
      const input = prompt('Enter new file name with extension (e.g., "Notes.md"):');
      if (!input) return;
  
      const parts = input.trim().split('.');
      if (parts.length < 2) {
        alert('Please include an extension, e.g. "MyFile.html"');
        return;
      }
  
      const ext = '.' + parts.pop();
      const name = parts.join('.');
      const template = generateTemplate(name, ext);
  
      // Determine target directory from global state or default to root
      const region = window.ActiveNode || '';
      const relativePath = region ? `${region}/${name}${ext}` : `${name}${ext}`;
  
      try {
        const res = await fetch('/api/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: relativePath, content: template })
        });
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
  
        alert(`File created: ${relativePath}`);
  
        // Optionally refresh file tree
        if (window.refreshFileTree) {
          window.refreshFileTree(region);
        }
        // Optionally add node to Cytoscape if present
        if (window.cy) {
          const node = {
            group: 'nodes',
            data: { id: relativePath, label: name, link: relativePath, parent: region }
          };
          window.cy.add(node);
          window.cy.layout({ name: 'cose' }).run();
        }
      } catch (err) {
        console.error('Failed to create file:', err);
        alert('Error creating file. See console for details.');
      }
    }
  
    // Inject button into toolbar
    function addButton() {
      const toolbar = document.getElementById('toolbar') || document.body;
      if (document.getElementById('createNewFileBtn')) return;
  
      const btn = document.createElement('button');
      btn.id = 'createNewFileBtn';
      btn.textContent = 'New File';
      btn.style.marginLeft = '8px';
      btn.addEventListener('click', initializeNewFile);
      toolbar.appendChild(btn);
    }
  
    document.addEventListener('DOMContentLoaded', addButton);
    // If toolbar re-renders dynamically, you can re-add
    document.addEventListener('toolbar-rendered', addButton);
  })();
  