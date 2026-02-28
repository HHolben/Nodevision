import { clearClipboard, getClipboard } from "./fileClipboard.mjs";

function normalizePath(value = "") {
  return String(value).replace(/^\/+/, "").replace(/\/+/g, "/");
}

function basename(pathValue = "") {
  const parts = normalizePath(pathValue).split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function currentSelection() {
  return document.querySelector("#file-list a.selected");
}

function destinationDirectory() {
  const selected = currentSelection();
  if (selected?.dataset?.isDirectory === "true") {
    return normalizePath(selected.dataset.fullPath || "");
  }
  return normalizePath(window.currentDirectoryPath || "");
}

export default async function pasteFile() {
  const clipboard = getClipboard();
  if (!clipboard?.sourcePath || !clipboard?.mode) {
    alert("Clipboard is empty.");
    return;
  }

  const sourcePath = normalizePath(clipboard.sourcePath);
  const destinationDir = destinationDirectory();
  const fileName = basename(sourcePath);
  const destinationPath = destinationDir ? `${destinationDir}/${fileName}` : fileName;

  if (!destinationPath || sourcePath === destinationPath) {
    alert("Choose a different destination.");
    return;
  }

  const endpoint = clipboard.mode === "cut" ? "/api/cut" : "/api/copy";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: sourcePath,
        destination: destinationPath
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || `Paste failed (${response.status})`);
    }

    if (clipboard.mode === "cut") clearClipboard();
    if (typeof window.refreshFileManager === "function") {
      await window.refreshFileManager(window.currentDirectoryPath || "");
    }
  } catch (err) {
    console.error("Failed to paste file or directory:", err);
    alert(`Failed to paste: ${err.message}`);
  }
}

