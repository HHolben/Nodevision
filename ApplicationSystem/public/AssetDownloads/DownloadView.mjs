// Nodevision/ApplicationSystem/public/AssetDownloads/DownloadView.mjs
// Builds accessible discovery controls and renders provider strings as inert text.
export function element(tag, text = '', parent) {
  const node = document.createElement(tag); node.textContent = text; parent?.append(node); return node;
}
export function fillOptions(select, options, placeholder = '') {
  select.replaceChildren();
  if (placeholder) select.append(new Option(placeholder, ''));
  for (const item of options) select.append(new Option(item.name || item.label || item, item.id || item));
}
export function buildDownloadView(root) {
  root.replaceChildren();
  root.style.cssText = 'overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0;font:13px system-ui';
  const form = element('form', '', root); form.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
  function control(parent, title, tag) {
    const label = element('label', title, parent); const input = element(tag, '', label);
    input.setAttribute('aria-label', title); input.style.cssText = 'display:block;max-width:100%;min-width:0'; return input;
  }
  const query = control(form, 'Search assets', 'input'); query.type = 'search'; query.maxLength = 200;
  const provider = control(form, 'Source', 'select'); const category = control(form, 'Category', 'select');
  const formatFilter = control(form, 'File format', 'select'); const license = control(form, 'License', 'select');
  const search = element('button', 'Search', form); search.type = 'submit';
  const credit = element('a', '', root); credit.target = '_blank'; credit.rel = 'noopener noreferrer';
  const status = element('div', 'Loading asset sources…', root); status.setAttribute('role', 'status');
  const results = element('div', '', root); results.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px';
  const more = element('button', 'Next results', root); more.hidden = true;
  const details = element('section', 'Select an asset to inspect its license and formats.', root);
  const format = control(root, 'Download format', 'select');
  const destination = control(root, 'Destination', 'select');
  const folder = control(root, 'Optional subfolder in destination', 'input'); folder.placeholder = 'e.g. Landscapes';
  element('p', 'The selected action saves the original asset and provenance. Insertion uses the captured editor; editor changes require normal saving.', root);
  const download = element('button', 'Download', root); download.disabled = true;
  const cancel = element('button', 'Cancel download', root); cancel.disabled = true;
  const progress = element('progress', '', root); progress.max = 1; progress.value = 0;
  element('h3', 'Recently downloaded', root); const recent = element('ul', '', root);
  return { credit, form, query, provider, category, formatFilter, license, search, status, results, more, details, format, destination, folder, download, cancel, progress, recent };
}
export function previewImage(asset, parent) {
  if (!asset.preview) return null;
  const image = element('img', '', parent); image.src = asset.preview; image.alt = asset.name;
  image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.style.cssText = 'width:100%;max-width:256px;height:100px;object-fit:contain';
  image.onerror = () => image.remove(); return image;
}
export function renderAssetDetails(view, asset) {
  view.details.replaceChildren(); element('h3', asset.name, view.details); previewImage(asset, view.details);
  element('p', `Creator: ${asset.creator || 'Not provided'}`, view.details); element('p', asset.description, view.details);
  const link = element('a', `View source: ${asset.sourceName || asset.provider}`, view.details); link.href = asset.source; link.target = '_blank'; link.rel = 'noopener noreferrer';
  element('p', `License: ${asset.license}. ${asset.attribution}`, view.details);
  element('p', asset.note, view.details);
  fillOptions(view.format, asset.formats.map(item => ({ id: item.id, name: `${item.label} (${(item.size / 1048576).toFixed(2)} MB)` })));
  if (!asset.formats.length) element('p', 'No supported standalone downloads for this asset (128 MB limit).', view.details);
}
