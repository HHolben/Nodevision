// Nodevision/public/PanelInstances/EditorPanels/HTMLeditor.mjs
// Minimal WYSIWYG HTML editor compatible with saveFile.mjs

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("renderEditor requires a container element");
  container.innerHTML = ""; // clear previous content

  const root = document.createElement("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.height = "100%";
  root.style.width = "100%";
  container.appendChild(root);

  // Editor iframe container
  const iframeWrap = document.createElement("div");
  iframeWrap.style.flex = "1 1 auto";
  iframeWrap.style.display = "flex";
  iframeWrap.style.minHeight = "0";
  root.appendChild(iframeWrap);

  const iframe = document.createElement("iframe");
  iframe.style.border = "none";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.id = `html-editor-iframe-${Date.now()}`;
  iframeWrap.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;

  doc.open();
  doc.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Nodevision WYSIWYG - ${filePath || "(untitled)"}</title>
<style>
html,body { height:100%; margin:0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; background: white; color: #111; }
#editor-root { display:flex; flex-direction:column; height:100%; }
#wysiwyg { flex:1; padding:12px; overflow:auto; outline:none; border:1px solid #ccc; }
</style>
</head>
<body>
<div id="editor-root">
  <div id="wysiwyg" contenteditable="true" spellcheck="true">Loading…</div>
</div>
</body>
</html>`);
  doc.close();

// --- Immediately after writing the document ---
try {
  if (!filePath) return;
  const resp = await fetch(`/Notebook/${filePath}`);
  if (!resp.ok) throw new Error(`Failed to load ${filePath}: ${resp.statusText}`);
  const html = await resp.text();

  const editorDiv = doc.getElementById("wysiwyg");
  if (!editorDiv) throw new Error("Editor div not found in iframe");

  editorDiv.innerHTML = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ""); // neutralize scripts

  // Expose globals for saveFile.mjs
  window.currentActiveFilePath = filePath;
  window.wysiwygEditor = {
    getValue: () => editorDiv.innerHTML,
    setValue: (html) => { editorDiv.innerHTML = html; }
  };

  console.log("🖋 WYSIWYG editor ready for:", filePath);
} catch (err) {
  container.innerHTML = `<div style="padding:12px;color:#900">Error loading file: ${err.message}</div>`;
  console.error("Error loading WYSIWYG file:", err);
}


  // Force iframe load (necessary in some browsers)
  iframe.src = "about:blank";
}
