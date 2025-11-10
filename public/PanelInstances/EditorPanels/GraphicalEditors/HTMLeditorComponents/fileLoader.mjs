// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/fileLoader.mjs
// Purpose: Loads a file's HTML content into the WYSIWYG editor container.

export async function loadFileContents(filePath, callback) {
  if (!filePath) {
    console.error("❌ No filePath provided to loadFileContents()");
    return;
  }

  try {
    const response = await fetch(`/api/fileCodeContent?path=${encodeURIComponent(filePath)}`);
    if (!response.ok) throw new Error(response.statusText);

    const data = await response.json();
    const editor = document.getElementById("editor");

    if (editor) {
      editor.innerHTML = data.content ?? "";
      if (typeof callback === "function") callback(editor);
    } else {
      console.warn("⚠️ No #editor element found in DOM when loading:", filePath);
    }
  } catch (err) {
    console.error("❌ Error loading file:", err);
    const errEl = document.getElementById("errorMessage");
    if (errEl) errEl.textContent = err.message;
  }
}

// Optional: make this globally accessible (for compatibility with other scripts)
if (typeof window !== "undefined") {
  window.loadFileContents = loadFileContents;
}
