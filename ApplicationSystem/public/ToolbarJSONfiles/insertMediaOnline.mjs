// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaOnline.mjs
// Adds explicit online acquisition beside existing local media commands without starting discovery on local form open.
import { captureAssetEditorContext } from '/AssetDownloads/AssetEditorContext.mjs';
import { openDownloadAssets } from '/ToolbarCallbacks/file/downloadAssets.mjs';
export function supportsOnlineMedia(context) {
  return !!context && ['html', 'svg', 'raster', 'world'].includes(context.kind) || context?.kind === 'code' && ['html', 'htm', 'php', 'svg'].includes(context.extension);
}
export function appendOnlineMediaButton(parent, getOptions = () => ({}), report = () => {}) {
  const button = document.createElement('button'); button.type = 'button';
  button.textContent = 'Download from Online Source…'; button.dataset.action = 'download-online-media';
  button.addEventListener('mousedown', event => event.preventDefault());
  button.addEventListener('click', async () => {
    try {
      const options = getOptions();
      const origin = options.origin || await captureAssetEditorContext(options.cell || window.activeCell);
      if (!supportsOnlineMedia(origin)) throw Error('This editor has no compatible media insertion command. Use File → Download.');
      await openDownloadAssets({ mode: 'insert', origin, settings: options.settings || {}, mediaFamily: options.mediaFamily || 'Image' });
    } catch (error) { report(error.message); }
  });
  parent.append(button); return button;
}
