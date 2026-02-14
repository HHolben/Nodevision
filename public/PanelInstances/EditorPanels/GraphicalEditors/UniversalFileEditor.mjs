// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/UniversalFileEditor.mjs
// Generic editor for any file type:
// - Text-like files: inline text editing + save.
// - Binary files: replace file workflow with base64 save.

const NOTEBOOK_BASE = "/Notebook";
const SAVE_ENDPOINT = "/api/save";
const TEXT_PREVIEW_LIMIT = 2 * 1024 * 1024; // 2 MB

function escapeHTML(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function detectTextFromBytes(uint8) {
  if (!uint8 || uint8.length === 0) return true;
  let suspicious = 0;
  const sampleLen = Math.min(uint8.length, 4096);

  for (let i = 0; i < sampleLen; i += 1) {
    const byte = uint8[i];
    if (byte === 0) return false; // strong binary signal
    if (byte < 7 || (byte > 14 && byte < 32)) suspicious += 1;
  }

  return suspicious / sampleLen < 0.15;
}

function extOf(filePath = "") {
  const parts = String(filePath).toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function likelyTextByExtension(extension) {
  const textLike = new Set([
    "txt", "md", "markdown", "json", "jsonl", "ndjson", "yaml", "yml",
    "xml", "xsd", "xsl", "xslt", "rss", "atom", "svg", "html", "htm",
    "css", "js", "mjs", "ts", "tsx", "jsx", "py", "java", "c", "cpp",
    "h", "hpp", "go", "rs", "php", "sh", "bash", "zsh", "ini", "toml",
    "cfg", "conf", "log", "csv", "tsv", "sql", "tex", "adoc", "rst",
    "scad", "pgn", "gcode", "obj", "ply", "stl", "sdf", "kml"
  ]);
  return textLike.has(extension);
}

async function postSave({ path, content, encoding = "utf8", mimeType }) {
  const payload = { path, content, encoding };
  if (mimeType) payload.mimeType = mimeType;

  const res = await fetch(SAVE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `${res.status} ${res.statusText}`);
  }
}

function setGlobalTextHooks(filePath, getTextFn) {
  window.saveWYSIWYGFile = undefined;
  window.getEditorMarkdown = getTextFn;
  window.saveMDFile = async (path = filePath) => {
    await postSave({ path, content: getTextFn(), encoding: "utf8" });
  };
}

function setGlobalBinaryHook(filePath, getBase64Fn) {
  window.getEditorMarkdown = undefined;
  window.saveMDFile = undefined;
  window.saveWYSIWYGFile = async (path = filePath) => {
    const base64 = getBase64Fn();
    if (!base64) throw new Error("No replacement binary loaded.");
    await postSave({
      path,
      content: base64,
      encoding: "base64",
      mimeType: "application/octet-stream",
    });
  };
}

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = "UniversalEditing";
  window.getEditorMarkdown = undefined;
  window.saveMDFile = undefined;
  window.saveWYSIWYGFile = undefined;

  const wrapper = document.createElement("div");
  wrapper.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "width:100%",
    "height:100%",
    "overflow:hidden",
    "padding:12px",
    "gap:10px",
    "box-sizing:border-box",
  ].join(";");
  container.appendChild(wrapper);

  const header = document.createElement("div");
  header.style.cssText = "font:600 13px/1.4 monospace; color:#222;";
  header.textContent = `Universal Editor — ${filePath}`;
  wrapper.appendChild(header);

  const status = document.createElement("div");
  status.style.cssText = "font:12px/1.4 monospace; color:#555;";
  status.textContent = "Loading file...";
  wrapper.appendChild(status);

  const body = document.createElement("div");
  body.style.cssText = "flex:1; min-height:0; overflow:auto;";
  wrapper.appendChild(body);

  try {
    const res = await fetch(`${NOTEBOOK_BASE}/${filePath}`);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const extension = extOf(filePath);
    const textByExt = likelyTextByExtension(extension);
    const textByBytes = detectTextFromBytes(bytes);
    const isText = textByExt || textByBytes;

    if (isText && bytes.byteLength <= TEXT_PREVIEW_LIMIT) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

      const textarea = document.createElement("textarea");
      textarea.id = "markdown-editor";
      textarea.value = text;
      textarea.spellcheck = false;
      textarea.style.cssText = [
        "width:100%",
        "height:100%",
        "min-height:260px",
        "resize:none",
        "padding:12px",
        "box-sizing:border-box",
        "font:13px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        "border:1px solid #c9c9c9",
        "border-radius:8px",
        "background:#fff",
        "color:#111",
      ].join(";");
      body.appendChild(textarea);

      setGlobalTextHooks(filePath, () => textarea.value);
      status.textContent = `Text mode (${bytes.byteLength.toLocaleString()} bytes)`;
      return;
    }

    let replacementBase64 = "";

    const binaryPanel = document.createElement("div");
    binaryPanel.style.cssText = [
      "border:1px solid #c9c9c9",
      "border-radius:8px",
      "padding:12px",
      "font:13px/1.45 monospace",
      "background:#fafafa",
      "display:flex",
      "flex-direction:column",
      "gap:10px",
    ].join(";");

    binaryPanel.innerHTML = `
      <div><strong>Binary mode</strong></div>
      <div>Size: ${bytes.byteLength.toLocaleString()} bytes</div>
      <div>Extension: ${escapeHTML(extension || "(none)")}</div>
      <div>This file type is not edited inline yet. Use replacement upload below.</div>
    `;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.style.cssText = "max-width:420px;";

    const picked = document.createElement("div");
    picked.style.cssText = "font:12px/1.4 monospace; color:#666;";
    picked.textContent = "No replacement file loaded.";

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const dataURL = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const b64 = String(dataURL).split(",")[1] || "";
      replacementBase64 = b64;
      picked.textContent = `Ready to save replacement: ${file.name} (${file.size.toLocaleString()} bytes)`;
      status.textContent = "Replacement loaded. Press Save to write file.";
    });

    binaryPanel.appendChild(fileInput);
    binaryPanel.appendChild(picked);
    body.appendChild(binaryPanel);

    setGlobalBinaryHook(filePath, () => replacementBase64);
    status.textContent = `Binary mode (${bytes.byteLength.toLocaleString()} bytes)`;
  } catch (err) {
    body.innerHTML = `<div style="color:#b00020;font:13px monospace;">Failed to load file: ${escapeHTML(err.message)}</div>`;
    status.textContent = "Load failed";
  }
}
