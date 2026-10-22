// Nodevision/ApplicationSystem/AssetDownloads/MetMuseumProvider.mjs
// Uses the Met's paginated Collection API and offers originals only for explicitly public-domain objects.
import { validateProviderUrl } from './ProviderNetwork.mjs';
import { cachedProviderJson, metadataText, originalFileSize, pageOffset } from './ProviderCatalog.mjs';
const downloadHosts = ['images.metmuseum.org'];
const categories = [{ id: 'images', name: 'Artwork and collection images' }];
function imageUrl(value) { try { return validateProviderUrl(value, downloadHosts); } catch { return ''; } }
export function normalizeMetAsset(raw) {
  const original = raw.isPublicDomain === true ? imageUrl(raw.primaryImage) : '';
  return {
    id: String(raw.objectID), provider: 'metmuseum', sourceName: 'The Met Open Access', name: metadataText(raw.title),
    creator: metadataText(raw.artistDisplayName), source: `https://www.metmuseum.org/art/collection/search/${raw.objectID}`,
    description: [raw.objectDate, raw.medium, raw.culture, raw.creditLine].map(metadataText).filter(Boolean).join(' · '),
    preview: original ? imageUrl(raw.primaryImageSmall) : '', categories: ['images'], tags: [],
    license: original ? 'CC0-1.0' : 'unknown', licenseVerified: !!original, licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false, attributionRecommended: true, attribution: metadataText(raw.creditLine), requiredAttribution: [raw.title, raw.artistDisplayName, raw.creditLine, 'The Metropolitan Museum of Art', 'CC0-1.0'].map(metadataText).filter(Boolean).join(' · '), modificationStatus: 'original', original,
  };
}
export function createMetMuseumProvider(json, fileSize = originalFileSize) {
  const get = cachedProviderJson(['collectionapi.metmuseum.org'], json);
  async function object(id, signal) {
    if (!/^[1-9]\d{0,11}$/.test(String(id))) throw Error('Invalid asset ID');
    const raw = await get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, signal);
    if (String(raw.objectID) !== String(id)) throw Error('Museum object is no longer available.');
    return normalizeMetAsset(raw);
  }
  return {
    id: 'metmuseum', name: 'The Met Open Access', credit: { label: 'Collection images from The Metropolitan Museum of Art', url: 'https://www.metmuseum.org' },
    categories, formats: ['jpg'], licenses: ['CC0-1.0'], downloadHosts,
    capabilities: { search: true, metadata: true, previews: 'image', download: true },
    async inspect(id, signal) {
      const asset = await object(id, signal);
      const formats = asset.original ? [{ id: 'original', label: 'Original JPEG', extension: 'jpg', url: asset.original, size: await fileSize(asset.original, downloadHosts, signal) }] : [];
      return { ...asset, original: undefined, formats, note: asset.original ? 'Public-domain Open Access image. Original JPEG; collection credit is preserved.' : 'No public-domain original image is available for this object.' };
    },
    async search({ query = '', category = '', format = '', license = '', offset = 0 } = {}, signal) {
      if ((category && category !== 'images') || (format && format !== 'jpg') || (license && license !== 'CC0-1.0')) return { items: [], next: null };
      const start = pageOffset(offset);
      const params = new URLSearchParams({ q: String(query).slice(0, 200), hasImages: 'true', offset: String(start), limit: '12' });
      const data = await get(`https://collectionapi.metmuseum.org/public/collection/v1.1/search?${params}`, signal);
      const items = []; const ids = (data.objectIDs || []).slice(0, 12);
      // Bound detail concurrency; no whole-collection scan or original-file request during search.
      for (let i = 0; i < ids.length; i += 3) {
        signal?.throwIfAborted(); const batch = await Promise.all(ids.slice(i, i + 3).map(async id => { try { return await object(id, signal); } catch (error) { if (error.status === 404) return null; throw error; } }));
        items.push(...batch.filter(asset => asset?.original).map(({ original, ...asset }) => asset));
      }
      return { items, next: ids.length && start + 12 < Math.min(Number(data.total) || 0, 10000) && start + 12 <= 9988 ? start + 12 : null, total: data.total };
    },
  };
}
