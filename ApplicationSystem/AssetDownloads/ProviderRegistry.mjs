// Nodevision/ApplicationSystem/AssetDownloads/ProviderRegistry.mjs
// Holds asset discovery adapters independently of the panel and download transport.
import { createPolyHavenProvider, categories } from './PolyHavenProvider.mjs';
import { createWikimediaProvider } from './WikimediaProvider.mjs';
import { createMetMuseumProvider } from './MetMuseumProvider.mjs';
import { createNasaProvider } from './NasaProvider.mjs';
import { providerDirectory, describeProvider } from './ProviderDirectory.mjs';
export { categories };
export const assetProviders = new Map([['polyhaven', createPolyHavenProvider()], ['wikimedia', createWikimediaProvider()], ['metmuseum', createMetMuseumProvider()], ['nasa', createNasaProvider()]]);
export function getAssetProvider(id, operation = '') {
  const provider = assetProviders.get(id);
  if (!provider) throw new Error(providerDirectory.some(item => item.id === id) ? 'This source is planned but not integrated yet.' : 'Unsupported asset provider');
  if (provider.authentication?.configured === false) throw Error('This provider requires server-side configuration before use.');
  if (operation && (operation === 'download' ? provider.capabilities?.download !== true : typeof provider[operation] !== 'function')) throw Error(`This provider does not support ${operation}.`);
  return provider;
}
export function listAssetProviders() {
  return [...assetProviders.values()].filter(provider => provider.authentication?.configured !== false).map(({ id, name, categories, formats, licenses, capabilities, credit }) => ({ id, name, categories, formats, licenses, capabilities, credit }));
}

export function listProviderDirectory() { return providerDirectory.map(entry => describeProvider(entry, assetProviders.get(entry.id))); }
