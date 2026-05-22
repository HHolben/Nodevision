// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/NewDirectory.mjs
// This file defines browser-side New Directory logic for the Nodevision UI. It renders interface components and handles user interactions.
import { showInputDialog } from "/ui/modals/InputDialog.mjs";
export default async function NewDirectory() {
  let parentPath = window.currentDirectoryPath;

  // Default to root Notebook folder if no directory is selected
  if (!parentPath || parentPath.trim() === "") {
    parentPath = "";
  }

  const folderName = await showInputDialog({
    title: "Create new directory",
    description: "Enter the name of the new directory.",
    placeholder: "MyFolder",
    confirmText: "Create folder",
    cancelText: "Cancel",
    emptyMessage: "Directory name is required.",
    returnTrimmed: true,
  });

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

    // Refresh the active panel after directory creation
    if (typeof window.refreshFileManager === "function") {
      await window.refreshFileManager(parentPath);
    }
    document.dispatchEvent(new CustomEvent("refreshFileManager"));

  } catch (err) {
    console.error('Failed to create directory:', err);
    alert(`Failed to create directory: ${err.message}`);
  }
}
