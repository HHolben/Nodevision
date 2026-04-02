// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/copyFile.mjs
// This file defines browser-side copy File logic for the Nodevision UI. It renders interface components and handles user interactions.
import { setClipboard } from "./fileClipboard.mjs";
import { setStatus } from "/StatusBar.mjs";

export default async function copyFile() {
  const sourcePath = window.selectedFilePath;
  if (!sourcePath) {
    setStatus("Copy failed", "Select a file or directory first");
    return;
  }

  setClipboard({
    mode: "copy",
    sourcePath
  });

  setStatus("Copied", sourcePath);
}
