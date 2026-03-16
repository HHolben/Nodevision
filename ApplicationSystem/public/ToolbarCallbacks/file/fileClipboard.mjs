// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/fileClipboard.mjs
// This file defines browser-side file Clipboard logic for the Nodevision UI. It renders interface components and handles user interactions.
// Shared client-side clipboard for File Manager toolbar actions.

const KEY = "__nodevisionFileClipboard";

export function setClipboard(entry) {
  if (!entry || typeof entry !== "object") return;
  window[KEY] = { ...entry };
}

export function getClipboard() {
  const value = window[KEY];
  if (!value || typeof value !== "object") return null;
  return value;
}

export function clearClipboard() {
  delete window[KEY];
}
