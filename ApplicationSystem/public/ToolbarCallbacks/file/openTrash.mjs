// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/openTrash.mjs
// This file defines browser-side open Trash logic for the Nodevision UI. It renders interface components and handles user interactions.

export default async function openTrash() {
  const trashPath = 'UserSettings/Trash';

  if (typeof window.refreshFileManager === 'function') {
    await window.refreshFileManager(trashPath);
    return;
  }

  window.currentDirectoryPath = trashPath;
}
