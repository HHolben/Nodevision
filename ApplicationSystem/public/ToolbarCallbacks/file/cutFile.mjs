// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/cutFile.mjs
// This file defines browser-side cut File logic for the Nodevision UI. It renders interface components and handles user interactions.
import { setClipboard } from "./fileClipboard.mjs";

export default async function cutFile() {
  const sourcePath = window.selectedFilePath;
  if (!sourcePath) {
    alert("No file or directory selected.");
    return;
  }

  setClipboard({
    mode: "cut",
    sourcePath
  });

  alert(`Cut: ${sourcePath}`);
}
