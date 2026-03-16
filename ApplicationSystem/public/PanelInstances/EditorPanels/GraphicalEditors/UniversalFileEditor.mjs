// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/UniversalFileEditor.mjs
// This file defines browser-side Universal File Editor logic for the Nodevision UI. It renders interface components and handles user interactions.
// - Text-like files: inline text editing + save.
// - Binary files: replace file workflow with base64 save.

import {
  detectTextFromBytes,
  escapeHTML,
  extOf,
  likelyTextByExtension,
  setGlobalBinaryHook,
  setGlobalTextHooks,
} from "./UniversalFileEditor/utils.mjs";

const NOTEBOOK_BASE = "/Notebook";
const TEXT_PREVIEW_LIMIT = 2 * 1024 * 1024; // 2 MB

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
