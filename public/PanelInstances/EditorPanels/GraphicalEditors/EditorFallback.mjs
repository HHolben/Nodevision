// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/EditorFallback.mjs
// This fallback graphical editor for unsupported file types displays a warning and allows opening the file in the code editor.

export async function renderEditor(filePath, container) {
  if (!filePath) {
    container.innerHTML = "<em>No file selected.</em>";
    return;
  }

  // Clear container
  container.innerHTML = "";

  // Create warning message
  const warning = document.createElement("div");
  warning.style.padding = "20px";
  warning.style.textAlign = "center";
  warning.style.color = "#b00";
  warning.style.fontWeight = "bold";
  warning.innerText = `⚠️ No graphical editor available for "${filePath}"`;

  // Create button to open code editor
  const btn = document.createElement("button");
  btn.innerText = "Open in Code Editor";
  Object.assign(btn.style, {
    marginTop: "15px",
    padding: "10px 20px",
    cursor: "pointer",
    backgroundColor: "#0078d7",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "14px",
  });

  btn.addEventListener("click", () => {
    try {
      if (window.openCodeEditor) {
        window.openCodeEditor(filePath);
        console.log(`Opening ${filePath} in Code Editor...`);
      } else {
        console.warn("Code Editor function not available.");
      }
    } catch (err) {
      console.error("Error opening Code Editor:", err);
    }
  });

  // Append elements
  container.appendChild(warning);
  container.appendChild(btn);
}
