// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/MoveFile.mjs
// This provides the callback for the move file toolbar callback.
import { clearClipboard, getClipboard, getClipboardEntries, setClipboard } from "./fileClipboard.mjs";
import { maybePromptLinkMoveImpact } from "./linkMoveImpact.mjs";

function normalizePath(value = "") {
  return String(value || "").replace(/^\/+/, "").replace(/\\/g, "/").replace(/\/+/g, "/").trim();
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

function retainCutClipboardEntries(entries = []) {
  const paths = entries.map((entry) => entry.path);
  if (!paths.length) {
    clearClipboard();
    return;
  }
  setClipboard({
    mode: "cut",
    sourcePath: paths[0],
    sourcePaths: paths,
    entries,
  });
}

export async function MoveFile(destinationDir) {
  const clipboard = getClipboard();
  const entries = getClipboardEntries(clipboard);
  if (!clipboard || clipboard.mode !== "cut" || !entries.length) {
    return alert("No file cut to move.");
  }

  const dir = normalizePath(destinationDir || window.currentDirectoryPath || "");
  const failedEntries = [];
  const errors = [];
  const moveEntries = filterNestedClipboardEntries(entries);

  for (const entry of moveEntries) {
    const sourcePath = normalizePath(entry.path || "");
    const fileName = basename(sourcePath);
    const destinationPath = dir ? dir + "/" + fileName : fileName;
    if (!sourcePath || !fileName || sourcePath === destinationPath) {
      failedEntries.push(entry);
      errors.push((sourcePath || "Unknown file") + ": choose a different destination");
      continue;
    }
    if (entry.isDirectory && isSubPath(dir, sourcePath)) {
      failedEntries.push(entry);
      errors.push(sourcePath + ": cannot move a folder into itself or one of its subfolders");
      continue;
    }

    try {
      const response = await fetch("/api/cut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: sourcePath,
          destination: destinationPath
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || "Move failed (" + response.status + ")");
      }

      await maybePromptLinkMoveImpact({ oldPath: sourcePath, newPath: destinationPath });
    } catch (err) {
      failedEntries.push(entry);
      errors.push(sourcePath + ": " + (err?.message || err));
    }
  }

  retainCutClipboardEntries(failedEntries);
  document.dispatchEvent(new CustomEvent("refreshFileManager"));
  if (typeof window.refreshFileManager === "function") {
    await window.refreshFileManager(window.currentDirectoryPath || "");
  }
  if (typeof window.refreshGraphManager === "function") {
    await window.refreshGraphManager({ fit: true, reason: "file-move" });
  }

  if (errors.length) {
    console.error("Some files could not be moved:", errors);
    alert("Some files could not be moved:" + String.fromCharCode(10) + errors.join(String.fromCharCode(10)));
  }
}
