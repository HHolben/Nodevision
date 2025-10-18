// Nodevision/public/ToolbarCallbacks/file/RenameFile.mjs
// Provides the callback for the Rename File Toolbar item

export async function RenameFile(filePath) {
  if (!filePath) return alert("No file selected.");
  const newName = prompt("Enter new name:", filePath.split("/").pop());
  if (!newName || newName.trim() === "") return;

  try {
    const response = await fetch("/renameFile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath, newName })
    });

    const result = await response.json();
    if (result.success) {
      alert(`Renamed to: ${newName}`);
      document.dispatchEvent(new CustomEvent("refreshFileManager"));
    } else {
      alert(`Error renaming file: ${result.error}`);
    }
  } catch (err) {
    console.error(err);
    alert("An error occurred while renaming the file.");
  }
}
