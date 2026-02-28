// Nodevision/public/ToolbarCallbacks/file/openTrash.mjs
// Opens the per-user Trash directory in File Manager.

export default async function openTrash() {
  const trashPath = 'UserSettings/Trash';

  if (typeof window.refreshFileManager === 'function') {
    await window.refreshFileManager(trashPath);
    return;
  }

  window.currentDirectoryPath = trashPath;
}
