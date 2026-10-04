// Nodevision/ApplicationSystem/Desktop/ElectronHtmlHistory.mjs
// This module routes desktop Undo and Redo to an active HTML journal before asking Chromium, whose native command availability does not describe editor-owned history.
export function installElectronHtmlHistory(webContents) {
  const original = { undo: webContents.undo.bind(webContents), redo: webContents.redo.bind(webContents) };
  for (const direction of ['undo', 'redo']) {
    webContents[direction] = async () => {
      if (webContents.isDestroyed()) return;
      const handled = await webContents.executeJavaScript(`Boolean(window.__nvDispatchHtmlHistory?.(${JSON.stringify(direction)}))`).catch(() => true);
      if (!handled && !webContents.isDestroyed()) original[direction]();
    };
  }
  return original;
}
