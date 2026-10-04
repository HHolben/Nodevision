// Browser integration cases for the bounded Properties surface, source ownership and cascade behavior.
import './html-foundation-workspace.mjs';
import { setupPanel } from '/PanelInstances/InfoPanels/HTMLPropertiesPanel.mjs';
import { discoverHtmlProperties, prepareHtmlCssDocument, propertiesDiagnostics } from '/PanelInstances/Common/HtmlProperties/HtmlCssDocument.mjs';
import { beginPropertiesEdit } from '/PanelInstances/Common/HtmlProperties/PropertiesEdit.mjs';
import { acquireCssSource } from '/PanelInstances/Common/HtmlProperties/CssSourceStore.mjs';
import { listLiveFileContentProviders } from '/LiveFileContent.mjs';
const ok = (value, label) => { if (!value) throw new Error(label); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = document.getElementById('result');
try {
  ok(window.foundation?.ready, output.textContent);
  const [a, b] = foundation.contexts;
  const originalFetch = window.fetch.bind(window), saves = [], checks = [], timings = [];
  const files = new Map([
    ['a.css', '/* keep */\n.card { color: #3458c0; margin-left: calc(2px + 1px); padding: 1px 2px; }\n.other { color: pink; }'],
    ['b.css', '.card { color: rgb(0, 128, 0); margin-left: 2em; }'],
    ['shared.css', '/* shared */ .card { color: purple; margin-left: 3px; }'],
    ['ambiguous.css', '.card { color: red; }\n.card { color: blue !important; }\n#thing { color: orange; color: yellow; }\n@media (min-width: 1px) { .card { color: green; } }'],
    ['later.css', '.card { color: teal; }'],
    ['lifecycle.css', '.card { color: red; }'],
  ]);
  window.fetch = async (url, options = {}) => {
    const path = String(url);
    if (path.endsWith('.css')) return files.has(path.slice(10)) ? new Response(files.get(path.slice(10)), { headers: { 'Content-Type': 'text/css' } }) : new Response('', { status: 404 });
    if (path === '/api/save') { const body = JSON.parse(options.body); saves.push(body); if (body.path.endsWith('.css')) files.set(body.path, body.content); return Response.json({ success: true }); }
    return originalFetch(url, options);
  };
  const page = (sheet, extra = '', inline = '') => `<!doctype html><html><head><link rel="stylesheet" href="${sheet}">${extra}</head><body><section style="color: maroon"><p id="thing" class="card" ${inline}>text</p><p id="inherited">child</p></section></body></html>`;
  function select(context, id = 'thing') {
    context.activate(); const element = context.editorElement.querySelector('#' + id), range = document.createRange();
    range.selectNodeContents(element); range.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(range);
    context.selection.capture(); context.selection.selectElement(element);
  }
  async function discover(context, property = 'color') { return discoverHtmlProperties(context, context.selection.getElement(), property); }
  async function measure(action, run) { const start = performance.now(); const result = await run(); timings.push({ action, ms: performance.now() - start }); return result; }
  a.setHTML(page('a.css')); b.setHTML(page('b.css')); select(a);
  const tabs = await import('/panels/panelTabs.mjs');
  const cell = document.createElement('div'); cell.className = 'panel-cell'; document.body.append(cell);
  const opening = performance.now();
  const tab = await tabs.openPanelTabInCell(cell, { panelType: 'HTMLPropertiesPanel', panelClass: 'InfoPanel' }, setupPanel);
  const panel = tab.contentElement, controller = panel.__nvHtmlProperties;
  await controller.refresh(); timings.push({ action: 'open Properties', ms: performance.now() - opening });
  const initial = await discover(a);
  ok(initial.inline === '' && initial.effective === 'rgb(52, 88, 192)', 'effective value differs from absent inline source');
  ok(getComputedStyle(b.editorElement.querySelector('#thing')).color === 'rgb(0, 128, 0)', 'separate .card sources are isolated');
  const beforeA = a.getHTML(), beforeB = b.getHTML(), revision = a.revision;
  ok(!a.isDirty && !b.isDirty, 'opening Properties does not dirty HTML');
  const ui = controller.ui;
  ui.destination.value = 'inline'; ui.destination.dispatchEvent(new Event('change')); ui.value.value = 'red';
  await measure('inline preview', () => controller.invoke('preview'));
  ok(a.revision === revision && !a.isDirty, 'inline preview has no dirty revision');
  await measure('inline cancel', () => controller.invoke('cancel'));
  ok(a.getHTML() === beforeA && b.getHTML() === beforeB && a.revision === revision, 'cancel restores exact source and ownership');
  ui.destination.value = 'inline'; ui.destination.dispatchEvent(new Event('change')); ui.value.value = 'green';
  await controller.invoke('preview'); select(b); await controller.refresh();
  ok(a.getHTML() === beforeA && ui.identity.textContent.includes('B.html'), 'document switch cancels old preview without cross-targeting');
  select(a); await controller.refresh();
  ui.destination.value = 'inline'; ui.destination.dispatchEvent(new Event('change')); ui.value.value = 'red';
  await measure('inline apply', () => controller.invoke('apply'));
  ok(a.isDirty && b.getHTML() === beforeB && a.editorElement.__nvProgrammaticHistory.owned && !a.editorElement.__nvPropertiesUndoBlocked, 'inline commit is owned and history is contained');
  await controller.invoke('undo'); ok(a.getHTML() === beforeA, 'Properties Undo reverses only its operation');
  await controller.invoke('redo'); ok(a.editorElement.querySelector('#thing').style.color === 'red', 'Properties Redo restores operation');
  await controller.invoke('save'); ok(saves.at(-1).path === 'A.html', 'inline save owns HTML path');
  checks.push('inline preview/cancel/commit/history/save and effective/authored values');

  // Selection ownership changes while a Properties control retains DOM focus.
  ui.value.focus(); select(b); await controller.refresh();
  ok(ui.identity.textContent.includes('B.html'), 'Properties rebinds to B while a control has focus');
  ui.destination.value = 'inline'; ui.destination.dispatchEvent(new Event('change')); ui.value.value = '4em';
  ui.property.value = 'margin-left'; await controller.refresh(); ui.destination.value = 'inline'; ui.destination.dispatchEvent(new Event('change')); ui.value.value = '4em';
  await controller.invoke('apply'); ok(b.editorElement.querySelector('#thing').style.marginLeft === '4em', 'unit edit targets B');
  ok(!a.editorElement.querySelector('#thing').style.marginLeft, 'B inline edit leaves A unchanged');
  const bRevision = b.revision; await controller.invoke('apply'); ok(b.revision === bRevision, 'same inline value is a no-op');

  // Existing local rule, exact source patch and dirty CodeEditor conflict.
  select(b); const bTarget = (await discover(b)).targets.find(t => t.entry?.path === 'b.css');
  const bOriginal = files.get('b.css'), bHtml = b.getHTML();
  let edit = await beginPropertiesEdit(b, b.selection.getElement(), 'color', bTarget);
  await measure('rule preview', () => edit.preview('blue'));
  ok(getComputedStyle(b.selection.getElement()).color === 'rgb(0, 0, 255)' && !bTarget.entry.source.dirty, 'rule preview affects only its owner without dirty source');
  await measure('rule cancel', () => edit.cancel()); ok(bTarget.entry.source.text === bOriginal && b.getHTML() === bHtml, 'rule cancel restores CSS and HTML');
  edit = await beginPropertiesEdit(b, b.selection.getElement(), 'color', bTarget); edit.preview('blue');
  const operation = await measure('rule apply', () => edit.apply());
  ok(bTarget.entry.source.text === bOriginal.replace('rgb(0, 128, 0)', 'blue'), 'CSS patch leaves unrelated source byte-identical');
  ok(b.getHTML() === bHtml && bTarget.entry.source.dirty, 'CSS edit dirties CSS only');
  operation.undo(); ok(bTarget.entry.source.text === bOriginal, 'CSS transaction undo'); operation.undo('redo');
  const codeHost = document.createElement('div'); codeHost.className = 'monaco-editor-container';
  codeHost.__nvCodeEditorSession = { filePath: 'b.css', dirty: true }; document.body.append(codeHost);
  let refused = false; try { await operation.save(); } catch (error) { refused = /CodeEditor/.test(error.message); }
  ok(refused, 'dirty retained CodeEditor prevents CSS save'); codeHost.remove();
  await operation.save(); ok(saves.at(-1).path === 'b.css' && saves.at(-1).sourcePath === 'b.css', 'CSS save owns CSS path');
  const noOpTarget = (await discover(b)).targets.find(t => t.entry?.path === 'b.css'), cssRevision = noOpTarget.entry.source.revision;
  edit = await beginPropertiesEdit(b, b.selection.getElement(), 'color', noOpTarget); edit.preview('blue');
  ok(!(await edit.apply()).changed && noOpTarget.entry.source.revision === cssRevision, 'same CSS source value has no dirty revision');
  checks.push('unit preservation, no-op, local source patch, CSS history and dirty-CodeEditor conflict');

  // Use the visible panel controls for a local rule, including its save shortcut.
  ui.property.value = 'color'; await controller.refresh();
  ui.destination.value = [...ui.destination.options].find(option => option.textContent.includes('b.css')).value;
  ui.destination.dispatchEvent(new Event('change')); ui.value.value = 'navy';
  await controller.invoke('preview'); await controller.invoke('apply');
  ok(b.getHTML() === bHtml && getComputedStyle(b.selection.getElement()).color === 'rgb(0, 0, 128)', 'panel applies explicit local CSS target');
  const savesBefore = saves.length;
  ui.value.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
  for (let i = 0; i < 30 && saves.length === savesBefore; i++) await delay(10);
  ok(saves.length === savesBefore + 1 && saves.at(-1).path === 'b.css', 'Properties save shortcut saves CSS exactly once');
  const diskTarget = (await discover(b)).targets.find(target => target.entry?.path === 'b.css');
  const savedCss = files.get('b.css'); files.set('b.css', savedCss + '/* changed externally */');
  refused = false;
  try { await beginPropertiesEdit(b, b.selection.getElement(), 'color', diskTarget); } catch (error) { refused = /disk/.test(error.message); }
  ok(refused, 'external disk change refuses stale edit'); files.set('b.css', savedCss);
  edit = await beginPropertiesEdit(b, b.selection.getElement(), 'color', diskTarget); edit.preview('red');
  files.set('b.css', savedCss + '/* changed during preview */'); refused = false;
  try { await edit.apply(); } catch (error) { refused = /disk/.test(error.message); }
  ok(refused, 'disk change during preview refuses apply'); edit.cancel(); files.set('b.css', savedCss);
  checks.push('panel stylesheet workflow, single CSS save shortcut, disk conflicts before edit and apply');

  a.setHTML(page('shared.css')); b.setHTML(page('shared.css')); select(a); await controller.refresh();
  const shared = (await discover(a)).targets[0];
  edit = await beginPropertiesEdit(a, a.selection.getElement(), 'color', shared); edit.preview('rgb(90, 20, 10)');
  ok(getComputedStyle(b.editorElement.querySelector('#thing')).color === 'rgb(90, 20, 10)', 'shared source preview intentionally affects both documents');
  const sharedOperation = await edit.apply();
  const sharedSource = shared.entry.source, sharedRevision = sharedSource.revision;
  sharedOperation.undo();
  ok(sharedSource.revision === sharedRevision + 1 && sharedSource.text === files.get('shared.css'), 'shared undo restores CSS source exactly once');
  ok([a,b].every(c => getComputedStyle(c.editorElement.querySelector('#thing')).color === 'rgb(128, 0, 128)'), 'shared undo updates both previews');
  sharedOperation.undo('redo');
  ok([a,b].every(c => getComputedStyle(c.editorElement.querySelector('#thing')).color === 'rgb(90, 20, 10)'), 'shared redo updates both previews');
  const sharedConflict = document.createElement('div'); sharedConflict.className = 'monaco-editor-container'; sharedConflict.__nvCodeEditorSession = {filePath:'shared.css',dirty:true}; document.body.append(sharedConflict);
  refused = false; try { sharedOperation.undo(); } catch { refused = true; }
  ok(refused && sharedSource.text.includes('rgb(90, 20, 10)'), 'dirty CSS CodeEditor refuses shared undo without overwrite'); sharedConflict.remove();
  await sharedOperation.save();
  ok(saves.at(-1).path === 'shared.css', 'shared source has one save destination');
  select(b); const otherShared = (await discover(b)).targets[0];
  const otherEdit = await beginPropertiesEdit(b, b.selection.getElement(), 'color', otherShared); otherEdit.preview('blue'); const otherOperation = await otherEdit.apply();
  refused = false; try { sharedOperation.undo(); } catch { refused = true; }
  ok(refused && sharedSource.text.includes('blue'), 'another page revision refuses stale CSS replay'); otherOperation.undo();
  checks.push('shared CSS undo/redo updates both previews once, with dirty-buffer and stale-revision refusal');

  a.setHTML(page('a.css', '<link rel="stylesheet" href="later.css">')); select(a); await controller.refresh();
  const overridden = (await discover(a)).targets.find(t => t.entry?.path === 'a.css');
  edit = await beginPropertiesEdit(a, a.selection.getElement(), 'color', overridden); edit.preview('yellow');
  ok(getComputedStyle(a.selection.getElement()).color === 'rgb(0, 128, 128)', 'later rule remains effective while earlier authored rule previews'); edit.cancel();
  a.setHTML(page('a.css', '', 'style="color: black"')); select(a); await controller.refresh();
  const inlineOverrides = (await discover(a)).targets[0];
  edit = await beginPropertiesEdit(a, a.selection.getElement(), 'color', inlineOverrides); edit.preview('yellow');
  ok(getComputedStyle(a.selection.getElement()).color === 'rgb(0, 0, 0)', 'inline style still overrides normal stylesheet preview'); edit.cancel();

  a.setHTML(page('ambiguous.css', '<link rel="stylesheet" href="later.css">', 'style="color: black"')); select(a); await controller.refresh();
  const ambiguous = await discover(a);
  ok(ambiguous.targets.filter(t => t.rule?.selector === '.card').length === 4, 'repeated selectors and multiple files retain distinct targets');
  ok(ambiguous.targets.some(t => /Conditional/.test(t.reason)) && ambiguous.targets.some(t => /exactly one/.test(t.reason)), 'media and duplicate declarations are read-only');
  ok(ambiguous.inline === 'black' && ambiguous.effective === 'rgb(0, 0, 255)', 'important rule overrides inline normal value');
  select(a, 'inherited'); const inherited = await discover(a); ok(inherited.inherited && inherited.effective === 'rgb(128, 0, 0)', 'inherited color is reported separately');
  a.setHTML(page('https://example.invalid/external.css', '<link rel="stylesheet" href="/Resources/read-only.css"><link rel="stylesheet" href="missing.css">')); select(a); await controller.refresh();
  ok((await discover(a)).targets.every(t => t.reason), 'external, managed and missing sheets are read-only');
  checks.push('repeated selectors, multiple sources, important, inheritance, media, duplicates, external/read-only/missing');

  a.setHTML(page('a.css', '<style>.card { color: crimson; }</style>')); select(a); await controller.refresh();
  const block = await discover(a);
  ok(block.effective === 'rgb(220, 20, 60)' && block.targets.some(target => target.label.includes('<style>') && /discovery-only/.test(target.reason)), 'style blocks are identified and displayed without enabling edits');
  a.setHTML(page('a.css', '<style>body { color: red; }</style>')); select(a); await controller.refresh();
  ok((await discover(a)).targets.every(target => target.reason), 'document-root selectors refuse unsafe scoped projection');
  a.setHTML(page('a.css', '<link rel="alternate stylesheet" title="alternate" href="later.css">')); select(a); await controller.refresh();
  ok((await discover(a)).targets.every(target => target.reason), 'alternate stylesheet semantics remain read-only');
  const transient = await acquireCssSource('lifecycle.css'), pending = transient.begin();
  pending.preview('.card { color: blue; }'); transient.release(); pending.cancel();
  ok(!listLiveFileContentProviders().some(provider => provider.filePath === 'lifecycle.css'), 'cancelling after final source owner closes releases clean buffer');
  checks.push('style block provenance, document-root/alternate refusal, preview teardown after last owner');

  a.setHTML(page('a.css')); b.setHTML(page('b.css')); select(a); await controller.refresh();
  await measure('selection change', async () => { select(a, 'inherited'); await controller.refresh(); });
  select(a); await controller.refresh();
  await measure('effective value read', () => getComputedStyle(a.selection.getElement()).color);
  const countsBefore = { ...propertiesDiagnostics };
  for (let i = 0; i < 12; i++) await measure('cached discovery and computed read', () => discover(a));
  ok(propertiesDiagnostics.sourceLoads === countsBefore.sourceLoads, 'selection reads reuse loaded sources');
  const lifecycle = [];
  for (let i = 0; i < 8; i++) {
    const temporary = document.createElement('div'); document.body.append(temporary);
    const hooks = setupPanel(temporary); await temporary.__nvHtmlProperties.refresh(); hooks.destroy(); temporary.remove();
    lifecycle.push(foundationDiagnostics.counts());
  }
  ok(lifecycle.every(count => count.globalListeners === lifecycle[0].globalListeners && count.observingMutationObservers === lifecycle[0].observingMutationObservers), 'Properties panel lifecycle has stable listeners/observers');

  // Exercise the actual toolbar widget, overlay wrapper and factory, not a stub.
  const { initToolbarWidget } = await import('/ToolbarJSONfiles/htmlPropertiesButton.mjs');
  const toolbarHost = document.createElement('div'); document.body.append(toolbarHost); initToolbarWidget(toolbarHost);
  const overlayCounts = [];
  for (let i = 0; i < 3; i++) {
    toolbarHost.querySelector('button').click();
    let overlay;
    for (let j = 0; j < 30; j++) { overlay = document.querySelector('.overlay .nv-html-properties'); if (overlay) break; await delay(20); }
    ok(overlay?.__nvHtmlProperties, 'toolbar opens working Properties overlay');
    const overlayController = overlay.__nvHtmlProperties; await overlayController.refresh();
    const beforeOverlay = a.getHTML();
    overlayController.ui.destination.value = 'inline'; overlayController.ui.destination.dispatchEvent(new Event('change'));
    overlayController.ui.value.value = 'pink'; await overlayController.invoke('preview');
    if (i % 2) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    else overlay.closest('.panel').querySelector('.panel-close-btn').click();
    await delay(30);
    ok(!overlay.__nvHtmlProperties && a.getHTML() === beforeOverlay, 'closing overlay cancels preview and disposes owner subscription');
    overlayCounts.push(foundationDiagnostics.counts());
  }
  toolbarHost.remove();
  ok(overlayCounts.every(count => count.globalListeners === lifecycle[0].globalListeners && count.observingMutationObservers === lifecycle[0].observingMutationObservers), 'real overlay shell and content release listeners/observers');
  checks.push('real toolbar/factory overlay entry, close/Escape preview cancellation and resource cleanup');
  window.propertiesTest = { ready: true, a, b, controller, checks, timings, lifecycle, diagnostics: propertiesDiagnostics,
    prepareNative() { const root = a.editorElement, text = root.querySelector('#thing').firstChild, range = document.createRange(); root.focus(); range.setStart(text, text.length); range.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(range); a.selection.capture(); },
    async commitNativeStyle() { const e = await beginPropertiesEdit(a, a.editorElement.querySelector('#thing'), 'color'); e.preview('orange'); this.nativeOperation = await e.apply(); },
    snapshot: () => a.editorElement.querySelector('#thing').textContent,
    dispose() { tabs.closePanelTabsInCell(cell); cell.remove(); foundation.dispose(); return { providers: listLiveFileContentProviders(), counts: foundationDiagnostics.counts() }; },
  };
  output.textContent = 'PASS: HTML Properties browser integration';
} catch (error) { window.propertiesError = error.stack; output.textContent = 'FAIL: ' + error.stack; }
