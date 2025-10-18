// Nodevision/public/ToolbarCallbacks/file/CutFile.mjs
// Provides the callback for the copy file Toolbar item
let clipboard = null;

export function CutFile(filePath) {
  if (!filePath) return alert("No file selected.");
  clipboard = { type: "cut", filePath };
  alert(`Cut: ${filePath}`);
}

export function getClipboard() {
  return clipboard;
}
