// Nodevision/ApplicationSystem/AssetDownloads/NasaProvider.mjs
// Adds NASA image discovery and original raster downloads while retaining credits and explicit usage review.
import { validateProviderUrl } from './ProviderNetwork.mjs';
import { cachedProviderJson, metadataText, originalFileSize, pageOffset } from './ProviderCatalog.mjs';
const downloadHosts = ['images-assets.nasa.gov'];
const categories = [{ id: 'images', name: 'Space and science images' }];
const usage = 'https://www.nasa.gov/nasa-brand-center/images-and-media/';
function imageUrl(value) {
  try {
    const url = new URL(value);
    // NASA manifests still return HTTP links; upgrade only the fixed NASA image host.
    if (url.protocol === 'http:' && downloadHosts.includes(url.hostname)) url.protocol = 'https:';
    return validateProviderUrl(url.href, downloadHosts);
  } catch { return ''; }
}
export function normalizeNasaAsset(item) {
  const data = item.data?.[0] || {};
  const creator = [data.photographer, data.secondary_creator, data.center].map(metadataText).filter(Boolean).join(' / ');
  return { id: String(data.nasa_id || ''), name: metadataText(data.title), creator, provider: 'nasa', sourceName: 'NASA Image Library',
    source: `https://images.nasa.gov/details/${encodeURIComponent(data.nasa_id || '')}`, description: metadataText(data.description),
    preview: imageUrl(item.links?.find(link => link.rel === 'preview')?.href), categories: ['images'], tags: [],
    license: 'NASA media usage guidelines', licenseUrl: usage, licenseVerified: false, attributionRequired: true,
    attribution: 'Review the source credits and NASA media usage guidelines, including third-party rights. This item is not automatically classified as CC0.',
    requiredAttribution: [metadataText(data.title), 'NASA', creator].filter(Boolean).join(' · '), modificationStatus: 'original' };
}
export function createNasaProvider(json, fileSize = originalFileSize) {
  const get = cachedProviderJson(['images-api.nasa.gov'], json);
  const searchApi = (params, signal) => get(`https://images-api.nasa.gov/search?${new URLSearchParams({ media_type: 'image', page_size: '12', ...params })}`, signal);
  async function inspect(id, signal) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,199}$/.test(String(id))) throw Error('Invalid NASA asset ID');
    const [metadata, manifest] = await Promise.all([searchApi({ nasa_id: String(id) }, signal), get(`https://images-api.nasa.gov/asset/${encodeURIComponent(id)}`, signal)]);
    const item = metadata.collection?.items?.find(item => item.data?.[0]?.nasa_id === id && item.data[0].media_type === 'image');
    if (!item) throw Error('NASA image is no longer available.');
    const formats = [];
    const urls = [...new Set((manifest.collection?.items || []).map(item => imageUrl(item.href)).filter(url => /~orig\.(jpe?g|png)$/i.test(url)))].slice(0, 4);
    for (const url of urls) {
      signal?.throwIfAborted();
      const extension = /\.png$/i.test(url) ? 'png' : 'jpg';
      formats.push({ id: new URL(url).pathname.split('/').pop(), label: `Original ${extension.toUpperCase()}`, extension, url, size: await fileSize(url, downloadHosts, signal) });
    }
    return { ...normalizeNasaAsset(item), formats, note: 'Original JPEG/PNG only. Audio, video and TIFF are not enabled. Usage and third-party credits require review before insertion.' };
  }
  return { id: 'nasa', name: 'NASA Image Library', credit: { label: 'Images from NASA Image and Video Library', url: 'https://images.nasa.gov' },
    downloadHosts, categories, formats: ['jpg', 'png'], licenses: ['NASA media usage guidelines'],
    capabilities: { search: true, metadata: true, previews: 'image', download: true }, inspect,
    async search({ query = '', category = '', format = '', license = '', offset = 0 } = {}, signal) {
      if ((category && category !== 'images') || (format && !['jpg', 'png'].includes(format)) || (license && license !== 'NASA media usage guidelines')) return { items: [], next: null };
      const start = Math.floor(pageOffset(offset) / 12) * 12;
      const data = await searchApi({ q: String(query).slice(0, 200).trim() || 'moon', page: String(start / 12 + 1) }, signal);
      let items = (data.collection?.items || []).slice(0, 12).filter(item => item.data?.[0]?.media_type === 'image').map(normalizeNasaAsset);
      if (format) { const matching = []; for (const item of items) { const detail = await inspect(item.id, signal); if (detail.formats.some(file => file.extension === format)) matching.push(item); } items = matching; }
      const total = Number(data.collection?.metadata?.total_hits) || 0;
      return { items, total, next: start + 12 < total && start + 12 <= 9988 ? start + 12 : null };
    },
  };
}
