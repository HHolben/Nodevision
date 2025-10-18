// Nodevision/public/ToolbarCallbacks/file/MoveFile.mjs
// This provides the callback for th move file toolbar callback
import { getClipboard } from "./CutFile.mjs";

export async function MoveFile(destinationDir) {
  const clipboard = getClipboard();
  if (!clipboard || clipboard.type !== "cut") {
    return alert("No file cut to move.");
  }

  try {
    const response = await fetch("/moveFile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourcePath: clipboard.filePath,
        destinationDir
      })
    });

    const result = await response.json();
    if (result.success) {
      alert(`Moved to: ${destinationDir}`);
      document.dispatchEvent(new CustomEvent("refreshFileManager"));
    } else {
      alert(`Error moving file: ${result.error}`);
    }
  } catch (err) {
    console.error(err);
    alert("An error occurred while moving the file.");
  }
}
