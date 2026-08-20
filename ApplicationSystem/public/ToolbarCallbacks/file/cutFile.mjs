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

  try {
    await window.nodevisionElectron?.writeNotebookFilesToClipboard?.({ paths: [sourcePath], mode: "cut" });
  } catch (err) {
    console.warn("Could not write file cut to the system clipboard:", err);
  }

  alert(`Cut: ${sourcePath}`);
}
