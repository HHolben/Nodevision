import { linkedResourceMarkup } from '/Media/LinkedResourceMarkup.mjs';
// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaResource.mjs
// Inserts normalized local or acquired media through existing editor commands and native history.
import { validateAssetEditorContext } from '/AssetDownloads/AssetEditorContext.mjs';
import { markupInsertionAllowed, insertAssetCode } from './insertMediaCode.mjs';
import { assetCredit, assetLicenseState } from '/AssetDownloads/AssetAttributionService.mjs';
import { getRelativeNotebookReference } from '/utils/notebookPath.mjs';
import { serializeFallbackAttributes } from '/utils/referenceFallbacks.mjs';
const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function assetReference(context, download) {
  if (download.reference) return download.reference;
  return download.path?.startsWith('Notebook/') ? getRelativeNotebookReference({ sourcePath: context.path, targetPath: download.path }) : download.url;
}
export function planAssetInsertion(context, asset, format, { strategy = 'markup', creditPlacement = 'project', download = null, resource = null } = {}) {
  let reason = validateAssetEditorContext(context);
  const model = ['gltf','glb','gox'].includes(format?.extension);
  const image = ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(format?.extension);
  const mediaTag = image ? 'img' : ['mp3', 'wav', 'ogg'].includes(format?.extension) ? 'audio' : ['mp4', 'webm'].includes(format?.extension) ? 'video' : '';
  const credit = assetCredit(asset); const licenseState = assetLicenseState(asset);
  const reference = download && context ? assetReference(context, download) : 'assets/selected-asset.' + (format?.extension || 'png');
  const linked = resource?.notebookPath ? ` data-nv-linked-path="${escape(resource.notebookPath)}"` : '';
  const fallbacks = serializeFallbackAttributes(resource?.fallbacks || [], { primary: reference });
  const htmlSnippet = mediaTag ? linkedResourceMarkup({ src: reference, name: asset.name, tag: mediaTag, attributes: mediaTag === 'img' ? linked + fallbacks : '' }) : '';
  let type = ''; let snippet = '';
  if (!reason && context.kind === 'code') {
    const offset = context.model.getOffsetAt(context.selection.getStartPosition?.() || { lineNumber: context.selection.startLineNumber, column: context.selection.startColumn });
    const end = context.model.getOffsetAt(context.selection.getEndPosition?.() || { lineNumber: context.selection.endLineNumber || context.selection.startLineNumber, column: context.selection.endColumn || context.selection.startColumn });
    if (!['html', 'htm', 'svg', 'php'].includes(context.extension)) reason = 'This source type has no asset insertion adapter.';
    else if (strategy === 'path') { type = 'Path at captured selection (review escaping for your source context)'; snippet = reference; }
    else if (!mediaTag || (context.extension === 'svg' && !image) || /[<>]/.test(context.model.getValue().slice(offset, end)) || !markupInsertionAllowed(context.model.getValue(), offset, context.extension)) reason = 'No safe markup location was identified. Choose Path only after reviewing the source, or copy the snippet.';
    else { type = context.extension === 'svg' ? 'SVG image element' : 'HTML image element'; snippet = context.extension === 'svg'
      ? `<image href="${escape(reference)}" x="0" y="0" width="200" height="200" />`
      : htmlSnippet; }
  } else if (!reason && context.kind === 'html' && mediaTag) { type = `HTML ${mediaTag} at captured caret`; snippet = htmlSnippet; }
  else if (!reason && context.kind === 'svg' && image) type = 'Image in captured SVG layer, movable after insertion';
  else if (!reason && context.kind === 'raster' && image) type = 'Movable and resizable raster selection; commit separately';
  else if (!reason && context.kind === 'html' && model) type = 'HTML model using the existing linked viewer';
  else if (!reason && context.kind === 'world' && model && context.api?.insertModelAsset) type = 'Interactive referenced 3D model placement';
  else if (!reason && context.kind === 'world' && image && context.api?.insertDownloadedImage) type = 'World image plane at captured crosshair position';
  else if (!reason) reason = 'This editor or asset format has no compatible insertion API. Download Only is available.';
  if (creditPlacement === 'visible' && snippet && strategy !== 'path') snippet += context.extension === 'svg'
    ? `\n<text x="0" y="220" font-size="12">${escape(credit)}</text>` : `\n<small class="asset-credit">${escape(credit)}</small>`;
  return { compatible: !reason, reason, type, snippet, reference, credit, licenseState, creditPlacement, strategy };
}
export async function insertMediaResource(context, resource, format, options = {}) {
  const asset = { ...resource.metadata, name: resource.metadata?.title || resource.source?.name };
  const download = { path: resource.notebookPath || '', url: resource.previewUrl || resource.src, reference: resource.src };
  const plan = planAssetInsertion(context, asset, format, { ...options, creditPlacement: options.attribute ? options.creditPlacement : 'project', download, resource });
  if (!plan.compatible) throw new Error(plan.reason);
  if (!options.local && (plan.licenseState === 'unknown' || (plan.licenseState === 'required' && !options.attribute)) && !options.acceptLicenseResponsibility) throw new Error('Explicit license responsibility confirmation is required.');
  if (options.strategy === 'path' && !options.confirmPathInsertion) throw new Error('Confirm the reviewed path-only insertion first.');
  const credit = options.attribute && options.creditPlacement === 'visible' ? plan.credit : '';
  let result;
  if (context.kind === 'code') result = insertAssetCode(context, plan.snippet);
  if (context.kind === 'html') {
    context.root.focus(); const selection = context.root.ownerDocument.getSelection(); selection.removeAllRanges(); selection.addRange(context.range.cloneRange());
    if(['gltf','glb','gox'].includes(format.extension)){const {insertLinkedModelViewerAtCaret}=await import('./insertMediaModel.mjs');insertLinkedModelViewerAtCaret({resource,ext:format.extension,tools:context.api});if(credit)context.api.insertHTMLAtCaret('<small class="asset-credit">'+escape(credit)+'</small>');result=true;}else result = context.api.insertHTMLAtCaret(plan.snippet);
  }
  if (context.kind === 'svg') result = await context.api.insertImageFromInsertion({ src: download.url, previewSrc: download.url,
    linkedNotebookPath: download.path.startsWith('Notebook/') ? download.path : '', sourceName: asset.name, fallbacks: resource.fallbacks, layerId: context.layer.id, offset:(options.batchIndex||0)*24, credit });
  if (context.kind === 'raster') result = await context.api.insertImageFromInsertion({ src: download.url, credit,
    validate: () => !options.isCancelled?.() && !validateAssetEditorContext(context) });
  if (context.kind === 'world' && ['gltf','glb','gox'].includes(format.extension)) {const {startModelPlacement}=await import('/Models/ModelPlacement.mjs');const placement=await startModelPlacement(download.path,{name:asset.name,assetProvenance:resource.metadata,validate:()=>!options.isCancelled?.()&&!validateAssetEditorContext(context)});result={pendingPlacement:true,placement};}
  else if (context.kind === 'world') result = await context.api.insertDownloadedImage({ imageFile: download.path.startsWith('Notebook/') ? download.path : download.url, name: asset.name, position: context.position.map((n,i)=>i===0?n+(options.batchIndex||0)*2:n),
    assetProvenance: { title: asset.name, creator: asset.creator || '', source: asset.source, license: asset.license, licenseUrl: asset.licenseUrl, credit: assetCredit(asset) },
    validate: () => !options.isCancelled?.() && !validateAssetEditorContext(context) });
  if (!result) throw new Error('The editor rejected insertion; the downloaded asset remains saved.');
  return { inserted: true, pendingPlacement: result.pendingPlacement === true, placement:result.placement, plan };
}
