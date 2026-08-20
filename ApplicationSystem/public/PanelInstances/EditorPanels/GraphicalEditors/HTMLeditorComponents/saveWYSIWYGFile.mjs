// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/saveWYSIWYGFile.mjs
// This file defines browser-side save WYSIWYGFile logic for the Nodevision UI. It renders interface components and handles user interactions.

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

function serializeWysiwygDocument(fragment = "") {
  const source = String(fragment || "");
  if (/^\s*(?:<!doctype\s+html\b|<html(?:\s|>))/i.test(source)) return source;
  return "<!doctype html>\n<html>\n<head><meta charset=\"UTF-8\"></head>\n<body>\n" + source + "\n</body>\n</html>\n";
}

/**
 * Save the contents of the WYSIWYG editor to the specified file.
 * @param {string} filePath - The full path to the file to save.
 */
export async function saveWYSIWYGFile(filePath) {
  const editor = document.getElementById("editor");
  if (!editor) {
    showError("Editor not found");
    return false;
  }

  const raw = editor.innerHTML;
  const formatted =
    typeof window.formatHtml === "function" ? window.formatHtml(raw) : raw;
  const content = serializeWysiwygDocument(formatted);

  const sourcePath = window.__nvWysiwygActivePath || window.__nvHtmlEditorActivePath || window.currentActiveFilePath || filePath;
  console.log("💾 Saving WYSIWYG file:", filePath);
  console.log("📄 Content being sent:", content.slice(0, 300) + "...");

  try {
    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, sourcePath, content, editorKind: "html-wysiwyg" }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `HTTP ${response.status}`);
    }

    showMessage("✅ File saved successfully!");
    return true;
  } catch (err) {
    showError("❌ Error saving file: " + err.message);
    return false;
  }
}

// Optional global assignment for compatibility
if (typeof window !== "undefined") {
  window.saveWYSIWYGFile = saveWYSIWYGFile;
}
