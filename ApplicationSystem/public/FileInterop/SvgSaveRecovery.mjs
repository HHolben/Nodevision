// Nodevision/ApplicationSystem/public/FileInterop/SvgSaveRecovery.mjs
// This module provides explicit SVG size-failure recovery without altering document contents, dirty state, or server limits. Backup downloads use the exact serialized buffer rejected by the server.
import { downloadBlob } from './DownloadBlob.mjs';
export function showSvgSaveRecovery({ content, path, limitBytes }) {
  const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
  const size = bytes => `${(bytes / 1048576).toFixed(1)} MiB`;
  const message = `Save failed: this SVG exceeds the current save request limit${limitBytes ? ` (${size(limitBytes)})` : ''}. The document remains open and unsaved. SVG size: ${size(blob.size)}. Download a backup to protect your work, or close this message and retry saving later.`;
  const dialog = document.createElement('dialog');
  const paragraph = document.createElement('p'); paragraph.textContent = message;
  const backup = document.createElement('button'); backup.textContent = 'Download SVG backup'; backup.type = 'button';
  backup.onclick = () => downloadBlob(blob, (String(path).split(/[\\/]/).pop() || 'drawing.svg').replace(/\.svg$/i, '') + '.backup.svg');
  const close = document.createElement('button'); close.textContent = 'Keep editing'; close.type = 'button'; close.onclick = () => dialog.close();
  dialog.append(paragraph, backup, close); dialog.style.maxWidth = '36rem';
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.appendChild(dialog); dialog.showModal();
  return dialog;
}
export async function saveSvgRequest({ path, sourcePath = path, content }, { request = fetch, recover = showSvgSaveRecovery } = {}) {
  const response = await request('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, sourcePath, content }) });
  if (response.ok) return true;
  let data = {};
  try { data = await response.json(); } catch { /* Proxies may return an HTML error page. */ }
  if (response.status === 413) {
    recover({ path, content, limitBytes: data.limitBytes });
    return false;
  }
  throw new Error(data.error || response.statusText || `HTTP ${response.status}`);
}
