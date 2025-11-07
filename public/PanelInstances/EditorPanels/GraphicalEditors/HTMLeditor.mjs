// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs
// Loads a WYSIWYG editing environment for HTML (and related) files into a Nodevision panel cell


export async function renderEditor(filePath, container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; width:100%; height:100%;">
      <div style="background:#f0f0f0; padding:8px; border-bottom:1px solid #ccc;">
        <strong>HTML Graphical Editor</strong> — ${filePath}
      </div>
      <iframe
        src="/Notebook/${filePath.split('/').pop()}"
        style="flex:1; width:100%; border:none;"
      ></iframe>
    </div>
  `;
}
export async function setupPanel(cell, panelVars = {}) {
  cell.innerHTML = `<div class="panel-header">WYSIWYG HTML Editor</div>
  <iframe id="html-editor-frame" style="flex:1;width:100%;border:none;"></iframe>`;

  // 🟢 Automatically use the file path from the selected FileView panel, if available
  let filePath =
    panelVars.path ||
    panelVars.filePath ||
    window.selectedFilePath ||
    (window.activeCell && window.activeCell.dataset?.filePath) ||
    "";

  if (!filePath) {
    console.warn("⚠️ No file path provided to HTMLeditor; defaulting to blank workspace.");
  }

  const ext = (filePath.split(".").pop() || "html").toLowerCase();

  const scriptBundles = {
    html: [
      "saveWYSIWYGFile.js",
      "toolbar.js",
      "fileLoader.js",
      "tabHandler.js",
      "imageHandling.js",
      "clipboardHandler.js",
      "imageCropper.js",
      "editRasterToolbar.js",
      "initWYSIWYG.js",
    ],
    md: ["loadMarkdown.js", "saveMarkdown.js", "initMarkdownEditor.js"],
    json: ["loadJSON.js", "saveJSON.js", "initJSONEditor.js"],
    csv: ["loadCSV.js", "saveCSV.js", "initCSVEditor.js"],
  };

  const scripts = scriptBundles[ext] || scriptBundles.html;

  // Compute the base directory relative to this file
  const basePath = "/SwitchToWYSIWYGediting/";

  console.log("🟢 HTMLeditor setup:", { filePath, ext, scripts });

  // Prepare iframe environment for WYSIWYG
  const iframe = cell.querySelector("#html-editor-frame");
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>HTML Editor - ${filePath}</title>
    </head>
    <body style="margin:0;padding:0;display:flex;flex-direction:column;height:100%;">
      <div id="editor-root" style="flex:1;display:flex;flex-direction:column;"></div>
    </body>
    </html>
  `);
  doc.close();

  // Load script bundles in sequence inside iframe
  async function loadScriptsSequentially(index = 0) {
    if (index >= scripts.length) return;
    const scriptPath = basePath + scripts[index];
    return new Promise((resolve) => {
      const tag = doc.createElement("script");
      tag.src = scriptPath;
      tag.defer = true;
      tag.onload = () => {
        console.log("✅ Loaded", scriptPath);
        loadScriptsSequentially(index + 1).then(resolve);
      };
      tag.onerror = () => {
        console.warn("⚠️ Failed to load", scriptPath);
        loadScriptsSequentially(index + 1).then(resolve);
      };
      doc.head.appendChild(tag);
    });
  }

  await loadScriptsSequentially(0);

  // 🟢 Pass file path into iframe’s global context
  iframe.contentWindow.filePath = filePath;

  // Enable Ctrl+S saving inside iframe
  doc.addEventListener(
    "keydown",
    (e) => {
      if (
        (navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey) &&
        e.key.toLowerCase() === "s"
      ) {
        e.preventDefault();
        console.log("💾 Saving", filePath);
        const win = iframe.contentWindow;
        if (typeof win.saveWYSIWYGFile === "function") {
          win.saveWYSIWYGFile(filePath);
        } else if (typeof win.saveRasterImage === "function" && win.rasterCanvas) {
          win.saveRasterImage(filePath);
        } else {
          console.warn("⚠️ No save function defined in iframe for", filePath);
        }
      }
    },
    false
  );

  console.log("✅ HTMLeditor panel initialized for:", filePath);
}
