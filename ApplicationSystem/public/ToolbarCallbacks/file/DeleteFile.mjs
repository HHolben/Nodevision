// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/DeleteFile.mjs
// This module creates the toolbar callback that deletes the selected file entries after user confirmation.
import { getSelectedFileEntries } from "./fileClipboard.mjs";

function normalizePath(value = "") {
  return String(value || "").replace(/^\/+/, "").replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

function isSubPath(candidate = "", root = "") {
  const cleanCandidate = normalizePath(candidate);
  const cleanRoot = normalizePath(root);
  if (!cleanCandidate || !cleanRoot) return false;
  return cleanCandidate === cleanRoot || cleanCandidate.startsWith(cleanRoot + "/");
}

function filterNestedDeleteEntries(entries = []) {
  return entries.filter((entry) => {
    const entryPath = normalizePath(entry.path || "");
    return !entries.some((candidateParent) => {
      const parentPath = normalizePath(candidateParent.path || "");
      return candidateParent.isDirectory
        && parentPath
        && parentPath !== entryPath
        && isSubPath(entryPath, parentPath);
    });
  });
}

export default async function DeleteFile() {
  const selectedEntries = filterNestedDeleteEntries(getSelectedFileEntries());
  const paths = selectedEntries.map((entry) => entry.path);

  if (!paths.length) {
    alert("No file selected.");
    return;
  }

  const confirmed = confirm(paths.length === 1
    ? "Are you sure you want to delete " + paths[0] + "?"
    : "Are you sure you want to delete " + paths.length + " selected items?");
  if (!confirmed) return;

  const errors = [];
  for (const selectedFile of paths) {
    try {
      const response = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedFile })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Delete failed");

      console.log("File deleted successfully:", selectedFile);
    } catch (err) {
      errors.push(selectedFile + ": " + (err?.message || err));
    }
  }

  if (typeof window.refreshFileManager === "function") {
    await window.refreshFileManager(window.currentDirectoryPath || "");
  }
  if (typeof window.refreshGraphManager === "function") {
    await window.refreshGraphManager({ fit: true, reason: "file-delete" });
  }

  if (errors.length) {
    console.error("Failed to delete some files:", errors);
    alert("Some files could not be deleted:" + String.fromCharCode(10) + errors.join(String.fromCharCode(10)));
  }
}
