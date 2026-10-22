// Nodevision/ApplicationSystem/AssetDownloads/WikimediaProvider.mjs
// Discovers original Commons raster images with per-file license and attribution metadata through MediaWiki's API.
import { validateProviderUrl, MAX_ASSET_BYTES } from './ProviderNetwork.mjs';
import { cachedProviderJson, metadataText, pageOffset } from './ProviderCatalog.mjs';
const hosts = ['upload.wikimedia.org'];
const categories = [{ id: 'images', name: 'Photos and illustrations' }];
const licenses = ['CC0-1.0', 'Public domain', ...['BY', 'BY-SA'].flatMap(type => ['1.0', '2.0', '2.5', '3.0', '4.0'].map(version => `CC-${type}-${version}`)), 'unknown'];
function safeImage(url) { try { return validateProviderUrl(url, hosts); } catch { return ''; } }
export function normalizeCommonsAsset(page) {
  const info = page.imageinfo?.[0] || {}; const meta = info.extmetadata || {};
  const value = key => metadataText(meta[key]?.value);
  const licenseUrl = value('LicenseUrl').replace(/^\/\//, 'https://').replace(/^http:/, 'https:');
  const cc = licenseUrl.match(/^https:\/\/creativecommons\.org\/licenses\/(by|by-sa)\/(1\.0|2\.0|2\.5|3\.0|4\.0)\//i);
  const zero = /^https:\/\/creativecommons\.org\/publicdomain\/zero\/1\.0\//i.test(licenseUrl);
  const publicDomain = value('Copyrighted') === 'False' && /public domain/i.test(value('LicenseShortName'));
  const license = cc ? `CC-${cc[1].toUpperCase()}-${cc[2]}` : zero ? 'CC0-1.0' : publicDomain ? 'Public domain' : 'unknown';
  const name = metadataText(page.title).replace(/^File:/, ''); const creator = value('Artist');
  const source = `https://commons.wikimedia.org/?curid=${page.pageid}`;
  const attribution = [value('Attribution'), value('Credit'), value('UsageTerms')].filter(Boolean).join(' · ');
  const url = safeImage(info.url); const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png' })[info.mime];
  const downloadable = url && extension && Number.isSafeInteger(info.size) && info.size > 0 && info.size <= MAX_ASSET_BYTES;
  return {
    id: String(page.pageid), provider: 'wikimedia', sourceName: 'Wikimedia Commons', name, creator, source,
    description: value('ImageDescription'), preview: safeImage(info.thumburl), categories: ['images'], tags: [],
    license, reportedLicense: value('LicenseShortName'), licenseUrl: /^https:\/\/(creativecommons\.org|www\.gnu\.org)\//i.test(licenseUrl) ? licenseUrl : source,
    licenseVerified: license !== 'unknown', attributionRequired: !!cc || value('AttributionRequired') === 'true',
    attribution, requiredAttribution: [name, creator, license, attribution].filter(Boolean).join(' · '), modificationStatus: 'original',
    formats: downloadable ? [{ id: 'original', label: `Original ${extension.toUpperCase()}`, extension, size: info.size, url }] : [],
    note: `Reported license: ${value('LicenseShortName') || 'unknown'}. License and credit apply to this individual file. Check the source page for additional rights and ShareAlike conditions. Only original JPEG/PNG files are supported.`,
  };
}
export function createWikimediaProvider(json) {
  const get = cachedProviderJson(['commons.wikimedia.org'], json);
  async function query(params, signal) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '256', ...params });
    return get(url.href, signal);
  }
  return {
    id: 'wikimedia', name: 'Wikimedia Commons', credit: { label: 'Media from Wikimedia Commons', url: 'https://commons.wikimedia.org' },
    categories, formats: ['jpg', 'png'], licenses, downloadHosts: hosts,
    capabilities: { search: true, metadata: true, previews: 'image', download: true },
    async inspect(id, signal) {
      if (!/^[1-9]\d{0,11}$/.test(String(id))) throw Error('Invalid asset ID');
      const data = await query({ pageids: String(id) }, signal); const page = data.query?.pages?.[0];
      if (!page || page.missing || page.ns !== 6 || !page.imageinfo?.length) throw Error('Commons image is no longer available.');
      return normalizeCommonsAsset(page);
    },
    async search({ query: text = '', category = '', format = '', license = '', offset = 0 } = {}, signal) {
      if ((category && category !== 'images') || (format && !['jpg', 'png'].includes(format)) || (license && !licenses.includes(license))) return { items: [], next: null };
      const data = await query({ generator: 'search', gsrnamespace: '6', gsrlimit: '12', gsroffset: String(pageOffset(offset)), gsrsearch: `${String(text).slice(0, 200).trim() || 'landscape'} filetype:bitmap` }, signal);
      const items = (data.query?.pages || []).sort((a, b) => a.index - b.index).map(normalizeCommonsAsset)
        .filter(item => item.formats.length && (!format || item.formats[0].extension === format) && (!license || item.license === license));
      const next = data.continue?.gsroffset;
      return { items, next: Number.isSafeInteger(next) && next > pageOffset(offset) && next <= 9988 ? next : null };
    },
  };
}
