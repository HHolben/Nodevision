// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/copyFile.mjs
// This file defines browser-side copy File logic for the Nodevision UI. It renders interface components and handles user interactions.
import { setClipboard } from "./fileClipboard.mjs";

export default async function copyFile() {
  const sourcePath = window.selectedFilePath;
  if (!sourcePath) {
    alert("No file or directory selected.");
    return;
  }

  setClipboard({
    mode: "copy",
    sourcePath
  });

  alert(`Copied: ${sourcePath}`);
}
