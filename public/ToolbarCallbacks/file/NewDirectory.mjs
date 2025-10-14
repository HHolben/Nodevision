// Nodevision/public/ToolbarCallbacks/file/NewDirectory.mjs
export default async function NewDirectory() {
  const parentPath = window.currentDirectoryPath;
  if (!parentPath) {
    console.warn("No directory is currently selected.");
    return;
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

    if (typeof window.fetchDirectoryContents === "function") {
      window.fetchDirectoryContents(parentPath);
    } else {
      console.warn("Cannot refresh directory view: fetchDirectoryContents not defined.");
    }
  } catch (err) {
    console.error('Failed to create directory:', err);
    alert(`Failed to create directory: ${err.message}`);
  }
}
