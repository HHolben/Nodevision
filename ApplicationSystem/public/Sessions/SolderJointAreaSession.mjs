// Solder analysis orchestrates shared drawing, layers, history, worker measurements and saves.
import { setupPanel as setupLayersPanel } from '../PanelInstances/InfoPanels/SVGLayersPanel.mjs';
import { createAnalysisLayers } from '../RasterAnalysis/AnalysisLayers.mjs';
import { createSvgUndoStack } from '../PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgUndoStack.mjs';
import { mountEditor } from '../SolderAnalysis/Editor.mjs';
import { assignParent, labelsFor } from '../SolderAnalysis/Measurement.mjs';
import { parseAnalysis, serializeAnalysis, readJpeg, colors } from '../SolderAnalysis/Document.mjs';
import { generateReport } from '../SolderAnalysis/Report.mjs';
import { saveAnalysisFile } from '../SolderAnalysis/Files.mjs';
function node(tag, text, parent) { const n = document.createElement(tag); if (text) n.textContent = text; parent?.append(n); return n; }
export async function startSolderJointAreaAnalysis(context = {}) {
  const root = context.root || document.getElementById('nv-session-root') || document.body;
  const previousEscapeDisabled = root.dataset.escapeDisabled; root.dataset.escapeDisabled = 'true';
  const surface = node('div'); surface.className = 'nv-solder-session'; surface.tabIndex = 0;
  surface.innerHTML = `<style>
.nv-solder-session{display:grid;grid-template-rows:auto minmax(0,1fr);width:100%;height:100vh;background:#eee;color:#18212b;font:13px system-ui;text-align:left}.nv-solder-session *{box-sizing:border-box}.nv-solder-session header{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:8px}.nv-solder-session button,.nv-solder-session select{padding:5px;margin:2px}.nv-solder-body{display:grid;grid-template-columns:310px minmax(0,1fr);min-height:0}.nv-solder-home{overflow:auto;background:#fafafa}.nv-solder-controls{padding:10px;color:#18212b;background:#fafafa;font:13px system-ui}.nv-solder-controls label{display:block;margin:6px 0}.nv-solder-controls pre{white-space:pre-wrap}.nv-solder-viewport{overflow:auto;min-width:0;min-height:0;background:#333}.nv-solder-controls table{font-size:12px;width:100%;border-collapse:collapse}.nv-solder-controls td,.nv-solder-controls th{padding:4px;text-align:left;border-bottom:1px solid #ccc}
</style>`;
  const header = node('header', '', surface); node('strong', 'Solder Joint Area Analysis', header);
  const body = node('div', '', surface); body.className = 'nv-solder-body';
  const home = node('aside', '', body); home.className = 'nv-solder-home';
  const controls = node('div', '', home); controls.className = 'nv-solder-controls';
  const viewport = node('main', '', body); viewport.className = 'nv-solder-viewport'; root.replaceChildren(surface);
  let state = { width: 0, height: 0, source: null, regions: [], layers: [], settings: { fillRule: 'evenodd', curveTolerance: .001 }, annotationOptions: { labels: true } };
  let documentRevision = 0, editing = false;
  let activeLayer = 'total', selected = null, result = null, history = createSvgUndoStack(), revision = 0, worker = null, busy = false, dirty = false, disposed = false, panel = null;
  const layers = createAnalysisLayers();
  layers.restore(['total', 'void'].map(id => ({ id, type: 'region', name: id === 'total' ? 'Total Area' : 'Void Area', visible: true, locked: false, enabled: true, config: { color: colors[id] } })));
  state.layers = layers.layers;
  const sourceInfo = node('p', 'Open a JPEG or reopen a saved analysis.', controls);
  const layerHome = node('div', '', controls), layerControls = node('div');
  await setupLayersPanel(layerHome, { layerProvider: { id: 'solder', title: 'Analysis Layers', attachHost(host) { host.append(layerControls); return () => layerControls.remove(); } } });
  const regionSelect = node('select', '', controls); regionSelect.setAttribute('aria-label', 'Selected region');
  const parentSelect = node('select', '', controls); parentSelect.setAttribute('aria-label', 'Parent region');
  const selectedInfo = node('pre', '', controls), summary = node('div', '', controls), warnings = node('pre', '', controls), status = node('p', '', controls); status.setAttribute('role', 'status');
  const setStatus = text => { status.textContent = text; };
  function button(label, action, parent = header) {
    const b = node('button', label, parent); b.type = 'button'; b.onclick = async () => { try { await action(); } catch (error) { if (error.name !== 'AbortError') setStatus(error.message); } }; return b;
  }
  const file = node('input', '', header); file.type = 'file'; file.accept = '.jpg,.jpeg'; file.setAttribute('aria-label', 'Open JPEG');
  const reopen = node('input', '', header); reopen.type = 'file'; reopen.accept = '.json'; reopen.setAttribute('aria-label', 'Reopen analysis');
  function inputAction(input, action) { input.onchange = async () => { try { if (input.files[0]) await action(input.files[0]); } catch (e) { setStatus(e.message); } finally { input.value = ''; } }; }
  inputAction(file, f => loadJpeg(f)); inputAction(reopen, async f => loadState(parseAnalysis(await f.text())));
  const notebookPath = node('input', '', controls); notebookPath.placeholder = 'Notebook-relative JPEG or .solder.json path'; notebookPath.setAttribute('aria-label', 'Notebook source path');
  button('Open Notebook file', async () => {
    const path = notebookPath.value.trim().replace(/^\/?Notebook\//, '');
    if (!path || path.split('/').includes('..') || path.startsWith('/')) throw Error('Use a Notebook-relative path');
    const response = await fetch('/Notebook/' + path.split('/').map(encodeURIComponent).join('/'), { cache: 'no-store' });
    if (!response.ok) throw Error(`Cannot open file: ${response.status}`);
    if (/\.json$/i.test(path)) await loadState(parseAnalysis(await response.text()));
    else await loadJpeg(new File([await response.blob()], path.split('/').at(-1), { type: 'image/jpeg' }), path);
  }, controls);
  const editor = mountEditor(viewport, { state: () => state, activeLayer: () => activeLayer, selected: () => selected, keyboardHost: surface, status: setStatus,
    select(id) { selected = id; renderPanel(); }, restore(before) { editing = false; state.regions = before.regions; calculate(); }, pending() { editing = true; revision++; result = null; report.disabled = true; }, edited(before) { editing = false; record(before); calculate(); },
    replace(id, replacement) {
      const region = state.regions.find(r => r.id === id);
      if (!region || layers.layers.find(l => l.id === region.type)?.locked) return;
      const before = snapshot(); delete region.points; region.model = replacement.model;
      if (region.type === 'void') region.parentId = assignParent(region, state.regions, state.width, state.height);
      record(before); calculate();
    },
    add(region) {
      const before = snapshot(); region.id = crypto.randomUUID(); region.type = activeLayer;
      if (activeLayer === 'void') { try { region.parentId = assignParent(region, state.regions, state.width, state.height); } catch { region.parentId = null; } }
      state.regions.push(region); selected = region.id; record(before); calculate();
    }
  });
  const modes = { freehand: ['Freehand Trace', 'Drag to trace; release to close. Escape cancels.'], polygon: ['Polygon / Vertex', 'Click vertices; Enter or click the first vertex to close.'], select: ['Edit Perimeter', 'Select a boundary; G moves, S scales, or drag points to edit. Click or Enter confirms; Escape cancels.'], bezier: ['Bezier', 'Click anchors; drag to curve. Enter closes.'], pan: ['Pan', 'Drag to pan the image.'] };
  const modeButtons = new Map();
  function setMode(tool) { editor.setTool(tool); for (const [key, b] of modeButtons) b.setAttribute('aria-pressed', String(key === tool)); setStatus(modes[tool][1]); }
  for (const [tool, [label]] of Object.entries(modes)) { const b = button(label, () => setMode(tool)); b.setAttribute('aria-pressed', String(tool === 'freehand')); modeButtons.set(tool, b); }
  const touchLabel = node('label', '', header), touch = node('input', '', touchLabel); touch.type = 'checkbox'; touch.checked = true; touchLabel.append('Touch drawing');
  touch.onchange = () => editor.setTouchEnabled(touch.checked);
  touch.title = 'Disable when using a stylus to prevent palm marks before or after pen contact.';
  button('Redraw selected', () => {
    const r = state.regions.find(r => r.id === selected);
    if (!r || layers.layers.find(l => l.id === r.type)?.locked) return;
    activeLayer = r.type; renderLayers(); setMode('freehand'); editor.redraw(r.id);
    setStatus('Trace a replacement boundary. Release to replace; Escape keeps the original.');
  }, controls);
  button('Fit', () => editor.fit()); button('100%', () => editor.setZoom(1)); button('−', () => editor.setZoom(editor.zoom / 1.25)); button('+', () => editor.setZoom(editor.zoom * 1.25));
  function snapshot() { return structuredClone({ ...state, layers: layers.layers }); }
  function restore(saved) { documentRevision++; dirty = true; state = structuredClone(saved); layers.restore(state.layers); state.layers = layers.layers; renderLayers(); editor.paint(); calculate(); }
  function record(before) {
    const after = snapshot(); documentRevision++; dirty = true;
    history.pushCustom({ undo: () => restore(before), redo: () => restore(after) });
  }
  const undo = () => { editor.cancel(); history.undo(); }, redo = () => { editor.cancel(); history.redo(); };
  button('Undo', undo); button('Redo', redo);
  button('Delete region', () => {
    editor.cancel();
    const r = state.regions.find(r => r.id === selected); if (!r || layers.layers.find(l => l.id === r.type)?.locked) return;
    const before = snapshot(); state.regions = state.regions.filter(r => r.id !== selected); selected = null; record(before); editor.paint(); calculate();
  }, controls);
  button('Save analysis', async () => { if (!state.source) throw Error('Open a JPEG first'); if (editor.hasDraft) throw Error('Complete or cancel the unfinished path before saving'); const savedRevision = documentRevision; const saved = await (context.save || saveAnalysisFile)(snapshot(), serializeAnalysis(snapshot()), false); if (saved) { if (savedRevision === documentRevision) dirty = false; setStatus(`Saved ${saved}`); } }, controls);
  const report = button('Generate HTML Report', async () => {
    if (editor.hasDraft) throw Error('Complete or cancel the unfinished path before generating a report');
    if (!result || result.warnings.length) throw Error('Wait for measurements and correct validation warnings');
    const saved = await (context.save || saveAnalysisFile)(snapshot(), generateReport(state, result), true); if (saved) setStatus(`Saved ${saved}`);
  }, controls); report.disabled = true;
  button('Dock / undock analysis panel', async () => {
    if (panel?.isConnected) { panel.__nvSetLayout?.('overlay'); return; }
    const { createPanelDOM } = await import('../panels/panelFactory.mjs');
    ({ panel } = await createPanelDOM('SolderAnalysisPanel', `solder-analysis-${Date.now()}`, 'InfoPanel', { displayName: 'Solder Joint Analysis', controls, home }));
    document.body.append(panel); panel.__nvSetLayout?.('overlay'); panel.style.zIndex = '10010';
  });
  button('Finish session', () => { if (dirty && !window.confirm('Leave this analysis without saving recent edits?')) return; dispose(); context.executionContext?.emit?.('session.solderAnalysis.finished', { ok: true }); });
  function renderLayers() {
    layerControls.replaceChildren();
    for (const l of layers.layers) {
      const row = node('div', '', layerControls);
      const b = button(l.name, () => { editor.cancel(); activeLayer = l.id; renderLayers(); renderPanel(); }, row); b.style.color = colors[l.id]; b.style.background = '#222'; b.setAttribute('aria-pressed', String(activeLayer === l.id));
      for (const [key, caption] of [['visible', 'Visible'], ['locked', 'Locked']]) {
        const label = node('label', '', row), check = node('input', '', label); check.type = 'checkbox'; check.checked = !!l[key]; label.append(document.createTextNode(caption)); check.setAttribute('aria-label', `${l.name} ${caption}`);
        check.onchange = () => { editor.cancel(); const before = snapshot(); layers.update(l.id, { [key]: check.checked }); record(before); editor.paint(); };
      }
    }
  }
  function renderPanel() {
    const labels = labelsFor(state.regions), r = state.regions.find(r => r.id === selected), m = result?.regions.find(r => r.id === selected);
    sourceInfo.textContent = state.source ? `${state.source.name} · ${state.width} × ${state.height} px · Active: ${activeLayer === 'total' ? 'Total Area' : 'Void Area'}` : 'Choose a JPEG to begin.';
    regionSelect.replaceChildren(new Option('Select a region', ''));
    for (const r of state.regions) regionSelect.add(new Option(labels[r.id], r.id)); regionSelect.value = selected || '';
    parentSelect.replaceChildren(new Option('Choose parent', '')); for (const p of state.regions.filter(r => r.type === 'total')) parentSelect.add(new Option(labels[p.id], p.id));
    parentSelect.hidden = r?.type !== 'void'; parentSelect.value = r?.parentId || ''; parentSelect.disabled = !!layers.layers.find(l => l.id === r?.type)?.locked;
    selectedInfo.textContent = r ? `${labels[r.id]} · ${r.type === 'total' ? 'Total Area' : 'Void Area'}\nArea: ${m?.area ?? '…'} px²\nMean: ${m?.rgba ? `rgba(${m.rgba.map(v => v.toFixed(2)).join(', ')})` : '…'}${r.type === 'void' ? `\nParent: ${labels[r.parentId] || 'Unassigned'}` : ''}` : 'No region selected';
    summary.replaceChildren(); node('p', `${state.regions.filter(r => r.type === 'total').length} total regions · ${state.regions.filter(r => r.type === 'void').length} voids`, summary);
    node('p', `Overall void: ${result?.overallPercentage?.toFixed(2) ?? '—'}%`, summary);
    if (result) { const table = node('table', '', summary); for (const p of result.regions.filter(r => r.type === 'total')) { const row = node('tr', '', table); node('th', p.label, row); node('td', `${p.area} px²`, row); node('td', `${p.voidPercentage?.toFixed(2) ?? '—'}% void`, row); } }
    warnings.textContent = result?.warnings.join('\n') || (busy ? 'Measuring…' : ''); report.disabled = !result || !!result.warnings.length;
  }
  regionSelect.onchange = () => { selected = regionSelect.value; setMode('select'); renderPanel(); };
  parentSelect.onchange = () => { editor.cancel(); const before = snapshot(), r = state.regions.find(r => r.id === selected); if (r) { r.parentId = parentSelect.value || null; record(before); editor.paint(); calculate(); } };
  let requestId = 0, loadGeneration = 0; const requests = new Map(), workers = new Set();
  function request(message, target = worker) {
    return new Promise((resolve, reject) => {
      const id = ++requestId; requests.set(id, { resolve, reject, target });
      try { target.postMessage({ ...message, id }); } catch (error) { requests.delete(id); reject(error); }
    });
  }
  function stopWorker(target) {
    target?.terminate(); workers.delete(target);
    for (const [id, p] of requests) if (p.target === target) { requests.delete(id); p.reject(Error('Image changed or session closed')); }
  }
  function makeWorker() {
    const target = new Worker(new URL('../SolderAnalysis/Worker.mjs', import.meta.url), { type: 'module' }); workers.add(target);
    target.onmessage = ({ data }) => { const p = requests.get(data.id); requests.delete(data.id); data.error ? p?.reject(Error(data.error)) : p?.resolve(data); };
    target.onerror = event => { for (const [id, p] of requests) if (p.target === target) { requests.delete(id); p.reject(Error(event.message || 'Measurement worker failed')); } };
    return target;
  }
  async function loadState(next) {
    if (dirty && !context.skipConfirm && !window.confirm('Replace this analysis without saving recent edits?')) return;
    const generation = ++loadGeneration, candidate = makeWorker();
    try {
      const blob = await (await fetch(next.source.dataUrl)).blob();
      if (disposed || generation !== loadGeneration) { stopWorker(candidate); return; }
      const size = await request({ image: blob }, candidate);
      if (disposed || generation !== loadGeneration) { stopWorker(candidate); return; }
      if (next.width && (next.width !== size.width || next.height !== size.height)) throw Error('Saved dimensions do not match the JPEG');
      editor.cancel(); revision++; busy = false; result = null; report.disabled = true;
      const previousWorker = worker; worker = candidate; stopWorker(previousWorker);
      state = { ...next, width: size.width, height: size.height }; layers.restore(next.layers); state.layers = layers.layers;
      history = createSvgUndoStack(); documentRevision++; selected = null; dirty = false; renderLayers(); editor.paint(); editor.fit(); calculate();
      setStatus(state.source.notebookPath ? 'Reports save beside the Notebook JPEG.' : 'Local file: use Save As to save the report beside the JPEG. Without Save As support, files download.');
    } catch (error) { stopWorker(candidate); throw error; }
  }
  async function loadJpeg(f, notebookPath = '') { await loadState({ ...snapshot(), source: { ...await readJpeg(f), notebookPath }, width: 0, height: 0, regions: [] }); }
  function calculate() { revision++; result = null; report.disabled = true; renderPanel(); if (!busy && !editing && worker && state.width) void pump(); }
  async function pump() {
    busy = true; const version = revision, activeWorker = worker;
    try { const response = await request({ regions: state.regions }); if (!disposed && version === revision && worker === activeWorker) result = response.result; }
    catch (e) { if (!disposed && worker === activeWorker) setStatus(e.message); }
    finally { if (worker === activeWorker) { busy = false; if (!disposed && version !== revision && !editing) void pump(); else if (!disposed) renderPanel(); } }
  }
  const key = e => { if (e.target.closest('input,textarea,select')) return; if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) { e.preventDefault(); e.key.toLowerCase() === 'y' || e.shiftKey ? redo() : undo(); } };
  surface.addEventListener('keydown', key);
  const beforeUnload = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', beforeUnload);
  function dispose() { if (disposed) return; disposed = true; editor.dispose(); loadGeneration++; for (const target of workers) stopWorker(target); requests.clear(); panel?.querySelector('.panel-content')?.cleanup?.(); panel?.remove(); layerHome.cleanup?.(); layers.dispose(); if (previousEscapeDisabled === undefined) delete root.dataset.escapeDisabled; else root.dataset.escapeDisabled = previousEscapeDisabled; window.removeEventListener('beforeunload', beforeUnload); surface.remove(); }
  context.executionContext?.addCleanup?.(dispose); renderLayers(); renderPanel();
  // A real file chooser is presented immediately; the visible input also works if activation expired.
  if (!context.noPrompt) file.click();
  return { ok: true, loadJpeg, loadState, snapshot, get result() { return result; }, editor, dispose, surface };
}
