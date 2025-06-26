// fileCallbacks.js
export const fileCallbacks = {
  saveFile: () => {
    const filePath = window.currentActiveFilePath;
    if (filePath && typeof window.saveWYSIWYGFile === 'function') 
      {
      window.saveWYSIWYGFile(filePath);
    } else {
      console.error("Cannot save: filePath or saveWYSIWYGFile is missing.");
    }
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
};
