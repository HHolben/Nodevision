// Nodevision/public/ToolbarCallbacks/fileCallbacks.js
export const fileCallbacks = {
saveFile: () => {
  const filePath = window.currentActiveFilePath || window.filePath;

  if (!filePath) {
    console.error("Cannot save: filePath is missing.");
    return;
  }

  // Check if we're in SVG editing mode first
  const svgEditor = document.getElementById("svg-editor");
  if (svgEditor && window.currentSaveSVG && typeof window.currentSaveSVG === 'function') {
    console.log("Saving SVG file using Publisher-style editor");
    window.currentSaveSVG();
    return;
  }

  // Check for legacy SVG editing mode
  if (svgEditor) {
    console.log("Saving SVG file using direct method");
    const svgContent = svgEditor.outerHTML;
    
    fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content: svgContent })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log('SVG file saved successfully:', filePath);
        const messageEl = document.getElementById('svg-message');
        if (messageEl) {
          messageEl.textContent = 'SVG saved successfully!';
          messageEl.style.color = 'green';
        }
      } else {
        console.error('Error saving SVG:', data.error);
      }
    })
    .catch(err => {
      console.error('Error saving SVG file:', err);
    });
    return;
  }

  // Prefer Monaco Editor if active
  if (window.monacoEditor && typeof window.monacoEditor.getValue === 'function') {
    const content = window.monacoEditor.getValue();
    fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content: content })
    })
      .then(res => res.text())
      .then(data => {
        console.log('Code file saved successfully:', data);
      })
      .catch(err => {
        console.error('Error saving code file:', err);
      });
    return;
  }

  // Otherwise, fallback to WYSIWYG save
  if (typeof window.saveWYSIWYGFile === 'function') {
    window.saveWYSIWYGFile(filePath);
    return;
  }

  console.error("Cannot save: editor state not recognized.");
},


NewFile: async () => {
  const currentPath = window.currentDirectoryPath;
  if (!currentPath) {
    console.warn("No directory is currently selected.");
    return;
  }

  const fileName = prompt("Enter the name of the new file (include extension):");
  if (!fileName) {
    console.log("File creation cancelled.");
    return;
  }

  const relativePath = currentPath ? `${currentPath}/${fileName}` : fileName;

  try {
    const response = await fetch('/api/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: relativePath })
    });

    // Read response body whether OK or not
    const textOrJson = await response.text();
    const payload = (() => {
      try { return JSON.parse(textOrJson); }
      catch { return textOrJson; }
    })();

    if (!response.ok) {
      // include status and any body text
      throw new Error(`(${response.status}) ${payload}`);
    }

    console.log('File created successfully:', payload);
    // refresh listing
    window.fetchDirectoryContents(currentPath);
  } catch (err) {
    console.error('Failed to create file:', err);
    alert(`Failed to create file: ${err.message}`);
  }
},


  viewNodevisionDeployment: () => {
    const activeNode = window.ActiveNode;
    if (activeNode) {
      const deploymentUrl = `http://localhost:3000/Notebook/${activeNode}`;
      window.open(deploymentUrl, "_blank");
    } else {
      alert("No active node specified in the URL.");
    }
  },
  viewPHPdeployment: () => {
    const activeNode = window.ActiveNode;
    if (activeNode) {
      const deploymentUrl = `http://localhost:8000/Notebook/${activeNode}`;
      window.open(deploymentUrl, "_blank");
    } else {
      alert("No active node specified in the URL.");
    }
  },
  uploadToArduino: async () => {
  const filePath = window.currentActiveFilePath;

  if (!filePath) {
    alert("Cannot upload: no active file.");
    return;
  }

  // First, save the current file
  let content = '';
  if (window.monacoEditor && typeof window.monacoEditor.getValue === 'function') {
    content = window.monacoEditor.getValue();
  } else if (typeof window.saveWYSIWYGFile === 'function') {
    alert("Please save WYSIWYG files manually before uploading to Arduino.");
    return;
  } else {
    alert("Cannot determine editor content for upload.");
    return;
  }

  try {
    // Save to backend
    await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content })
    });

    // Ask user for Arduino board and port
    const fqbn = prompt("Enter Arduino board FQBN (e.g., arduino:avr:uno):", "arduino:avr:uno");
    if (!fqbn) return;

    const port = prompt("Enter Arduino serial port (e.g., /dev/ttyACM0):", "/dev/ttyACM0");
    if (!port) return;

    // Call backend upload endpoint
    const response = await fetch('/api/upload-arduino', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, fqbn, port })
    });

    const resultText = await response.text();
    if (!response.ok) {
      alert(`Arduino upload failed:\n${resultText}`);
    } else {
      alert(`Arduino upload successful:\n${resultText}`);
    }
  } catch (err) {
    console.error("Upload error:", err);
    alert(`Error uploading to Arduino:\n${err.message}`);
  }
},

  NewDirectory: async () => {
    // 1. Grab the current directory from window (set by fetchDirectoryContents)
    const parentPath = window.currentDirectoryPath || '';

    // 2. Ask the user for the new folder’s name
    const folderName = prompt("Enter the name of the new directory:");
    if (!folderName) {
      console.log("Directory creation cancelled.");
      return;
    }

    console.log("→ Creating directory:", folderName, "in", parentPath);

    try {
      // 3. POST to your express route
      const response = await fetch('/api/create-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName, parentPath })
      });

      // 4. Parse whatever the server sends back
      const text = await response.text();
      let payload;
      try { payload = JSON.parse(text); } catch { payload = text; }

      console.log("← Response:", response.status, payload);

      if (!response.ok) {
        // If the server sends { error: "…" }, show that
        const msg = payload && payload.error ? payload.error : payload;
        throw new Error(`${response.status} – ${msg}`);
      }

      alert(`Directory "${folderName}" created.`);
      // 5. Refresh the listing
      window.fetchDirectoryContents(parentPath);
    } catch (err) {
      console.error('Failed to create directory:', err);
      alert(`Failed to create directory: ${err.message}`);
    }
  },
downloadFile: async () => {
  console.log("Downloading: "+ window.ActiveNode)
  const filePath = window.ActiveNode;

  if (!filePath) {
    alert("No file selected to download.");
    return;
  }

  try {
    // Fetch the file content from the server
    const response = await fetch(`/api/downloadFile?path=${encodeURIComponent(filePath)}`);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }

    const blob = await response.blob();

    // Trigger download
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filePath.split("/").pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    console.log(`Downloaded file: ${filePath}`);
  } catch (err) {
    console.error("Download error:", err);
    alert(`Error downloading file:\n${err.message}`);
  }
}


};
