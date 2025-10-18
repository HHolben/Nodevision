// Nodevision/public/ToolbarCallbacks/file/CopyFile.mjs
//Provides the callback for the Copy File toolbar item

let clipboard = null;

export function CopyFile(filePath) {
  if (!filePath) return alert("No file selected.");
  clipboard = { type: "copy", filePath };
  alert(`Copied: ${filePath}`);
}

export function getClipboard() {
  return clipboard;
}
