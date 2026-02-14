// Shared helpers for family editors.

const SAVE_ENDPOINT = "/api/save";
const NOTEBOOK_BASE = "/Notebook";

export function resetEditorHooks() {
  window.getEditorMarkdown = undefined;
  window.saveMDFile = undefined;
  window.getEditorHTML = undefined;
  window.saveWYSIWYGFile = undefined;
}

export function ensureNodevisionState(mode = "FamilyEditing") {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = mode;
}

export function createBaseLayout(container, title) {
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "width:100%",
    "height:100%",
    "padding:12px",
    "box-sizing:border-box",
    "gap:10px",
    "overflow:hidden",
  ].join(";");

  const header = document.createElement("div");
  header.style.cssText = "font:600 13px/1.4 monospace;color:#222;";
  header.textContent = title;

  const status = document.createElement("div");
  status.style.cssText = "font:12px/1.4 monospace;color:#555;";
  status.textContent = "Loading...";

  const body = document.createElement("div");
  body.style.cssText = "flex:1;min-height:0;overflow:auto;";

  wrapper.appendChild(header);
  wrapper.appendChild(status);
  wrapper.appendChild(body);
  container.appendChild(wrapper);

  return { wrapper, header, status, body };
}

export async function fetchArrayBuffer(filePath) {
  const res = await fetch(`${NOTEBOOK_BASE}/${filePath}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.arrayBuffer();
}

export async function fetchText(filePath) {
  const res = await fetch(`${NOTEBOOK_BASE}/${filePath}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}

export async function saveText(path, content) {
  await postSave({ path, content, encoding: "utf8" });
}

export async function saveBase64(path, base64, mimeType = "application/octet-stream") {
  await postSave({ path, content: base64, encoding: "base64", mimeType });
}

async function postSave(payload) {
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

export function fileExt(path = "") {
  const p = String(path).toLowerCase().split(".");
  return p.length > 1 ? p.pop() : "";
}

export function escapeHTML(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

