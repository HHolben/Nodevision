// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/pasteFile.mjs
// This file defines browser-side paste File logic for the Nodevision UI. It renders interface components and handles user interactions.
import { clearClipboard, getClipboard } from "./fileClipboard.mjs";
import { maybePromptLinkMoveImpact } from "./linkMoveImpact.mjs";
import { pasteExternalFilesFromNativeClipboard, readNativeFileClipboardSummary } from "/FileInterop/NotebookExternalFileInterop.mjs";

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
  if (window.NodevisionState?.activePanelType === "GraphManager" && typeof window.getGraphManagerPasteDestination === "function") {
    return normalizePath(window.getGraphManagerPasteDestination() || "");
  }

  const selected = currentSelection();
  if (selected?.dataset?.isDirectory === "true") {
    return normalizePath(selected.dataset.fullPath || "");
  }
  return normalizePath(window.currentDirectoryPath || "");
}

function splitNameAndExt(filename = "") {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) return { base: filename, ext: "" }; // hidden files stay intact
  return {
    base: filename.slice(0, lastDot),
    ext: filename.slice(lastDot) // includes dot
  };
}

async function nextAvailableName(dir, desiredName) {
  const cleanDir = normalizePath(dir || "");
  const res = await fetch(`/api/files?path=${encodeURIComponent(cleanDir)}`);
  if (!res.ok) return desiredName; // fallback: let server decide
  const data = await res.json().catch(() => []);
  const existing = new Set(
    Array.isArray(data)
      ? data.map((entry) => normalizePath(entry?.name || ""))
      : []
  );

  if (!existing.has(desiredName)) return desiredName;

  const { base, ext } = splitNameAndExt(desiredName);
  let counter = 2;
  while (existing.has(`${base}_${counter}${ext}`)) {
    counter += 1;
  }
  return `${base}_${counter}${ext}`;
}

async function pasteNativeFileClipboard(destinationDir) {
  try {
    const result = await pasteExternalFilesFromNativeClipboard({ destinationDir });
    if (result.handled && result.success && result.count) {
      if (typeof window.refreshFileManager === "function") await window.refreshFileManager(window.currentDirectoryPath || "");
      if (typeof window.refreshGraphManager === "function") await window.refreshGraphManager({ fit: true, reason: "external-file-paste" });
      return true;
    }
    if (result.handled && result.success && !result.count) {
      alert("Clipboard did not contain readable files.");
      return true;
    }
  } catch (err) {
    console.error("Failed to paste files from the system clipboard:", err);
    alert("Failed to paste files: " + (err.message || err));
    return true;
  }
  return false;
}

async function shouldPreferNativeFileClipboard(sourcePath) {
  try {
    const summary = await readNativeFileClipboardSummary();
    if (!summary.handled || !summary.hasFiles) return false;
    const notebookPaths = Array.isArray(summary.notebookPaths) ? summary.notebookPaths.map(normalizePath) : [];
    return !notebookPaths.includes(normalizePath(sourcePath));
  } catch (err) {
    console.warn("Could not inspect the system file clipboard:", err);
    return false;
  }
}

export default async function pasteFile() {
  const clipboard = getClipboard();
  if (!clipboard?.sourcePath || !clipboard?.mode) {
    if (await pasteNativeFileClipboard(destinationDirectory())) return;
    alert("Clipboard is empty.");
    return;
  }

  const sourcePath = normalizePath(clipboard.sourcePath);
  const destinationDir = destinationDirectory();
  if (await shouldPreferNativeFileClipboard(sourcePath)) {
    if (await pasteNativeFileClipboard(destinationDir)) return;
  }
  const fileName = basename(sourcePath);

  let destinationPath = destinationDir ? `${destinationDir}/${fileName}` : fileName;

  // For copy operations, auto-increment name if target exists (file_name -> file_name_2)
  if (clipboard.mode === "copy") {
    const safeName = await nextAvailableName(destinationDir, fileName);
    destinationPath = destinationDir ? `${destinationDir}/${safeName}` : safeName;
  }

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
    if (typeof window.refreshGraphManager === "function") {
      await window.refreshGraphManager({ fit: true, reason: "file-paste" });
    }

    if (clipboard.mode === "cut") {
      await maybePromptLinkMoveImpact({ oldPath: sourcePath, newPath: destinationPath });
    }
  } catch (err) {
    console.error("Failed to paste file or directory:", err);
    alert(`Failed to paste: ${err.message}`);
  }
}
