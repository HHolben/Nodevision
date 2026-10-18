// Nodevision/ApplicationSystem/public/AssetDownloads/DownloadWorkflow.mjs
// Keeps download, editor insertion and attribution independently retryable while retaining the original document target.
import { addDownloadWorkflowView } from './DownloadWorkflowView.mjs';
import { captureAssetEditorContext, listAssetEditorCells } from './AssetEditorContext.mjs';
import { planAssetInsertion, insertDownloadedAsset } from './AssetInsertionService.mjs';
import { assetCredit, recordAttribution, exportAssetCredits } from './AssetAttributionService.mjs';
import { assetRequest } from './DownloadClient.mjs';
export function createDownloadWorkflow(view, { getState, changedTarget, status }) {
  const ui = addDownloadWorkflowView(view); let origin = null; let saved = null; let lastSelection = null; let cells = []; let disposed = false;
  function options() { return { strategy: ui.strategy.value, creditPlacement: ui.creditPlacement.value,
    attribute: ui.action.value === 'attribute', acceptLicenseResponsibility: ui.consent.checked, confirmPathInsertion: ui.confirmPath.checked }; }
  function refresh() {
    const { selected, transfer } = getState(); const format = selected?.formats.find(item => item.id === view.format.value);
    const plan = planAssetInsertion(origin, selected || {}, format, options());
    const key = `${selected?.id}:${format?.id}:${origin?.capturedAt}`;
    if (lastSelection !== key) { ui.action.value = plan.compatible ? 'attribute' : 'only'; ui.consent.checked = false; ui.confirmPath.checked = false; lastSelection = key; }
    for (const option of ui.action.options) option.disabled = option.value !== 'only' && !plan.compatible;
    if (!plan.compatible) ui.action.value = 'only';
    ui.strategy.disabled = origin?.kind !== 'code';
    ui.creditPlacement.disabled = ui.action.value !== 'attribute';
    const explicitLicense = plan.licenseState === 'unknown' || (plan.licenseState === 'required' && ui.action.value !== 'attribute');
    const needsPath = ui.action.value !== 'only' && ui.strategy.value === 'path';
    view.download.textContent = ui.action.value === 'only' ? 'Download Only' : ui.action.value === 'insert' ? 'Download and Insert' : 'Download, Insert, and Attribute';
    view.download.disabled = !format || !view.destination.value || !!transfer || (ui.action.value !== 'only' && ((explicitLicense && !ui.consent.checked) || (needsPath && !ui.confirmPath.checked)));
    const destination = getState().config?.destinations.find(item => item.id === view.destination.value);
    ui.preview.textContent = [
      `Asset: ${selected?.name || 'None'} · Source: ${selected?.sourceName || selected?.provider || ''}`,
      `License: ${selected?.license || 'unknown'} (${plan.licenseState} attribution)`,
      `Destination: ${destination?.path || ''}/${view.folder.value} (duplicate-safe filename assigned at download)`,
      `Document: ${origin?.path || 'No captured editor'}`,
      `Insertion: ${plan.type || 'Download Only'}`, plan.reason,
      `Credit: ${plan.credit}`, `Placement: ${ui.action.value === 'attribute' ? ui.creditPlacement.value : 'Provenance sidecar/project record only'}`,
      ui.creditPlacement.value === 'project' ? 'Project credits must accompany distribution; hidden metadata alone may not satisfy a required license.' : '',
      plan.snippet || '',
    ].filter(Boolean).join('\n');
    return plan;
  }
  function targets() {
    cells = listAssetEditorCells(); ui.target.replaceChildren();
    for (const [index, cell] of cells.entries()) ui.target.append(new Option(cell.__nvHtmlEditorContext?.filePath || cell.dataset.currentFilePath || cell.dataset.id || `Editor ${index + 1}`, String(index)));
    const index = cells.indexOf(origin?.cell); if (index >= 0) ui.target.value = String(index);
  }
  async function setOrigin(next) {
    if (!next || disposed) return; origin = next;
    if (saved && !saved.inserted && saved.origin?.path === next.path) saved.origin = next; lastSelection = null; ui.strategy.value = 'markup';
    ui.creditPlacement.value = ['html', 'svg', 'raster'].includes(origin.kind) || origin.kind === 'code' && origin.extension !== 'php' ? 'visible' : 'project';
    targets(); refresh(); await changedTarget(origin);
  }
  ui.target.onfocus = targets;
  ui.capture.onclick = async () => {
    try { const next = await captureAssetEditorContext(cells[Number(ui.target.value)]); if (!next) throw Error('Choose an open supported editor.'); await setOrigin(next); }
    catch (error) { status(error.message); }
  };
  for (const input of [ui.action, ui.strategy, ui.creditPlacement, ui.consent, ui.confirmPath, view.destination, view.folder]) input.addEventListener('change', refresh);
  ui.copy.onclick = async () => { try { const plan = refresh(); await navigator.clipboard.writeText(plan.snippet || plan.reference || ''); status('Proposed snippet copied.'); } catch (error) { status(`Could not copy snippet: ${error.message}`); } };
  async function finish(job) {
    if (disposed) return;
    ui.retry.hidden = true;
    try {
      if (job.action !== 'only' && !job.inserted) {
        const result = await insertDownloadedAsset(job.origin, job.asset, job.format, job.download, job.options);
        job.inserted = true; job.pendingPlacement = result.pendingPlacement;
        if (job.pendingPlacement) { ui.commit.hidden = false; ui.discard.hidden = false; }
      }
      if (job.origin?.path && /\.(html?|svg|php|png|jpe?g|gltf|glb)$/i.test(job.origin.path)) {
        const result = await recordAttribution(job.download, job.origin.path, job.inserted && !job.pendingPlacement);
        ui.creditsText.textContent = result.text;
      }
      status(`Saved to ${job.download.path}.${job.inserted ? job.pendingPlacement ? ' Position/resize the raster selection, then commit or cancel placement.' : ' Inserted into ' + job.origin.path + '; use the editor’s normal save command.' : ' Download Only; document unchanged.'}${job.options.attribute ? ' Credits recorded; include them when distributing the document.' : ''}`);
    } catch (error) {
      ui.retry.hidden = false;
      status(`Asset remains saved at ${job.download.path}. ${job.inserted ? 'Insertion succeeded, but attribution failed' : job.action === 'only' ? 'Provenance sidecar saved, but project credits failed' : 'Insertion failed'}: ${error.message}`);
    }
  }
  ui.retry.onclick = () => { if (saved) void finish(saved); };
  ui.commit.onclick = async () => {
    if (!saved?.pendingPlacement) return;
    if (!saved.origin.api.commitAssetPlacement()) { status('The raster placement is no longer pending.'); return; }
    saved.pendingPlacement = false; ui.commit.hidden = ui.discard.hidden = true; await finish(saved);
  };
  ui.discard.onclick = () => { saved?.origin?.api?.cancelAssetPlacement?.(); ui.commit.hidden = ui.discard.hidden = true; if (saved) { saved.pendingPlacement = false; saved.inserted = false; saved.action = 'only'; } status('Raster placement cancelled. The downloaded asset remains saved.'); };
  ui.refreshCredits.onclick = async () => { try { if (!origin?.path) throw Error('Capture an editor first.'); const data = await assetRequest('attributions', { document: origin.path }); ui.creditsText.textContent = data.text || 'No project credits yet.'; } catch (error) { status(error.message); } };
  ui.exportCredits.onclick = () => exportAssetCredits(ui.creditsText.textContent || assetCredit(getState().selected || {}));
  return { refresh, setOrigin, getOrigin: () => origin,
    snapshot() { const state = getState(); return { origin, asset: state.selected, format: state.selected?.formats.find(item => item.id === view.format.value), action: ui.action.value, options: options() }; },
    async complete(download, job) { saved = { ...job, download }; await finish(saved); },
    dispose() { disposed = true; if (saved?.pendingPlacement) saved.origin.api.cancelAssetPlacement(); },
  };
}
