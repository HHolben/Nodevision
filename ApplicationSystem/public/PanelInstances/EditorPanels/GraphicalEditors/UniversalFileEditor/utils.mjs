// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/UniversalFileEditor/utils.mjs
// This file defines helper utilities for the UniversalFileEditor module in Nodevision. It detects text content, escapes HTML, and sends save requests to the server API.

const SAVE_ENDPOINT = "/api/save";

export function escapeHTML(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function detectTextFromBytes(uint8) {
  if (!uint8 || uint8.length === 0) return true;
  let suspicious = 0;
  const sampleLen = Math.min(uint8.length, 4096);

  for (let i = 0; i < sampleLen; i += 1) {
    const byte = uint8[i];
    if (byte === 0) return false;
    if (byte < 7 || (byte > 14 && byte < 32)) suspicious += 1;
  }

  return suspicious / sampleLen < 0.15;
}

export function extOf(filePath = "") {
  const parts = String(filePath).toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

export function likelyTextByExtension(extension) {
  const textLike = new Set([
    "txt",
    "md",
    "markdown",
    "json",
    "jsonl",
    "ndjson",
    "yaml",
    "yml",
    "xml",
    "xsd",
    "xsl",
    "xslt",
    "rss",
    "atom",
    "svg",
    "html",
    "htm",
    "css",
    "js",
    "mjs",
    "ts",
    "tsx",
    "jsx",
    "py",
    "java",
    "c",
    "cpp",
    "h",
    "hpp",
    "go",
    "rs",
    "php",
    "sh",
    "bash",
    "zsh",
    "ini",
    "toml",
    "cfg",
    "conf",
    "log",
    "csv",
    "tsv",
    "sql",
    "tex",
    "adoc",
    "rst",
    "scad",
    "pgn",
    "gcode",
    "obj",
    "ply",
    "stl",
    "sdf",
    "kml",
  ]);
  return textLike.has(extension);
}

export async function postSave({ path, content, encoding = "utf8", mimeType }) {
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

export function setGlobalTextHooks(filePath, getTextFn) {
  window.saveWYSIWYGFile = undefined;
  window.getEditorMarkdown = getTextFn;
  window.saveMDFile = async (path = filePath) => {
    await postSave({ path, content: getTextFn(), encoding: "utf8" });
  };
}

export function setGlobalBinaryHook(filePath, getBase64Fn) {
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

