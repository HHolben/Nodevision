// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaIO.mjs
// IO helpers for Insert → Media (file pickers, fetch-to-dataURL/text, and binary dataURL saving).

import { dirname, getActiveEditorNotebookPath, normalizeNotebookPath, notebookHrefFromPath } from "./insertMediaCommon.mjs";

export async function readFileAsDataUrl(file) {
  const f = file;
  if (!f) throw new Error("No file selected");
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Unable to read selected file."));
    r.readAsDataURL(f);
  });
}

export async function readFileAsText(file) {
  const f = file;
  if (!f) throw new Error("No file selected");
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Unable to read selected file as text."));
    r.readAsText(f);
  });
}

export function looksLikeUrlOrAbsPath(value) {
  const s = String(value || "").trim();
  return /^(https?:)?\/\//i.test(s) || s.startsWith("/") || s.startsWith("data:");
}

export function notebookSourceFromPath(notebookPath, editorNotebookPath = "") {
  const normalized = normalizeNotebookPath(notebookPath);
  if (!normalized) return "";
  const mode = window.NodevisionState?.currentMode || "";
  if (mode === "EPUBediting") return notebookHrefFromPath(normalized);

  const strip = (p) => String(p || "").replace(/^Notebook\/?/i, "");
  const split = (p) => String(p || "").replace(/\\/g, "/").split("/").filter(Boolean);
  const fromDir = strip(dirname(editorNotebookPath || getActiveEditorNotebookPath()));
  const from = split(fromDir);
  const to = split(strip(normalized));
  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) i += 1;
  const up = new Array(Math.max(0, from.length - i)).fill("..");
  const down = to.slice(i);
  const rel = [...up, ...down].join("/");
  return rel || (to[to.length - 1] || "");
}

export async function fetchUrlAsDataUrl(url) {
  const target = String(url || "").trim();
  if (!target) throw new Error("Missing URL");
  const res = await fetch(target);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Unable to read fetched data."));
    r.readAsDataURL(blob);
  });
}

export async function fetchUrlAsText(url) {
  const target = String(url || "").trim();
  if (!target) throw new Error("Missing URL");
  const res = await fetch(target);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}

export function dataUrlFromText(text, mimeType = "text/plain") {
  const t = String(text ?? "");
  const mime = String(mimeType || "text/plain").trim() || "text/plain";
  return `data:${mime};charset=utf-8,${encodeURIComponent(t)}`;
}

export async function saveNotebookBinaryFromDataUrl(notebookPath, dataUrl, fallbackMime = "application/octet-stream") {
  const path = normalizeNotebookPath(notebookPath);
  if (!path) throw new Error("Missing notebook path");
  const raw = String(dataUrl || "").trim();
  const match = raw.match(/^data:([^;]+);base64,(.*)$/i);
  if (!match) throw new Error("Expected a base64 data URL");
  const mimeType = (match[1] || "").trim() || fallbackMime;
  const base64 = match[2] || "";
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      content: base64,
      encoding: "base64",
      mimeType,
    }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || `${res.status} ${res.statusText}`);
  }
  return path;
}

