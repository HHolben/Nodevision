// Nodevision/ApplicationSystem/public/Commands/handlers/FileCommands.mjs
// This module adapts safe Notebook file commands to Nodevision's existing file APIs.

import { emitNodevisionEvent } from "../NodevisionEventRegistry.mjs";

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data?.error || `Request failed with ${response.status}.`);
  return data;
}

export async function readFileCommand([path]) {
  const data = await readJson(await fetch(`/api/file?path=${encodeURIComponent(path)}`, { cache: "no-store" }));
  return data.content ?? "";
}

export async function saveFileCommand([path, content]) {
  const data = await readJson(await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, sourcePath: path, content }),
  }));
  emitNodevisionEvent("file.saved", { path });
  window.dispatchEvent(new CustomEvent("nodevision-file-saved", { detail: { filePath: path } }));
  return { ok: true, path, backupCreated: Boolean(data.backupCreated) };
}

export async function createFileCommand([path]) {
  const response = await fetch("/api/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (response.ok) return { ok: true, path };
  const text = await response.text().catch(() => "");
  throw new Error(text || `Create failed with ${response.status}.`);
}
