// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/MoveFile.mjs
// This provides the callback for the move file toolbar callback.
import { getClipboard, clearClipboard } from "./fileClipboard.mjs";
import { maybePromptLinkMoveImpact } from "./linkMoveImpact.mjs";

function normalizePath(value = "") {
  return String(value || "").replace(/^\/+/, "").replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

function basename(pathValue = "") {
  const parts = normalizePath(pathValue).split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

export async function MoveFile(destinationDir) {
  const clipboard = getClipboard();
  if (!clipboard || clipboard.mode !== "cut" || !clipboard.sourcePath) {
    return alert("No file cut to move.");
  }

  const sourcePath = normalizePath(clipboard.sourcePath);
  const dir = normalizePath(destinationDir || window.currentDirectoryPath || "");
  const fileName = basename(sourcePath);
  const destinationPath = dir ? `${dir}/${fileName}` : fileName;

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
      throw new Error(result?.error || `Move failed (${response.status})`);
    }

    clearClipboard();
    document.dispatchEvent(new CustomEvent("refreshFileManager"));
    await maybePromptLinkMoveImpact({ oldPath: sourcePath, newPath: destinationPath });
  } catch (err) {
    console.error(err);
    alert("An error occurred while moving the file.");
  }
}
