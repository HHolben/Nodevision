// Nodevision/ApplicationSystem/public/FileInterop/NotebookExternalFileInterop.mjs
// This file provides browser-side file interoperation helpers so Nodevision panels can import files from desktop file managers while keeping writes inside the active Notebook.

export function normalizeNotebookPath(value = "") {
  let clean = String(value || "").replace(/\\/g, "/").trim();
  clean = clean.replace(/^https?:\/\/[^/]+\/Notebook\//i, "");
  clean = clean.replace(/^\/?Notebook\//i, "");
  clean = clean.replace(/^\/+/, "").replace(/\/+/g, "/");
  return clean.split("/").filter((part) => part && part !== "." && part !== "..").join("/");
}

export function notebookPathBasename(pathValue = "") {
  const parts = normalizeNotebookPath(pathValue).split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

export function notebookPathDirname(pathValue = "") {
  const parts = normalizeNotebookPath(pathValue).split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

export function joinNotebookPath(directory = "", child = "") {
  const cleanDir = normalizeNotebookPath(directory);
  const cleanChild = normalizeNotebookPath(child);
  if (!cleanDir) return cleanChild;
  if (!cleanChild) return cleanDir;
  return `${cleanDir}/${cleanChild}`;
}

export function droppedFileTargetPath(destinationDir = "", relativeName = "", fallbackName = "file") {
  const safeRelativeName = normalizeNotebookPath(relativeName || fallbackName);
  return joinNotebookPath(destinationDir, safeRelativeName || fallbackName);
}

export function hasExternalFileTransfer(dataTransfer) {
  if (!dataTransfer) return false;
  if (dataTransfer.files && dataTransfer.files.length > 0) return true;
  return Array.from(dataTransfer.items || []).some((item) => item?.kind === "file");
}

function notebookAssetUrl(relativePath = "") {
  const parts = normalizeNotebookPath(relativePath).split("/").filter(Boolean).map(encodeURIComponent);
  return `${window.location.origin}/Notebook/${parts.join("/")}`;
}

export function setNotebookDragTransfer(event, { path = "", isDirectory = false, nativeDrag = false } = {}) {
  const cleanPath = normalizeNotebookPath(path);
  if (!event?.dataTransfer || !cleanPath) return;
  const url = notebookAssetUrl(cleanPath);
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData("text/plain", cleanPath);
  event.dataTransfer.setData("text/uri-list", url);
  if (!isDirectory) {
    const name = notebookPathBasename(cleanPath) || "nodevision-file";
    event.dataTransfer.setData("DownloadURL", `application/octet-stream:${name}:${url}`);
  }
  if (nativeDrag && typeof window.nodevisionElectron?.startNotebookFileDrag === "function") {
    window.nodevisionElectron.startNotebookFileDrag({ path: cleanPath });
  }
}

function entryFile(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readEntries(reader) {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function collectDirectoryEntryFiles(entry, prefix = "") {
  const reader = entry.createReader();
  const files = [];
  while (true) {
    const batch = await readEntries(reader);
    if (!batch.length) break;
    for (const child of batch) {
      const childPath = prefix ? `${prefix}/${child.name}` : child.name;
      if (child.isDirectory) {
        files.push(...await collectDirectoryEntryFiles(child, childPath));
      } else if (child.isFile) {
        files.push({ file: await entryFile(child), relativePath: childPath });
      }
    }
  }
  return files;
}

export async function collectExternalFiles(dataTransfer) {
  const items = Array.from(dataTransfer?.items || []);
  const files = [];
  for (const item of items) {
    if (item.kind !== "file") continue;
    const entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
    if (entry?.isDirectory) {
      files.push(...await collectDirectoryEntryFiles(entry, entry.name));
      continue;
    }
    const file = entry?.isFile ? await entryFile(entry) : item.getAsFile?.();
    if (file) files.push({ file, relativePath: file.webkitRelativePath || file.name });
  }
  if (files.length) return files;
  return Array.from(dataTransfer?.files || []).map((file) => ({
    file,
    relativePath: file.webkitRelativePath || file.name,
  }));
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function saveBrowserFile(file, targetPath) {
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: targetPath,
      content: await fileToBase64(file),
      encoding: "base64",
      mimeType: file.type || "application/octet-stream",
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.error || `Import failed (${res.status})`);
  }
  return payload;
}

export async function importExternalFilesFromDataTransfer(dataTransfer, { destinationDir = "", onProgress } = {}) {
  const entries = await collectExternalFiles(dataTransfer);
  const imported = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const targetPath = droppedFileTargetPath(destinationDir, entry.relativePath, entry.file?.name || "file");
    await saveBrowserFile(entry.file, targetPath);
    imported.push(targetPath);
    if (typeof onProgress === "function") onProgress({ index: index + 1, total: entries.length, path: targetPath });
  }
  return { success: true, count: imported.length, imported };
}

export async function readNativeFileClipboardSummary() {
  const read = window.nodevisionElectron?.readFileClipboardSummary;
  if (typeof read !== "function") return { handled: false, hasFiles: false };
  const result = await read();
  return { handled: true, ...result };
}

export async function pasteExternalFilesFromNativeClipboard({ destinationDir = "" } = {}) {
  const paste = window.nodevisionElectron?.pasteExternalFilesFromClipboard;
  if (typeof paste !== "function") return { handled: false };
  const result = await paste({ destinationDir: normalizeNotebookPath(destinationDir) });
  return { handled: true, ...result };
}

export function installExternalFileDropTarget(element, { getDestinationDirectory, onImported, onError } = {}) {
  if (!element) return () => {};
  const clear = () => { element.style.outline = ""; };
  const over = (event) => {
    if (!hasExternalFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    element.style.outline = "1px dashed #2563eb";
  };
  const drop = async (event) => {
    if (!hasExternalFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    clear();
    try {
      const destinationDir = typeof getDestinationDirectory === "function" ? getDestinationDirectory(event) : "";
      const result = await importExternalFilesFromDataTransfer(event.dataTransfer, { destinationDir });
      if (typeof onImported === "function") await onImported(result, destinationDir);
    } catch (err) {
      if (typeof onError === "function") onError(err);
      else console.error("External file import failed:", err);
    }
  };
  element.addEventListener("dragover", over);
  element.addEventListener("dragleave", clear);
  element.addEventListener("drop", drop);
  return () => {
    element.removeEventListener("dragover", over);
    element.removeEventListener("dragleave", clear);
    element.removeEventListener("drop", drop);
    clear();
  };
}
