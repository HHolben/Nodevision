// Nodevision/ApplicationSystem/public/AssetDownloads/AssetInsertionService.mjs
// Builds reviewable plans and routes downloaded assets through the captured editor's native insertion and history APIs.
import { validateAssetEditorContext } from './AssetEditorContext.mjs';
import { markupInsertionAllowed, insertAssetCode } from './AssetCodeInsertion.mjs';
import { assetCredit, assetLicenseState } from './AssetAttributionService.mjs';
import { getRelativeNotebookReference } from '/utils/notebookPath.mjs';
const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function assetReference(context, download) {
  return download.path?.startsWith('Notebook/') ? getRelativeNotebookReference({ sourcePath: context.path, targetPath: download.path }) : download.url;
}
export function planAssetInsertion(context, asset, format, { strategy = 'markup', creditPlacement = 'project', download = null } = {}) {
  let reason = validateAssetEditorContext(context);
  const image = ['png', 'jpg', 'jpeg', 'webp'].includes(format?.extension);
  const credit = assetCredit(asset); const licenseState = assetLicenseState(asset);
  const reference = download && context ? assetReference(context, download) : 'assets/selected-asset.' + (format?.extension || 'png');
  let type = ''; let snippet = '';
  if (!reason && context.kind === 'code') {
    const offset = context.model.getOffsetAt(context.selection.getStartPosition?.() || { lineNumber: context.selection.startLineNumber, column: context.selection.startColumn });
    if (!['html', 'htm', 'svg', 'php'].includes(context.extension)) reason = 'This source type has no asset insertion adapter.';
    else if (strategy === 'path') { type = 'Path at captured selection (review escaping for your source context)'; snippet = reference; }
    else if (!image || !markupInsertionAllowed(context.model.getValue(), offset, context.extension)) reason = 'No safe markup location was identified. Choose Path only after reviewing the source, or copy the snippet.';
    else { type = context.extension === 'svg' ? 'SVG image element' : 'HTML image element'; snippet = context.extension === 'svg'
      ? `<image href="${escape(reference)}" x="0" y="0" width="200" height="200" />`
      : `<img src="${escape(reference)}" alt="${escape(asset.name)}">`; }
  } else if (!reason && context.kind === 'html' && image) { type = 'HTML image at captured caret'; snippet = `<img src="${escape(reference)}" alt="${escape(asset.name)}">`; }
  else if (!reason && context.kind === 'svg' && image) type = 'Image in captured SVG layer, movable after insertion';
  else if (!reason && context.kind === 'raster' && image) type = 'Movable and resizable raster selection; commit separately';
  else if (!reason && context.kind === 'world' && image && context.api?.insertDownloadedImage) type = 'World image plane at captured crosshair position';
  else if (!reason) reason = 'This editor or asset format has no compatible insertion API. Download Only is available.';
  if (creditPlacement === 'visible' && snippet && strategy !== 'path') snippet += context.extension === 'svg'
    ? `\n<text x="0" y="220" font-size="12">${escape(credit)}</text>` : `\n<small class="asset-credit">${escape(credit)}</small>`;
  return { compatible: !reason, reason, type, snippet, reference, credit, licenseState, creditPlacement, strategy };
}
export async function insertDownloadedAsset(context, asset, format, download, options = {}) {
  const plan = planAssetInsertion(context, asset, format, { ...options, creditPlacement: options.attribute ? options.creditPlacement : 'project', download });
  if (!plan.compatible) throw new Error(plan.reason);
  if ((plan.licenseState === 'unknown' || (plan.licenseState === 'required' && !options.attribute)) && !options.acceptLicenseResponsibility) throw new Error('Explicit license responsibility confirmation is required.');
  if (options.strategy === 'path' && !options.confirmPathInsertion) throw new Error('Confirm the reviewed path-only insertion first.');
  const credit = options.attribute && options.creditPlacement === 'visible' ? plan.credit : '';
  let result;
  if (context.kind === 'code') result = insertAssetCode(context, plan.snippet);
  if (context.kind === 'html') {
    context.root.focus(); const selection = context.root.ownerDocument.getSelection(); selection.removeAllRanges(); selection.addRange(context.range.cloneRange());
    result = context.api.insertHTMLAtCaret(plan.snippet);
  }
  if (context.kind === 'svg') result = await context.api.insertImageFromInsertion({ src: download.url, previewSrc: download.url,
    linkedNotebookPath: download.path.startsWith('Notebook/') ? download.path : '', sourceName: asset.name, layerId: context.layer.id, credit });
  if (context.kind === 'raster') result = await context.api.insertImageFromInsertion({ src: download.url, credit,
    validate: () => !validateAssetEditorContext(context) });
  if (context.kind === 'world') result = await context.api.insertDownloadedImage({ imageFile: download.path.startsWith('Notebook/') ? download.path : download.url, name: asset.name, position: context.position,
    assetProvenance: { title: asset.name, creator: asset.creator || '', source: asset.source, license: asset.license, licenseUrl: asset.licenseUrl, credit: assetCredit(asset) },
    validate: () => !validateAssetEditorContext(context) });
  if (!result) throw new Error('The editor rejected insertion; the downloaded asset remains saved.');
  return { inserted: true, pendingPlacement: result.pendingPlacement === true, plan };
}
