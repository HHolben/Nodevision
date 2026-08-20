// Nodevision/ApplicationSystem/Desktop/ElectronFileInterop.mjs
// This file registers narrow Electron IPC handlers for desktop file-manager clipboard and drag operations while resolving all Notebook destinations in the main process.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function normalizeNotebookRelativePath(value = "") {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/?Notebook\//i, "")
    .replace(/^\/+/, "")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

function isWithin(parentDir, childPath) {
  const rel = path.relative(parentDir, childPath);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function resolveNotebookPath(notebookDir, relativePath, { allowRoot = false } = {}) {
  const clean = normalizeNotebookRelativePath(relativePath);
  if (!clean && !allowRoot) throw new Error("Notebook file path is required.");
  const resolved = path.join(notebookDir, clean);
  if (!isWithin(notebookDir, resolved)) throw new Error("Notebook path escaped the active Notebook.");
  return { clean, absolutePath: resolved };
}

function fileUriToPath(value = "") {
  const trimmed = String(value || "").trim();
  if (!trimmed.startsWith("file://")) return "";
  try {
    return fileURLToPath(trimmed);
  } catch {
    return "";
  }
}

function parseGnomeCopiedFilesText(text = "") {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { mode: "copy", paths: [] };
  const mode = lines[0].toLowerCase() === "cut" ? "cut" : "copy";
  const paths = lines.slice(1).map(fileUriToPath).filter(Boolean);
  return { mode, paths };
}

function parseUriList(text = "") {
  const paths = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map(fileUriToPath)
    .filter(Boolean);
  return { mode: "copy", paths };
}

function readClipboardFileReferences(clipboard) {
  const formats = typeof clipboard.availableFormats === "function" ? clipboard.availableFormats() : [];
  const gnome = clipboard.readBuffer?.("x-special/gnome-copied-files");
  if (gnome?.length) {
    const parsed = parseGnomeCopiedFilesText(gnome.toString("utf8"));
    if (parsed.paths.length) return { ...parsed, formats };
  }
  const text = clipboard.readText?.() || "";
  const parsed = parseUriList(text);
  const kdeCut = clipboard.readBuffer?.("application/x-kde-cutselection");
  if (kdeCut?.toString("utf8").trim() === "1") parsed.mode = "cut";
  return { ...parsed, formats };
}

async function pathExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function nextAvailableDestination(destinationDir, name) {
  const parsed = path.parse(name || "file");
  let candidate = path.join(destinationDir, name || "file");
  let index = 2;
  while (await pathExists(candidate)) {
    candidate = path.join(destinationDir, `${parsed.name}_${index}${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

async function copyOrMovePath(sourcePath, destinationPath, mode) {
  const stat = await fsp.stat(sourcePath);
  await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
  if (mode === "cut") {
    try {
      await fsp.rename(sourcePath, destinationPath);
      return;
    } catch (err) {
      if (err?.code !== "EXDEV") throw err;
    }
  }
  if (stat.isDirectory()) {
    await fsp.cp(sourcePath, destinationPath, { recursive: true, errorOnExist: true });
    if (mode === "cut") await fsp.rm(sourcePath, { recursive: true, force: false });
    return;
  }
  await fsp.copyFile(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
  if (mode === "cut") await fsp.rm(sourcePath, { force: false });
}

function summarizeFileClipboard({ clipboard, notebookDir }) {
  const refs = readClipboardFileReferences(clipboard);
  const notebookPaths = refs.paths
    .map((sourcePath) => path.resolve(sourcePath))
    .filter((sourcePath) => isWithin(notebookDir, sourcePath))
    .map((sourcePath) => normalizeNotebookRelativePath(path.relative(notebookDir, sourcePath)));
  return {
    success: true,
    hasFiles: refs.paths.length > 0,
    count: refs.paths.length,
    mode: refs.mode,
    notebookPaths,
  };
}

function writeNotebookClipboard({ clipboard, notebookDir, paths = [], mode = "copy" }) {
  const operation = mode === "cut" || mode === "move" ? "cut" : "copy";
  const absolutePaths = paths.map((entry) => resolveNotebookPath(notebookDir, entry).absolutePath);
  const uriList = absolutePaths.map((entry) => pathToFileURL(entry).href).join("\n");
  const gnomePayload = `${operation}\n${uriList}\n`;
  clipboard.writeText?.(uriList);
  clipboard.writeBuffer?.("x-special/gnome-copied-files", Buffer.from(gnomePayload, "utf8"));
  clipboard.writeBuffer?.("text/uri-list", Buffer.from(uriList + "\n", "utf8"));
  clipboard.writeBuffer?.("application/x-kde-cutselection", Buffer.from(operation === "cut" ? "1" : "0"));
  return { success: true, count: absolutePaths.length, mode: operation };
}

async function pasteClipboardIntoNotebook({ clipboard, notebookDir, destinationDir = "" }) {
  const refs = readClipboardFileReferences(clipboard);
  if (!refs.paths.length) return { success: false, noFiles: true, imported: [] };
  const destination = resolveNotebookPath(notebookDir, destinationDir, { allowRoot: true }).absolutePath;
  await fsp.mkdir(destination, { recursive: true });
  const imported = [];
  for (const sourcePath of refs.paths) {
    const source = path.resolve(sourcePath);
    if (!fs.existsSync(source)) continue;
    const target = await nextAvailableDestination(destination, path.basename(source));
    if (isWithin(source, target)) throw new Error("Cannot import a directory into itself.");
    await copyOrMovePath(source, target, refs.mode);
    imported.push(normalizeNotebookRelativePath(path.relative(notebookDir, target)));
  }
  return { success: true, mode: refs.mode, imported, count: imported.length };
}

function startNotebookFileDrag({ event, nativeImage, notebookDir, payload = {} }) {
  const { absolutePath } = resolveNotebookPath(notebookDir, payload.path);
  if (!fs.existsSync(absolutePath)) return;
  const icon = nativeImage?.createEmpty?.();
  event.sender.startDrag({ files: [absolutePath], icon });
}

export function registerElectronFileInterop({ ipcMain, clipboard, nativeImage, getNotebookDir }) {
  const notebookDir = () => path.resolve(getNotebookDir());
  ipcMain.handle("nodevision:read-file-clipboard-summary", () => {
    return summarizeFileClipboard({ clipboard, notebookDir: notebookDir() });
  });
  ipcMain.handle("nodevision:write-notebook-files-to-clipboard", (_event, payload = {}) => {
    return writeNotebookClipboard({ clipboard, notebookDir: notebookDir(), paths: payload.paths || [], mode: payload.mode });
  });
  ipcMain.handle("nodevision:paste-external-files-from-clipboard", async (_event, payload = {}) => {
    return pasteClipboardIntoNotebook({ clipboard, notebookDir: notebookDir(), destinationDir: payload.destinationDir || "" });
  });
  ipcMain.on("nodevision:start-file-drag", (event, payload = {}) => {
    try {
      startNotebookFileDrag({ event, nativeImage, notebookDir: notebookDir(), payload });
    } catch (err) {
      console.warn("[electron-file-interop] start drag failed:", err?.message || err);
    }
  });
}

export const __test = {
  normalizeNotebookRelativePath,
  parseGnomeCopiedFilesText,
  parseUriList,
  summarizeFileClipboard,
};
