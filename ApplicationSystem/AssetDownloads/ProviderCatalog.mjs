// Nodevision/ApplicationSystem/AssetDownloads/ProviderCatalog.mjs
// Shares bounded catalog caching, inert metadata text and original-file sizing for image providers.
import { providerJson, providerFetch, MAX_ASSET_BYTES } from './ProviderNetwork.mjs';
export function cachedProviderJson(hosts, json = providerJson) {
  const cache = new Map();
  return async (url, signal) => {
    signal?.throwIfAborted();
    const hit = cache.get(url); if (hit && hit.expires > Date.now()) return hit.value;
    const value = await json(url, signal, hosts);
    if (value.error) throw Error(value.error.info || value.error.message || 'Provider query failed');
    if (cache.size >= 150) cache.delete(cache.keys().next().value);
    cache.set(url, { value, expires: Date.now() + 300000 }); return value;
  };
}
export function metadataText(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp|copy);/gi, (match, entity) => {
    if (entity[0] === '#') { const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; }
    return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', copy: '©' })[entity.toLowerCase()] || match;
  }).replace(/\s+/g, ' ').trim().slice(0, 12000);
}
export async function originalFileSize(url, hosts, signal) {
  const response = await providerFetch(url, hosts, { method: 'HEAD', signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(30000)]) });
  const size = Number(response.headers.get('content-length')); await response.body?.cancel();
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_ASSET_BYTES) throw Error('Original image size is unavailable or exceeds 128 MiB.');
  return size;
}
export function pageOffset(value) { return Math.max(0, Math.min(9988, Math.floor(Number(value) || 0))); }
