// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/DownloadAssetsPanel.mjs
// Coordinates cancellable discovery and explicit downloads within a normal Nodevision panel.
import { renderProviderDirectory } from '/AssetDownloads/ProviderDirectoryView.mjs';
import { createDownloadWorkflow } from '/AssetDownloads/DownloadWorkflow.mjs';
import { assetRequest, saveAsset } from '/AssetDownloads/DownloadClient.mjs';
import { buildDownloadView, element, fillOptions, previewImage, renderAssetDetails } from '/AssetDownloads/DownloadView.mjs';
const recentDownloads = [];
export function createPanel(content, vars = {}, panel = null) {
  const view = buildDownloadView(content);
  const lifetime = new AbortController();
  let browsing = null; let inspecting = null; let transfer = null; let selected = null; let config = null; let next = null;
  const signalFor = controller => AbortSignal.any([controller.signal, lifetime.signal]);
  const status = text => { view.status.textContent = text; };
  let configRequest = null;
  const workflow = createDownloadWorkflow(view, { getState: () => ({ selected, transfer, config }), changedTarget: loadConfig, status, mode: vars.mode, settings: vars.settings });
  if (panel) { panel.__nvSetAssetOrigin = workflow.setOrigin; panel.__nvSetAssetLaunch = workflow.setLaunch; }
  function showRecent() {
    view.recent.replaceChildren();
    for (const item of recentDownloads) element('li', `${item.name} — ${item.path} (${item.license})`, view.recent);
  }
  function destinations() {
    const previous = view.destination.value;
    const type = selected?.formats.find(item => item.id === view.format.value)?.extension === 'glb' ? 'model' : 'image';
    const items = (config?.destinations || []).filter(item => item.type === type || item.type === 'project').sort((a, b) => Number(b.id.includes('notebook')) - Number(a.id.includes('notebook')));
    fillOptions(view.destination, items.map(item => ({ id: item.id, name: `${item.name}: ${item.path}` })));
    if (items.some(item => item.id === previous)) view.destination.value = previous;
    workflow.refresh();
  }
  async function inspect(item) {
    inspecting?.abort(); const controller = inspecting = new AbortController();
    selected = null; workflow.refresh(); view.download.disabled = true; view.details.textContent = 'Loading asset details…';
    try {
      const asset = await assetRequest('inspect', { provider: view.provider.value, asset: item.id }, signalFor(controller));
      if (controller.signal.aborted || lifetime.signal.aborted) return;
      selected = asset; renderAssetDetails(view, asset);
      const matching = asset.formats.find(format => format.extension === view.formatFilter.value);
      if (matching) view.format.value = matching.id;
      destinations();
    } catch (error) { if (!controller.signal.aborted && !lifetime.signal.aborted) view.details.textContent = `Could not inspect asset: ${error.message}`; }
  }
  async function search(offset = 0) {
    browsing?.abort(); inspecting?.abort(); const controller = browsing = new AbortController();
    selected = null; workflow.refresh(); view.download.disabled = true; view.more.hidden = true; view.results.replaceChildren();
    view.details.textContent = 'Select an asset to inspect its license and formats.'; view.format.replaceChildren();
    status('Searching…');
    try {
      const data = await assetRequest('search', { provider: view.provider.value, query: view.query.value, category: view.category.value,
        format: view.formatFilter.value, license: view.license.value, offset }, signalFor(controller));
      if (controller.signal.aborted || lifetime.signal.aborted) return;
      for (const item of data.items) {
        const button = element('button', '', view.results); previewImage(item, button);
        element('div', item.name, button); element('small', `${item.sourceName || item.provider} · ${item.license}`, button);
        button.onclick = () => void inspect(item);
      }
      next = data.next; view.more.hidden = next === null;
      status(data.items.length ? `${data.items.length} results. Select an asset for details.` : `No matches on this page.${next !== null ? ' Try Next results.' : ''} This source may not support the selected category or format.`);
    } catch (error) { if (!controller.signal.aborted && !lifetime.signal.aborted) status(`Search failed: ${error.message}. Try Search again.`); }
  }
  view.form.onsubmit = event => { event.preventDefault(); if (config) void search(); };
  view.more.onclick = () => void search(next);
  view.format.onchange = destinations;
  view.destination.addEventListener('change', () => { view.folder.value = config?.destinations.find(item => item.id === view.destination.value)?.subdirectory || ''; workflow.refresh(); });
  view.provider.onchange = () => {
    const provider = config.providers.find(item => item.id === view.provider.value);
    const previousCategory = view.category.value;
    const providerCategories = provider.categories || config.categories;
    fillOptions(view.category, providerCategories, 'All categories');
    if (providerCategories.some(item => item.id === previousCategory)) view.category.value = previousCategory;
    view.credit.textContent = provider.credit?.label || provider.name;
    if (provider.credit?.url) view.credit.href = provider.credit.url; else view.credit.removeAttribute('href');
    fillOptions(view.formatFilter, provider.formats, 'All formats'); fillOptions(view.license, provider.licenses, 'All licenses');
    void search();
  };
  view.download.onclick = async () => {
    if (!selected || transfer || !view.destination.value) return;
    const job = workflow.snapshot();
    const controller = transfer = new AbortController();
    view.download.disabled = true; view.cancel.disabled = false; view.progress.value = 0; status('Starting download…');
    try {
      const result = await saveAsset({ provider: selected.provider, asset: selected.id, format: view.format.value,
        destination: view.destination.value, subdirectory: view.folder.value, document: /\.(html?|svg|php|png|jpe?g|gltf|glb)$/i.test(job.origin?.path || '') ? job.origin.path : '' }, signalFor(controller), progress => {
        view.progress.value = progress.received / progress.total;
        status(`Downloading: ${Math.round(view.progress.value * 100)}%`);
      });
      recentDownloads.unshift(result); recentDownloads.splice(20); showRecent(); status(`Saved to ${result.path}`);
      window.dispatchEvent(new CustomEvent('asset-download-completed', { detail: result }));
      if (!lifetime.signal.aborted) await workflow.complete(result, job);
    } catch (error) { if (!lifetime.signal.aborted) status(controller.signal.aborted ? 'Download cancelled. Incomplete files were removed.' : `Download failed: ${error.message}`); }
    finally { transfer = null; view.cancel.disabled = true; destinations(); }
  };
  view.cancel.onclick = () => transfer?.abort();
  content.cleanup = () => { lifetime.abort(); browsing?.abort(); inspecting?.abort(); transfer?.abort(); configRequest?.abort(); workflow.dispose(); };
  showRecent();
  async function loadConfig(origin = null) {
    configRequest?.abort(); const controller = configRequest = new AbortController();
    try {
      const document = /\.(html?|svg|php|png|jpe?g|gltf|glb)$/i.test(origin?.path || '') ? origin.path : '';
      const data = await assetRequest('config', document ? { document } : {}, signalFor(controller));
      if (controller.signal.aborted || lifetime.signal.aborted) return;
      const first = !config; config = data;
      renderProviderDirectory(content, data.sourceDirectory || []);
      if (first) { fillOptions(view.provider, data.providers); fillOptions(view.category, data.categories, 'All categories'); }
      destinations();
      const project = data.destinations.find(item => item.type === 'project');
      if (project) { view.destination.value = project.id; view.folder.value = project.subdirectory || ''; }
      workflow.refresh();
      if (first) view.provider.onchange();
    } catch (error) { if (!controller.signal.aborted && !lifetime.signal.aborted) status(`Cannot load sources: ${error.message}. Capture a target or reopen to retry.`); }
  }
  if (vars.origin) void workflow.setOrigin(vars.origin); else void loadConfig();
}
