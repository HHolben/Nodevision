// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertDirectoryContents.mjs
// This callback inserts a self-contained directory contents block into the active HTML or PHP editor.

import {
  buildDirectoryContentsSnippet,
  buildDirectoryEntries,
  dirname,
  normalizeNotebookPath,
} from "./directoryContents/DirectoryContentsSnippet.mjs";
import {
  getActiveHtmlOrPhpPath,
  insertIntoActiveHtmlOrPhpEditor,
  isHtmlOrPhpPath,
} from "./directoryContents/ActiveHtmlInsertion.mjs";
import { showDirectoryContentsDialog } from "./directoryContents/DirectoryContentsDialog.mjs";

async function fetchDirectoryEntries(directoryPath = "") {
  const cleanPath = normalizeNotebookPath(directoryPath);
  const response = await fetch(`/api/files?path=${encodeURIComponent(cleanPath)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Directory listing failed with HTTP ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

function alertUnableToInsert(message) {
  console.warn(`insertDirectoryContents: ${message}`);
  alert(message);
}

export default async function insertDirectoryContents() {
  const filePath = getActiveHtmlOrPhpPath();
  if (!isHtmlOrPhpPath(filePath)) {
    alertUnableToInsert("Open an HTML or PHP file editor before inserting directory contents.");
    return;
  }

  const directoryPath = dirname(filePath);
  let entries = [];
  try {
    entries = await fetchDirectoryEntries(directoryPath);
  } catch (err) {
    console.error("insertDirectoryContents: failed to read directory", err);
    alertUnableToInsert("Nodevision could not read the current file directory.");
    return;
  }

  const visibleEntries = buildDirectoryEntries(entries);
  const choices = await showDirectoryContentsDialog({
    directoryPath,
    entryCount: visibleEntries.length,
  });
  if (!choices) return;

  const html = buildDirectoryContentsSnippet({
    ...choices,
    directoryPath,
    entries: visibleEntries,
  });
  if (!insertIntoActiveHtmlOrPhpEditor(html, filePath)) {
    alertUnableToInsert("No active HTML or PHP editor accepted the directory contents block.");
  }
}
