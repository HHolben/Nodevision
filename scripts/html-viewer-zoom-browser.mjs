// Nodevision/scripts/html-viewer-zoom-browser.mjs
// This browser regression exercises production HTML viewer loading, independent zoom modes, shared iframe and toolbar routing, read-only Layers reuse, source and selection preservation, and document lifecycle cleanup.
import { renderFile } from '/PanelInstances/ViewPanels/FileViewers/ViewHTML.mjs';
import { executePanelZoom, getPanelZoomState, getPanelZoomCapabilities, setPanelZoomMode } from '/panels/panelZoomCapabilities.mjs';
import { appendPanelZoomModeControls } from '/ToolbarJSONfiles/panelZoomModesWidget.mjs';

export async function checkHtmlViewerZoom({ panel, wheel, tick, ok }, timings) {
  const host = panel(), other = panel(); window.activeCell = host;
  const iframe = document.createElement('iframe');
  async function load(html, path = 'zoom.html') {
    const loaded = new Promise(resolve => {
      const ready = () => { if (!iframe.contentDocument?.querySelector(path === 'zoom.html' ? '#title' : '#replacement')) return; iframe.removeEventListener('load', ready); resolve(); };
      iframe.addEventListener('load', ready);
    });
    await renderFile(path, host, iframe, '/Notebook', { liveContent: { content: html } });
    await loaded; await tick();
  }
  await load('<h1 id="title">Zoom document</h1><form id="form"><button type="button">Ordinary button</button></form>' +
    Array.from({ length: 2000 }, (_, i) => `<section id="region-${i}" style="height:30px">Region ${i}</section>`).join(''));
  const doc = iframe.contentDocument, frame = iframe.contentWindow;
  ok(getPanelZoomCapabilities(host).geometric && getPanelZoomCapabilities(host).semantic, 'HTML supports two independent modes: ' + JSON.stringify({ caps: getPanelZoomCapabilities(host), body: iframe.contentDocument?.body?.innerHTML.slice(0, 160), host: host.outerHTML.slice(0, 400) }));
  ok(!getPanelZoomCapabilities(host).fisheye, 'HTML fisheye reserved');
  executePanelZoom(host, 'geometric', { action: 'set', zoom: 1.5 });
  frame.scrollTo(0, 200); await tick();
  const scroll = frame.scrollY;
  const selection = frame.getSelection(), range = doc.createRange();
  range.selectNodeContents(doc.querySelector('#title')); selection.removeAllRanges(); selection.addRange(range);
  const selectionNode = selection.anchorNode, selectionText = selection.toString();
  const source = doc.documentElement.outerHTML, state = JSON.stringify(window.NodevisionState);
  let mutations = 0, navigations = 0;
  const observer = new MutationObserver(records => mutations += records.length);
  observer.observe(doc.documentElement, { subtree: true, attributes: true, childList: true, characterData: true });
  iframe.addEventListener('load', () => navigations++);
  iframe.focus();
  const firstOutlineStart = performance.now();
  wheel(doc.body, { altKey: true, deltaY: 100 });
  timings.htmlViewerFirstOutline2000RegionsMs = performance.now() - firstOutlineStart;
  ok(getPanelZoomState(host, 'semantic').level === 'outline', 'iframe semantic out opens outline');
  ok(getPanelZoomState(host).zoom === 1.5, 'semantic leaves geometric scale');
  const outline = host.querySelector('[data-nv-html-outline]');
  ok(outline.contains(document.activeElement), 'keyboard focus follows hidden page into outline');
  ok(!outline.hidden && iframe.style.display === 'none', 'outline replaces page presentation only');
  ok(outline.querySelectorAll('button[data-layer-index]').length > 0, 'cross-realm HTML layers populate outline');
  ok(outline.querySelectorAll('button[data-layer-index]').length < 100, 'large outline reuses virtual rows');
  const checkbox = outline.querySelector('input[type=checkbox]');
  ok(checkbox.disabled, 'outline has no document visibility edits');
  checkbox.checked = !checkbox.checked; checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  executePanelZoom(host, 'semantic', { action: 'zoom', factor: .9 });
  ok(getPanelZoomState(host, 'semantic').level === 'outline', 'semantic boundary claimed no-op');
  ok(!executePanelZoom(host, 'semantic', { action: 'set', level: 'invalid' }), 'invalid semantic level refused');
  wheel(outline, { shiftKey: true }); ok(getPanelZoomState(host).zoom === 1.5, 'reserved fisheye cannot change scale');
  const toolbar = document.createElement('div'); document.body.append(toolbar);
  const sync = appendPanelZoomModeControls(toolbar, () => host);
  setPanelZoomMode(host, 'semantic'); sync();
  const levels = toolbar.querySelector('[aria-label="Semantic detail"]');
  levels.focus();
  levels.value = 'page'; levels.dispatchEvent(new Event('change'));
  await tick();
  ok(getPanelZoomState(host, 'semantic').level === 'page' && outline.hidden, 'toolbar chooses Page separately');
  ok(document.activeElement === levels, 'toolbar keeps focus when changing semantic level');
  ok(frame.scrollY === scroll && selection.anchorNode === selectionNode && selection.toString() === selectionText, 'return preserves page scroll and browser selection');
  wheel(doc.body); ok(Math.abs(getPanelZoomState(host).zoom - 1.5 * Math.exp(.15)) < 1e-8, 'iframe geometric wheel invokes exactly once');
  ok(host.style.zoom === '' && toolbar.style.zoom === '', 'document scale excludes host and controls');
  doc.body.dispatchEvent(new frame.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, altKey: true, key: '-' }));
  ok(getPanelZoomState(host, 'semantic').level === 'outline', 'semantic keyboard out');
  outline.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, key: '0' }));
  ok(getPanelZoomState(host).zoom === 1 && getPanelZoomState(host, 'semantic').level === 'outline', 'geometric reset leaves semantic state');
  outline.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, altKey: true, key: '0' }));
  ok(getPanelZoomState(host, 'semantic').level === 'page', 'semantic reset returns Page');
  const samples = [], geometric = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now(); executePanelZoom(host, 'semantic', { action: 'set', level: i % 2 ? 'page' : 'outline' }); samples.push(performance.now() - start);
  }
  for (let i = 0; i < 20; i++) {
    const start = performance.now(); executePanelZoom(host, 'geometric', { action: 'set', zoom: i % 2 ? 1 : 1.2 }); geometric.push(performance.now() - start);
  }
  await tick();
  ok(mutations === 0 && doc.documentElement.outerHTML === source, '100 semantic transitions and scale changes never mutate authored document');
  ok(JSON.stringify(window.NodevisionState) === state && navigations === 0, 'no canonical selection, dirty state, or navigation changes');
  ok(selection.anchorNode === selectionNode && selection.toString() === selectionText, 'repeated transitions retain selection');
  observer.disconnect();
  const stats = values => { values.sort((a, b) => a - b); return { medianMs: values[Math.floor(values.length / 2)], p95Ms: values[Math.ceil(values.length * .95) - 1] }; };
  timings.htmlViewerSemantic2000Regions = stats(samples); timings.htmlViewerGeometric2000Regions = stats(geometric);
  executePanelZoom(host, 'semantic', { action: 'set', level: 'outline' });
  outline.querySelector('button[data-layer-index]').click();
  ok(getPanelZoomState(host, 'semantic').level === 'page', 'explicit outline entry reveals page');
  executePanelZoom(host, 'semantic', { action: 'set', level: 'outline' });
  outline.querySelector('button[data-layer-index]').click();
  ok(getPanelZoomState(host, 'semantic').level === 'page', 'same outline entry can reveal repeatedly');
  // The separate View Layers context must also be read-only and leave live forms functional.
  const layerHost = document.createElement('div'); host.append(layerHost);
  const detachLayers = window.HTMLViewLayersContext.attachHost(layerHost);
  const buttonEvent = new frame.MouseEvent('click', { bubbles: true, cancelable: true }); doc.querySelector('form button').dispatchEvent(buttonEvent);
  ok(!buttonEvent.defaultPrevented && layerHost.querySelector('input').disabled, 'viewer Layers does not intercept forms or expose edits');
  detachLayers(); layerHost.remove();
  window.activeCell = other; wheel(doc.body, { altKey: true, deltaY: 100 });
  ok(getPanelZoomState(host, 'semantic').level === 'page', 'inactive viewer refuses iframe input'); window.activeCell = host;
  host.hidden = true; ok(!executePanelZoom(host, 'semantic', { action: 'set', level: 'outline' }), 'retained hidden tab refuses dispatch'); host.hidden = false;
  executePanelZoom(host, 'semantic', { action: 'set', level: 'outline' });
  await load('<main id="replacement">New document</main>', 'next.html');
  ok(!outline.isConnected && host.querySelectorAll('[data-nv-html-outline]').length === 1, 'replacement removes old outline');
  ok(getPanelZoomState(host, 'semantic').level === 'page' && getPanelZoomState(host).zoom === 1, 'new document starts with independent default state');
  doc.body.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100 })); ok(getPanelZoomState(host).zoom === 1, 'old iframe bridge removed');
  const second = document.createElement('iframe');
  const secondReady = new Promise(resolve => second.addEventListener('load', () => { if (second.contentDocument?.querySelector('#second')) resolve(); }));
  await renderFile('second.html', other, second, '/Notebook', { liveContent: { content: '<main id="second">Second viewer</main>' } });
  await secondReady; await tick(); window.activeCell = other;
  wheel(second.contentDocument.body); wheel(second.contentDocument.body, { altKey: true, deltaY: 100 });
  ok(getPanelZoomState(other).zoom > 1 && getPanelZoomState(other, 'semantic').level === 'outline', 'second viewer owns both states');
  ok(getPanelZoomState(host).zoom === 1 && getPanelZoomState(host, 'semantic').level === 'page', 'viewer states do not leak across instances');
  other._dispose(); ok(getPanelZoomCapabilities(host).semantic, 'disposing another viewer preserves this owner');
  host._dispose();
  ok(!getPanelZoomCapabilities(host).semantic && !getPanelZoomCapabilities(host).geometric && !host.querySelector('[data-nv-html-outline]'), 'destroy removes both modes and outline');
  ok(window.HTMLViewLayersContext === null, 'destroy clears owned viewer context');
  ok(iframe.__nvHtmlViewerZoomCleanup === null, 'destroy releases frame cleanup references');
  host.remove(); other.remove(); toolbar.remove();
}
