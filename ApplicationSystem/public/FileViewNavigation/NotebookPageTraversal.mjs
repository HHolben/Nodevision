// Nodevision/ApplicationSystem/public/FileViewNavigation/NotebookPageTraversal.mjs
// This module finds the previous or next HTML/PHP Notebook page by walking visible Notebook directories in alphabetical depth-first order.

const PAGE_EXTENSIONS = new Set(["html", "htm", "php"]);

export function normalizeNotebookPagePath(value = "") {
  let clean = String(value || "").replace(/\\/g, "/").replace(/[?#].*$/, "").trim();
  clean = clean.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "");
  if (clean.toLowerCase().startsWith("notebook/")) clean = clean.slice("Notebook/".length);
  const parts = [];
  for (const part of clean.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") return "";
    parts.push(part);
  }
  return parts.join("/");
}

function pathParts(pathValue = "") {
  return normalizeNotebookPagePath(pathValue).split("/").filter(Boolean);
}

export function dirname(pathValue = "") {
  const parts = pathParts(pathValue);
  parts.pop();
  return parts.join("/");
}

export function basename(pathValue = "") {
  return pathParts(pathValue).pop() || "";
}

function joinPath(parent = "", child = "") {
  return [normalizeNotebookPagePath(parent), child].filter(Boolean).join("/");
}

function isHiddenName(name = "") {
  return String(name || "").startsWith(".");
}

export function isHtmlOrPhpPage(pathValue = "") {
  const ext = basename(pathValue).split(".").pop()?.toLowerCase() || "";
  return PAGE_EXTENSIONS.has(ext);
}

function sortEntries(entries = []) {
  return [...entries]
    .filter((entry) => entry?.name && !isHiddenName(entry.name))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base", numeric: true }));
}

async function safeList(fetchDirectory, directoryPath = "") {
  const entries = await fetchDirectory(normalizeNotebookPagePath(directoryPath));
  return sortEntries(Array.isArray(entries) ? entries : []);
}

async function firstPageInsideDirectory(fetchDirectory, directoryPath = "") {
  for (const entry of await safeList(fetchDirectory, directoryPath)) {
    const fullPath = normalizeNotebookPagePath(entry.path || joinPath(directoryPath, entry.name));
    if (entry.isDirectory) {
      const found = await firstPageInsideDirectory(fetchDirectory, fullPath);
      if (found) return found;
    } else if (isHtmlOrPhpPage(fullPath)) {
      return fullPath;
    }
  }
  return "";
}

async function lastPageInsideDirectory(fetchDirectory, directoryPath = "") {
  const entries = await safeList(fetchDirectory, directoryPath);
  for (const entry of entries.reverse()) {
    const fullPath = normalizeNotebookPagePath(entry.path || joinPath(directoryPath, entry.name));
    if (entry.isDirectory) {
      const found = await lastPageInsideDirectory(fetchDirectory, fullPath);
      if (found) return found;
    } else if (isHtmlOrPhpPage(fullPath)) {
      return fullPath;
    }
  }
  return "";
}

async function pageAfterName(fetchDirectory, directoryPath = "", name = "") {
  const entries = await safeList(fetchDirectory, directoryPath);
  const index = entries.findIndex((entry) => entry.name === name);
  for (const entry of entries.slice(Math.max(0, index + 1))) {
    const fullPath = normalizeNotebookPagePath(entry.path || joinPath(directoryPath, entry.name));
    if (entry.isDirectory) {
      const found = await firstPageInsideDirectory(fetchDirectory, fullPath);
      if (found) return found;
    } else if (isHtmlOrPhpPage(fullPath)) {
      return fullPath;
    }
  }
  return "";
}

async function pageBeforeName(fetchDirectory, directoryPath = "", name = "") {
  const entries = await safeList(fetchDirectory, directoryPath);
  const index = entries.findIndex((entry) => entry.name === name);
  const candidates = entries.slice(0, index < 0 ? entries.length : index).reverse();
  for (const entry of candidates) {
    const fullPath = normalizeNotebookPagePath(entry.path || joinPath(directoryPath, entry.name));
    if (entry.isDirectory) {
      const found = await lastPageInsideDirectory(fetchDirectory, fullPath);
      if (found) return found;
    } else if (isHtmlOrPhpPage(fullPath)) {
      return fullPath;
    }
  }
  return "";
}

async function adjacentNext(fetchDirectory, currentPath) {
  let directoryPath = dirname(currentPath);
  let currentName = basename(currentPath);
  while (true) {
    const found = await pageAfterName(fetchDirectory, directoryPath, currentName);
    if (found) return found;
    if (!directoryPath) return "";
    currentName = basename(directoryPath);
    directoryPath = dirname(directoryPath);
  }
}

async function adjacentPrevious(fetchDirectory, currentPath) {
  let directoryPath = dirname(currentPath);
  let currentName = basename(currentPath);
  while (true) {
    const found = await pageBeforeName(fetchDirectory, directoryPath, currentName);
    if (found) return found;
    if (!directoryPath) return "";
    currentName = basename(directoryPath);
    directoryPath = dirname(directoryPath);
  }
}

export async function findAdjacentNotebookPage(currentPath, direction, fetchDirectory) {
  const cleanPath = normalizeNotebookPagePath(currentPath);
  if (!cleanPath || typeof fetchDirectory !== "function") return "";
  return direction === "previous"
    ? adjacentPrevious(fetchDirectory, cleanPath)
    : adjacentNext(fetchDirectory, cleanPath);
}
