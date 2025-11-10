// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/saveWYSIWYGFile.mjs
// Purpose: Saves the contents of the WYSIWYG HTML editor back to disk via the Nodevision API.

function showMessage(msg) {
  const el = document.getElementById("message");
  if (el) {
    el.textContent = msg;
    setTimeout(() => (el.textContent = ""), 3000);
  }
}

function showError(msg) {
  const el = document.getElementById("errorMessage");
  if (el) el.textContent = msg;
  console.error(msg);
}

/**
 * Save the contents of the WYSIWYG editor to the specified file.
 * @param {string} filePath - The full path to the file to save.
 */
export async function saveWYSIWYGFile(filePath) {
  const editor = document.getElementById("editor");
  if (!editor) {
    showError("Editor not found");
    return;
  }

  const raw = editor.innerHTML;
  const content =
    typeof window.formatHtml === "function" ? window.formatHtml(raw) : raw;

  console.log("💾 Saving WYSIWYG file:", filePath);
  console.log("📄 Content being sent:", content.slice(0, 300) + "...");

  try {
    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, content }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `HTTP ${response.status}`);
    }

    showMessage("✅ File saved successfully!");
  } catch (err) {
    showError("❌ Error saving file: " + err.message);
  }
}

// Optional global assignment for compatibility
if (typeof window !== "undefined") {
  window.saveWYSIWYGFile = saveWYSIWYGFile;
}
