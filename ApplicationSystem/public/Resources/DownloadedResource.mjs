// Nodevision/ApplicationSystem/public/Resources/DownloadedResource.mjs
// Converts validated saved assets into existing Notebook, shared-reference or inline acquisition results.
import { acquireResource, RESOURCE_PROVIDER_IDS } from './ResourceAcquisitionService.mjs';
export async function acquireDownloadedResource({ context, asset, format, download, storageMode = 'referenced', fallbacks = [] }) {
  const notebook = download.path?.startsWith('Notebook/');
  const inline = storageMode === 'inline';
  if (inline && context.kind === 'world') throw Error('World image insertion requires a saved resource reference.');
  const resourceType = ['mp3', 'wav', 'ogg'].includes(format.extension) ? 'audio' : ['mp4', 'webm'].includes(format.extension) ? 'video' : ['glb', 'gltf', 'gox'].includes(format.extension) ? 'model' : 'image';
  const resource = await acquireResource({
    providerId: notebook && !inline ? RESOURCE_PROVIDER_IDS.NOTEBOOK : RESOURCE_PROVIDER_IDS.DIRECT_URL,
    mode: inline ? 'inline' : 'reference', fallbacks, resourceType, sourcePath: context.path,
    notebookPath: notebook ? download.path : '', url: download.url, sourceName: asset.name,
    metadata: { ...asset, title: asset.name, formatId: format.id },
  });
  resource.previewUrl = inline ? resource.src : download.url;
  return resource;
}
