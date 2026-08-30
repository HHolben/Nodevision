// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/pasteFile.mjs
// This file defines browser-side paste File logic for the Nodevision UI. It renders interface components and handles user interactions.
import { clearClipboard, getClipboard, getClipboardEntries, setClipboard } from "./fileClipboard.mjs";
import { maybePromptLinkMoveImpact } from "./linkMoveImpact.mjs";
import { pasteExternalFilesFromNativeClipboard, readNativeFileClipboardSummary } from "/FileInterop/NotebookExternalFileInterop.mjs";

function normalizePath(value = "") {
  return String(value).replace(/^\/+/, "").replace(/\/+/g, "/");
}

function basename(pathValue = "") {
  const parts = normalizePath(pathValue).split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function isSubPath(candidate = "", root = "") {
  const cleanCandidate = normalizePath(candidate);
  const cleanRoot = normalizePath(root);
  if (!cleanCandidate || !cleanRoot) return false;
  return cleanCandidate === cleanRoot || cleanCandidate.startsWith(cleanRoot + "/");
}

function filterNestedClipboardEntries(entries = []) {
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

function retainClipboardEntries(mode, entries = []) {
  const paths = entries.map((entry) => entry.path);
  if (!paths.length) {
    clearClipboard();
    return;
  }
  setClipboard({
    mode,
    sourcePath: paths[0],
    sourcePaths: paths,
    entries,
  });
}

function currentSelection() {
  const selected = [...document.querySelectorAll("#file-list a.selected")];
  return selected.length === 1 ? selected[0] : null;
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
  const mode = clipboard?.mode === "cut" ? "cut" : clipboard?.mode === "copy" ? "copy" : null;
  const clipboardEntries = getClipboardEntries(clipboard);

  if (!mode || !clipboardEntries.length) {
    if (await pasteNativeFileClipboard(destinationDirectory())) return;
    alert("Clipboard is empty.");
    return;
  }

  const destinationDir = destinationDirectory();
  if (await shouldPreferNativeFileClipboard(clipboardEntries[0]?.path || "")) {
    if (await pasteNativeFileClipboard(destinationDir)) return;
  }

  const entriesToPaste = filterNestedClipboardEntries(clipboardEntries);
  const endpoint = mode === "cut" ? "/api/cut" : "/api/copy";
  const successes = [];
  const failedEntries = [];
  const errors = [];

  for (const entry of entriesToPaste) {
    const sourcePath = normalizePath(entry.path || "");
    const fileName = basename(sourcePath);
    if (!sourcePath || !fileName) continue;

    let destinationPath = destinationDir ? destinationDir + "/" + fileName : fileName;
    if (mode === "copy") {
      const safeName = await nextAvailableName(destinationDir, fileName);
      destinationPath = destinationDir ? destinationDir + "/" + safeName : safeName;
    }

    if (!destinationPath || sourcePath === destinationPath) {
      errors.push(sourcePath + ": choose a different destination");
      failedEntries.push(entry);
      continue;
    }

    if (entry.isDirectory && isSubPath(destinationDir, sourcePath)) {
      errors.push(sourcePath + ": cannot move a folder into itself or one of its subfolders");
      failedEntries.push(entry);
      continue;
    }

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
        throw new Error(payload?.error || "Paste failed (" + response.status + ")");
      }

      successes.push({ sourcePath, destinationPath, isDirectory: Boolean(entry.isDirectory) });
    } catch (err) {
      failedEntries.push(entry);
      errors.push(sourcePath + ": " + (err?.message || err));
    }
  }

  if (mode === "cut") {
    retainClipboardEntries("cut", failedEntries);
  }

  for (const moved of successes) {
    if (mode === "cut") {
      await maybePromptLinkMoveImpact({ oldPath: moved.sourcePath, newPath: moved.destinationPath });
    }
  }

  if (typeof window.refreshFileManager === "function") {
    await window.refreshFileManager(window.currentDirectoryPath || "");
  }
  if (typeof window.refreshGraphManager === "function") {
    await window.refreshGraphManager({ fit: true, reason: "file-paste" });
  }

  if (!successes.length && !errors.length) {
    alert("Choose a different destination.");
    return;
  }

  if (errors.length) {
    console.error("Failed to paste some files:", errors);
    alert("Some files could not be pasted:" + String.fromCharCode(10) + errors.join(String.fromCharCode(10)));
  }
}
