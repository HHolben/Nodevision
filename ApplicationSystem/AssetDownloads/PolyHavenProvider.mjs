// Nodevision/ApplicationSystem/AssetDownloads/PolyHavenProvider.mjs
// Adapts the documented Poly Haven API to the asset discovery provider contract.
import { MAX_ASSET_BYTES, providerJson, validateProviderUrl } from './ProviderNetwork.mjs';
export const categories = [
  ['models', '3D objects and models'], ['voxels', 'Voxel structures'], ['textures', 'Textures and materials'],
  ['terrain', 'Terrain and heightmaps'], ['vegetation', 'Trees and vegetation'], ['images', 'Images and environment maps'],
].map(([id, name]) => ({ id, name }));
export const supportedFormats = ['jpg', 'png', 'hdr', 'exr', 'glb'];
export function normalizeAsset(id, raw) {
  const tags = [...(raw.tags || []), ...(Array.isArray(raw.categories) ? raw.categories : [])];
  return {
    id, name: raw.name || id, creator: Object.keys(raw.authors || {}).join(', '), provider: 'polyhaven', sourceName: 'Poly Haven',
    source: `https://polyhaven.com/a/${encodeURIComponent(id)}`, description: raw.description || 'Poly Haven asset',
    preview: `https://cdn.polyhaven.com/asset_img/thumbs/${encodeURIComponent(id)}.png?width=256&height=256`,
    license: 'CC0-1.0', licenseVerified: true, attributionRequired: false, attributionRecommended: false, modificationStatus: 'original', licenseUrl: 'https://polyhaven.com/license', attribution: 'Asset attribution is not required (CC0). Source: Poly Haven.',
    categories: [raw.type === 0 ? 'images' : raw.type === 1 ? 'textures' : 'models',
      ...(/terrain|height|ground/i.test(tags.join(' ')) ? ['terrain'] : []),
      ...(/tree|plant|vegetation|foliage/i.test(tags.join(' ')) ? ['vegetation'] : [])], tags,
  };
}
export function normalizeFiles(tree, prefix = [], result = []) {
  for (const [key, value] of Object.entries(tree || {})) {
    if (!value || typeof value !== 'object') continue;
    const keys = [...prefix, key];
    if (value.url) {
      const extension = new URL(value.url).pathname.split('.').pop().toLowerCase();
      if (!supportedFormats.includes(extension) || !Number.isSafeInteger(value.size) || value.size <= 0 || value.size > MAX_ASSET_BYTES) continue;
      try { validateProviderUrl(value.url, ['dl.polyhaven.org']); } catch { continue; }
      result.push({ id: keys.join('/'), label: keys.join(' · '), extension, size: value.size, url: value.url, md5: value.md5 || '' });
    } else normalizeFiles(value, keys, result);
  }
  return result.sort((a, b) => a.size - b.size);
}
export function createPolyHavenProvider(json = providerJson) {
  const cache = new Map();
  async function get(endpoint, signal) {
    const hit = cache.get(endpoint);
    if (hit && hit.expires > Date.now()) return hit.value;
    const value = await json(`https://api.polyhaven.com/${endpoint}`, signal);
    if (cache.size > 150) cache.delete(cache.keys().next().value);
    cache.set(endpoint, { value, expires: Date.now() + 300000 });
    return value;
  }
  function checkId(id) { if (!/^[A-Za-z0-9_-]{1,120}$/.test(id || '')) throw new Error('Invalid asset ID'); }
  async function inspect(id, signal) {
    checkId(id);
    const [info, files] = await Promise.all([get(`info/${id}`, signal), get(`files/${id}`, signal)]);
    return { ...normalizeAsset(id, info), formats: normalizeFiles(files),
      note: 'Original standalone files only. No archives, conversion, or external model dependencies are downloaded. Models without a GLB are inspection-only in V1.' };
  }
  return {
    id: 'polyhaven', name: 'Poly Haven', credit: { label: 'Powered by Poly Haven', url: 'https://polyhaven.com' }, downloadHosts: ['dl.polyhaven.org'], categories, formats: supportedFormats, licenses: ['CC0-1.0'],
    capabilities: { search: true, metadata: true, previews: 'image', download: true, unsupportedCategories: ['voxels'] },
    inspect,
    async search({ query = '', category = '', format = '', license = '', offset = 0 } = {}, signal) {
      if (category === 'voxels' || (license && license !== 'CC0-1.0')) return { items: [], next: null };
      if (format && !supportedFormats.includes(format)) throw new Error('Unsupported format');
      const catalog = await get('assets', signal);
      const matches = Object.entries(catalog).map(([id, raw]) => normalizeAsset(id, raw)).filter(asset =>
        (!category || asset.categories.includes(category)) && `${asset.name} ${asset.tags.join(' ')}`.toLowerCase().includes(String(query).toLowerCase()));
      const start = Math.max(0, Math.min(matches.length, Number(offset) || 0));
      let items = matches.slice(start, start + 12);
      if (format) {
        const details = [];
        for (const item of items) { signal?.throwIfAborted(); const detail = await inspect(item.id, signal); if (detail.formats.some(f => f.extension === format)) details.push(item); }
        items = details;
      }
      return { items, next: start + 12 < matches.length ? start + 12 : null, total: matches.length };
    },
  };
}
