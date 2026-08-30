// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/cutFile.mjs
// This file defines browser-side cut File logic for the Nodevision UI. It renders interface components and handles user interactions.
import { getSelectedFileEntries, setClipboard } from "./fileClipboard.mjs";

export default async function cutFile() {
  const selectedEntries = getSelectedFileEntries();
  const paths = selectedEntries.map((entry) => entry.path);
  if (!paths.length) {
    alert("No file or directory selected.");
    return;
  }

  setClipboard({
    mode: "cut",
    sourcePath: paths[0],
    sourcePaths: paths,
    entries: selectedEntries,
  });

  try {
    await window.nodevisionElectron?.writeNotebookFilesToClipboard?.({ paths, mode: "cut" });
  } catch (err) {
    console.warn("Could not write file cut to the system clipboard:", err);
  }

  alert(paths.length === 1 ? "Cut: " + paths[0] : "Cut " + paths.length + " items");
}
