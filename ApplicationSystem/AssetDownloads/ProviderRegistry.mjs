// Nodevision/ApplicationSystem/AssetDownloads/ProviderRegistry.mjs
// Holds asset discovery adapters independently of the panel and download transport.
import { createPolyHavenProvider, categories } from './PolyHavenProvider.mjs';
export { categories };
export const assetProviders = new Map([['polyhaven', createPolyHavenProvider()]]);
export function getAssetProvider(id) {
  const provider = assetProviders.get(id);
  if (!provider) throw new Error('Unsupported asset provider');
  return provider;
}
export function listAssetProviders() {
  return [...assetProviders.values()].map(({ id, name, categories, formats, licenses, capabilities, credit }) => ({ id, name, categories, formats, licenses, capabilities, credit }));
}
