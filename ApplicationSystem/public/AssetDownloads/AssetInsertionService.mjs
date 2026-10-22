// Nodevision/ApplicationSystem/public/AssetDownloads/AssetInsertionService.mjs
// Adapts validated downloads to the existing ResourceReference and Insert Media pipeline.
import { acquireDownloadedResource } from '/Resources/DownloadedResource.mjs';
import { insertMediaResource } from '/ToolbarJSONfiles/insertMediaResource.mjs';
export { planAssetInsertion, assetReference } from '/ToolbarJSONfiles/insertMediaResource.mjs';
export async function insertDownloadedAsset(context, asset, format, download, options = {}) {
  const resource = await acquireDownloadedResource({ context, asset, format, download, storageMode: options.storageMode, fallbacks: options.fallbacks });
  if (options.isCancelled?.()) throw Error('Insertion cancelled; the downloaded asset remains saved.');
  return insertMediaResource(context, resource, format, options);
}
