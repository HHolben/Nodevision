import { showInputDialog } from '/ui/modals/InputDialog.mjs';

export default async function NewFile() {
  let currentPath = window.currentDirectoryPath;

  // Default to root Notebook folder if no directory is selected
  if (!currentPath || currentPath.trim() === "") {
    currentPath = "";
  }
  const fileName = await showInputDialog({
    title: "Create new file",
    description: "Enter the file name (include extension).",
    placeholder: "example.txt",
    confirmText: "Create file",
    cancelText: "Cancel",
    emptyMessage: "A file name is required.",
  });

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

    const textOrJson = await response.text();
    const payload = (() => {
      try { return JSON.parse(textOrJson); }
      catch { return textOrJson; }
    })();

    if (!response.ok) {
      throw new Error(`(${response.status}) ${payload}`);
    }

    console.log('File created successfully:', payload);

    // Refresh the active panel after creation
    if (typeof window.refreshFileManager === "function") {
      await window.refreshFileManager(currentPath);
    }
    document.dispatchEvent(new CustomEvent("refreshFileManager"));

  } catch (err) {
    console.error('Failed to create file:', err);
    alert(`Failed to create file: ${err.message}`);
  }
}
