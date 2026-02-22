function normalizePath(value = "") {
  return String(value).replace(/^\/+/, "").replace(/\/+/g, "/");
}

function dirname(pathValue = "") {
  const parts = normalizePath(pathValue).split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

export default async function renameFile() {
  const selectedPath = normalizePath(window.selectedFilePath || "");
  if (!selectedPath) {
    alert("No file or directory selected.");
    return;
  }

  const currentName = selectedPath.split("/").pop();
  const parentDir = dirname(selectedPath);
  const nextName = prompt("Enter new name:", currentName);
  if (!nextName || !nextName.trim()) return;

  const trimmedName = nextName.trim();
  const newPath = parentDir ? `${parentDir}/${trimmedName}` : trimmedName;

  try {
    const response = await fetch("/api/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldPath: selectedPath,
        newPath
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || `Rename failed (${response.status})`);
    }

    window.selectedFilePath = newPath;
    if (typeof window.refreshFileManager === "function") {
      await window.refreshFileManager(window.currentDirectoryPath || "");
    }
  } catch (err) {
    console.error("Failed to rename file or directory:", err);
    alert(`Failed to rename: ${err.message}`);
  }
}

