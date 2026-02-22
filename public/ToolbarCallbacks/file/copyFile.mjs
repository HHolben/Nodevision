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

