// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/copyFile.mjs
// This file defines browser-side copy File logic for the Nodevision UI. It renders interface components and handles user interactions.
import { getSelectedFileEntries, setClipboard } from "./fileClipboard.mjs";
import { setStatus } from "/StatusBar.mjs";

export default async function copyFile() {
  const selectedEntries = getSelectedFileEntries();
  const paths = selectedEntries.map((entry) => entry.path);
  if (!paths.length) {
    setStatus("Copy failed", "Select a file or directory first");
    return;
  }

  setClipboard({
    mode: "copy",
    sourcePath: paths[0],
    sourcePaths: paths,
    entries: selectedEntries,
  });

  try {
    await window.nodevisionElectron?.writeNotebookFilesToClipboard?.({ paths, mode: "copy" });
  } catch (err) {
    console.warn("Could not write file copy to the system clipboard:", err);
  }

  setStatus("Copied", paths.length === 1 ? paths[0] : String(paths.length) + " items");
}
