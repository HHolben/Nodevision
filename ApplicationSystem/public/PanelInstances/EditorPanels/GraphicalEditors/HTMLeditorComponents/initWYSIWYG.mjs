// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/initWYSIWYG.mjs
// This file defines browser-side init WYSIWYG logic for the Nodevision UI. It renders interface components and handles user interactions.

export async function initWYSIWYG(container, filePath) {
  container.innerHTML = `
    <div id="wysiwyg-toolbar" style="border-bottom:1px solid #ccc; padding:4px;">
      <button onclick="document.execCommand('bold')"><b>B</b></button>
      <button onclick="document.execCommand('italic')"><i>I</i></button>
      <button onclick="document.execCommand('underline')"><u>U</u></button>
      <button onclick="document.execCommand('insertUnorderedList')">• List</button>
      <button onclick="document.execCommand('insertOrderedList')">1. List</button>
      <button id="saveWYSIWYG">💾 Save</button>
    </div>
    <div id="wysiwyg-editor" contenteditable="true" style="height:calc(100% - 40px); overflow:auto; padding:8px; outline:none;"></div>
  `;

  const editor = container.querySelector("#wysiwyg-editor");
  const saveButton = container.querySelector("#saveWYSIWYG");

  if (filePath) {
    try {
      const response = await fetch(`/Notebook/${encodeURIComponent(filePath.split("/Notebook/")[1])}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let html = await response.text();

      // 🧹 Strip all <script> tags to prevent execution
      html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");

      editor.innerHTML = html;
    } catch (err) {
      console.error("Error loading HTML file:", err);
      editor.textContent = "⚠️ Failed to load content.";
    }
  }

  // 💾 Save edited HTML back to server
  saveButton.addEventListener("click", async () => {
    const htmlContent = editor.innerHTML;
    const res = await fetch("/saveHTML", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath, content: htmlContent })
    });
    if (res.ok) {
      alert("✅ Saved!");
    } else {
      alert("❌ Failed to save file.");
    }
  });
}
