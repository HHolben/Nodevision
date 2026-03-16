// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/EditorFallback.mjs
// This file defines browser-side Editor Fallback logic for the Nodevision UI. It renders interface components and handles user interactions.

export async function renderEditor(filePath, container, options = {}) {
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

  const errorDetail = options?.error || options?.details || null;
  container.appendChild(warning);

  if (errorDetail) {
    const detail = document.createElement("pre");
    detail.style.margin = "12px auto 0";
    detail.style.maxWidth = "920px";
    detail.style.textAlign = "left";
    detail.style.whiteSpace = "pre-wrap";
    detail.style.wordBreak = "break-word";
    detail.style.padding = "12px";
    detail.style.borderRadius = "6px";
    detail.style.background = "rgba(0,0,0,0.05)";
    detail.style.border = "1px solid rgba(0,0,0,0.15)";
    detail.style.color = "#222";

    const lines = [];
    if (typeof errorDetail === "string") {
      lines.push(errorDetail);
    } else {
      if (errorDetail.modulePath) lines.push(`Module: ${errorDetail.modulePath}`);
      if (errorDetail.editorFile) lines.push(`Editor: ${errorDetail.editorFile}`);
      if (errorDetail.extension) lines.push(`Extension: ${errorDetail.extension}`);
      if (errorDetail.message) lines.push(`Error: ${errorDetail.message}`);
      if (errorDetail.stack) lines.push(String(errorDetail.stack));
    }

    detail.textContent = lines.filter(Boolean).join("\n");
    container.appendChild(detail);
  }

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
  container.appendChild(btn);
}
