// Nodevision/ApplicationSystem/public/AssetDownloads/DownloadClient.mjs
// Wraps discovery requests and streamed download progress without changing the active world.
const base = '/api/asset-downloads';
export async function assetRequest(endpoint, params = {}, signal) {
  const response = await fetch(`${base}/${endpoint}?${new URLSearchParams(params)}`, { signal });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
export async function saveAsset(request, signal, progress) {
  const response = await fetch(`${base}/download`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, authorized: true }), signal });
  if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'Download failed'); }
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  let pending = ''; let result = null;
  try {
    while (true) {
      const chunk = await reader.read();
      pending += decoder.decode(chunk.value, { stream: !chunk.done });
      let newline;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        if (message.error) throw new Error(message.error);
        if (message.progress) progress(message.progress);
        if (message.result) result = message.result;
      }
      if (chunk.done) break;
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!result) throw new Error('Download connection closed before completion');
  return result;
}
