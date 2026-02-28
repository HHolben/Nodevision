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

