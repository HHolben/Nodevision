export default async function NewDirectory() {
  let parentPath = window.currentDirectoryPath;

  // Default to root Notebook folder if no directory is selected
  if (!parentPath || parentPath.trim() === "") {
    parentPath = "";
  }

  const folderName = prompt("Enter the name of the new directory:");
  if (!folderName) {
    console.log("Directory creation cancelled.");
    return;
  }

  const relativePath = parentPath ? `${parentPath}/${folderName}` : folderName;

  try {
    const response = await fetch('/api/create-directory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentPath, folderName })
    });

    const textOrJson = await response.text();
    const payload = (() => {
      try { return JSON.parse(textOrJson); }
      catch { return textOrJson; }
    })();

    if (!response.ok) {
      throw new Error(`(${response.status}) ${payload}`);
    }

    console.log('Directory created successfully:', payload);

    // ✅ Immediately refresh File Manager after directory creation
    await window.refreshFileManager(parentPath);

  } catch (err) {
    console.error('Failed to create directory:', err);
    alert(`Failed to create directory: ${err.message}`);
  }
}
