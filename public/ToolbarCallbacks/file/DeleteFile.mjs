// Nodevision/public/ToolbarCallbacks/file/DeleteFile.mjs
// This creates the callback needed for delteting files

export default async function DeleteFile() {
  const selectedFile = window.selectedFilePath;

  if (!selectedFile) {
    alert("No file selected.");
    return;
  }

  const confirmed = confirm(`Are you sure you want to delete "${selectedFile}"?`);
  if (!confirmed) return;

  try {
    const response = await fetch("/api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: selectedFile })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Delete failed");

    console.log("File deleted successfully:", selectedFile);

    // ✅ Refresh File Manager
    if (typeof window.refreshFileManager === "function") {
      await window.refreshFileManager(window.currentDirectoryPath || "");
    }

  } catch (err) {
    console.error("Failed to delete file:", err);
    alert(`Failed to delete file: ${err.message}`);
  }
}
