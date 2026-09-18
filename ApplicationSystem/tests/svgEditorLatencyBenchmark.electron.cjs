// Nodevision/ApplicationSystem/tests/svgEditorLatencyBenchmark.electron.cjs
// Synthetic Electron benchmark for SVG editor open-time workspace blocking and Vector Draw Line click latency.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

const ROOT = process.cwd();
const PORT = Number(process.env.NODEVISION_SVG_EDITOR_LATENCY_PORT || 39486);
const FIXTURE_ROOT = path.join(ROOT, "Notebook", "__nv_svg_editor_latency_benchmark");
const PUBLIC_HARNESS = path.join(ROOT, "ApplicationSystem/public/__svg-editor-latency-benchmark-harness.html");
const JSON_REPORT_PATH = process.env.NODEVISION_SVG_EDITOR_LATENCY_REPORT || path.join(ROOT, "ApplicationSystem/tests/svgEditorLatencyBenchmark.report.json");
const MARKDOWN_REPORT_PATH = process.env.NODEVISION_SVG_EDITOR_LATENCY_MD || path.join(ROOT, "ApplicationSystem/tests/svgEditorLatencyBenchmark.report.md");
const EXPECT_DEFERRED_LAYOUT = process.env.NODEVISION_SVG_EDITOR_LATENCY_EXPECT_DEFERRED_LAYOUT === "1";
const SKIP_LINE_WORKFLOW = process.env.NODEVISION_SVG_EDITOR_LATENCY_SKIP_LINE === "1";
const OBJECT_COUNTS = [0, 1, 10, 100, 1000];

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function round(value, digits = 2) { const factor = 10 ** digits; return Math.round(Number(value || 0) * factor) / factor; }
function percentile(sorted, ratio) { return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] || 0; }
function stats(values) {
  const clean = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  return { count: clean.length, median: round(percentile(clean, 0.5)), p95: round(percentile(clean, 0.95)), max: round(clean[clean.length - 1] || 0) };
}

function rects(count) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count))));
  const out = [];
  for (let index = 0; index < count; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    out.push(`<rect id="obj-${index}" x="${30 + col * 24}" y="${30 + row * 20}" width="16" height="12" fill="#80c0ff" stroke="#123" stroke-width="1"/>`);
  }
  return out.join("\n");
}

function makeSvg(count) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="820" viewBox="0 0 1200 820">\n<title>${count} object latency fixture</title>\n${rects(count)}\n</svg>`;
}

function makeMixedSvg() {
  const dataPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lVMN0wAAAABJRU5ErkJggg==";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="640" viewBox="0 0 900 640">
<title>Mixed SVG latency fixture</title>
<defs><linearGradient id="g"><stop offset="0%" stop-color="#6ee7b7"/><stop offset="100%" stop-color="#60a5fa"/></linearGradient></defs>
<g id="layer-background" data-layer="true" data-layer-name="Background"><rect id="bg" x="20" y="20" width="840" height="580" rx="8" fill="url(#g)" opacity="0.3"/></g>
<g id="layer-art" data-layer="true" data-layer-name="Artwork">
<path id="path-1" d="M120 160 C200 40 320 280 420 140 S620 220 720 120" fill="none" stroke="#111827" stroke-width="6"/>
<text id="label" x="130" y="330" font-size="42" fill="#111827">Nodevision SVG</text>
<image id="img" x="620" y="360" width="80" height="80" href="${dataPng}"/>
<polyline id="poly" points="90,500 160,450 230,520 320,470 390,510" fill="none" stroke="#ef4444" stroke-width="4"/>
</g>
</svg>`;
}

function buildFixtures() {
  fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
  const fixtures = OBJECT_COUNTS.map((count) => {
    const id = count === 0 ? "empty" : `${count}-objects`;
    const fileName = `${id}.svg`;
    fs.writeFileSync(path.join(FIXTURE_ROOT, fileName), makeSvg(count), "utf8");
    return { id, objectCount: count, relativePath: `__nv_svg_editor_latency_benchmark/${fileName}`, label: count === 0 ? "Empty SVG" : `${count} simple objects` };
  });
  fs.writeFileSync(path.join(FIXTURE_ROOT, "mixed.svg"), makeMixedSvg(), "utf8");
  fixtures.push({ id: "mixed", objectCount: "mixed", relativePath: "__nv_svg_editor_latency_benchmark/mixed.svg", label: "Mixed layers paths text image" });
  return fixtures;
}

function writeHarness() {
  fs.writeFileSync(PUBLIC_HARNESS, `<!doctype html>
<html><head><meta charset="utf-8"><title>SVG Editor Latency Benchmark</title>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;font-family:Arial,sans-serif}
#workspace{display:flex;width:1280px;height:850px;align-items:stretch}
.panel-row{display:flex;min-width:0;min-height:0}.panel-cell{display:flex;min-width:0;min-height:0;position:relative;overflow:hidden;border:1px solid #ddd;box-sizing:border-box}.panel-cell[data-panel-class="EditorPanel"]{flex:1 1 auto}.probe-viewer{width:220px;flex:0 0 220px;flex-direction:column}.probe-close{margin:8px;padding:6px 10px}.probe-result{padding:8px;font-size:12px}.editor-cell{flex:1 1 auto}
</style></head><body><div id="workspace" class="panel-row"></div><script type="module">
(() => {
  const originalFetch = window.fetch.bind(window);
  const originalParse = DOMParser.prototype.parseFromString;
  const originalAppend = Element.prototype.appendChild;
  const originalReplaceWith = Element.prototype.replaceWith;
  const originalQsa = Element.prototype.querySelectorAll;
  const originalBBox = SVGGraphicsElement.prototype.getBBox;
  const originalSerialize = XMLSerializer.prototype.serializeToString;
  const originalSetAttribute = Element.prototype.setAttribute;
  const originalSvgGraphicsGetScreenCTM = SVGGraphicsElement.prototype.getScreenCTM;
  const originalSvgSvgGetScreenCTM = SVGSVGElement.prototype.getScreenCTM;
  const originalAdd = EventTarget.prototype.addEventListener;
  const originalRemove = EventTarget.prototype.removeEventListener;
  const originalDispatch = EventTarget.prototype.dispatchEvent;
  const originalMO = window.MutationObserver;
  const originalRAF = window.requestAnimationFrame.bind(window);
  const originalConsoleWarn = console.warn.bind(console);
  const originalConsoleError = console.error.bind(console);
  window.__nvSvgEditorLatencyConsole = [];
  function recordConsole(level, args) {
    const text = args.map((arg) => {
      if (arg instanceof Error) return (arg.stack || arg.message || String(arg));
      if (arg && typeof arg === 'object') { try { return JSON.stringify(arg); } catch { return String(arg); } }
      return String(arg);
    }).join(' ');
    if (/SVG editor|TypeError|failed|warn|error/i.test(text)) {
      window.__nvSvgEditorLatencyConsole.push({ level, text, stack: new Error().stack, time: performance.now() });
    }
  }
  console.warn = (...args) => { recordConsole('warn', args); return originalConsoleWarn(...args); };
  console.error = (...args) => { recordConsole('error', args); return originalConsoleError(...args); };
  let active = null;
  let currentLineProbe = null;
  let listenerMap = new WeakMap();
  const now = () => performance.now();
  const nextFrame = () => new Promise((resolve) => originalRAF(() => resolve(now())));
  const frame = () => new Promise((resolve) => originalRAF(() => originalRAF(resolve)));
  function metric() { return active; }
  function bump(name, amount = 1) { if (active) active[name] = (active[name] || 0) + amount; }
  function mark(name) { if (active && active.marks && !active.marks[name]) active.marks[name] = now(); }
  window.fetch = async function(...args) {
    const url = String(args[0]?.url || args[0] || '');
    const isSvgFetch = url.includes('/api/fileCodeContent') || url.includes('/Notebook/__nv_svg_editor_latency_benchmark/');
    if (isSvgFetch) mark('svgFetchStart');
    const res = await originalFetch(...args);
    if (isSvgFetch) mark('svgFetchResponse');
    return res;
  };
  DOMParser.prototype.parseFromString = function(source, type) {
    if (String(type || '').includes('svg') || String(source || '').includes('<svg')) mark('svgParseStart');
    const result = originalParse.call(this, source, type);
    if (String(type || '').includes('svg') || String(source || '').includes('<svg')) mark('svgParseEnd');
    return result;
  };
  Element.prototype.appendChild = function(child) {
    if (active) {
      bump('appendChildCalls');
      if (child?.classList?.contains?.('panel-cell')) bump('panelCellInsertions');
      if (child?.tagName?.toLowerCase?.() === 'svg') mark('svgDomInsertion');
      if (currentLineProbe && child instanceof SVGElement && !child.hasAttribute('data-nv-editor-ui')) {
        const tag = String(child.tagName || '').toLowerCase();
        if ((tag === 'line' || tag === 'polygon' || tag === 'polyline' || tag === 'path') && !currentLineProbe.firstDomMutationAt) currentLineProbe.firstDomMutationAt = now();
      }
    }
    return originalAppend.call(this, child);
  };
  Element.prototype.replaceWith = function(...nodes) {
    if (active && nodes.some((node) => node?.tagName?.toLowerCase?.() === 'svg')) mark('svgDomInsertion');
    return originalReplaceWith.call(this, ...nodes);
  };
  Element.prototype.querySelectorAll = function(selector) {
    if (active) {
      bump('querySelectorAllCalls');
      if (selector === '*') bump('querySelectorAllStar');
      if (String(selector).includes('.panel-cell')) bump('panelCellQueries');
      if (String(selector).includes('[data-layer')) bump('layerQueries');
    }
    return originalQsa.call(this, selector);
  };
  SVGGraphicsElement.prototype.getBBox = function(...args) { bump('getBBoxCalls'); return originalBBox.apply(this, args); };
  XMLSerializer.prototype.serializeToString = function(...args) { bump('serializeCalls'); return originalSerialize.apply(this, args); };
  Element.prototype.setAttribute = function(name, value) {
    if (active && this instanceof SVGElement) {
      bump('svgSetAttributeCalls');
      const tag = String(this.tagName || '').toLowerCase();
      if (tag === 'line') bump('svgLineSetAttributeCalls');
      if (tag === 'path') bump('svgPathSetAttributeCalls');
      if (currentLineProbe && !this.hasAttribute('data-nv-editor-ui') && (tag === 'line' || tag === 'polygon' || tag === 'polyline' || tag === 'path') && !currentLineProbe.firstDomMutationAt) currentLineProbe.firstDomMutationAt = now();
    }
    return originalSetAttribute.call(this, name, value);
  };
  SVGGraphicsElement.prototype.getScreenCTM = function(...args) { bump('getScreenCTMCalls'); return originalSvgGraphicsGetScreenCTM.apply(this, args); };
  SVGSVGElement.prototype.getScreenCTM = function(...args) { bump('getScreenCTMCalls'); return originalSvgSvgGetScreenCTM.apply(this, args); };
  window.MutationObserver = class InstrumentedMutationObserver extends originalMO {
    constructor(callback) {
      bump('mutationObserversCreated');
      super((records, observer) => { bump('mutationObserverCallbacks'); bump('mutationRecordCount', records.length); return callback(records, observer); });
    }
    observe(...args) { bump('mutationObserverObserveCalls'); return super.observe(...args); }
    disconnect(...args) { bump('mutationObserverDisconnects'); return super.disconnect(...args); }
  };
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (typeof listener === 'function' && (type === 'pointerdown' || type === 'pointermove' || type === 'click')) {
      const wrapped = function(event) {
        const m = metric();
        const start = now();
        if (m && type === 'pointerdown') m.pointerdownHandlerCalls = (m.pointerdownHandlerCalls || 0) + 1;
        try { return listener.call(this, event); }
        finally {
          if (m) {
            const end = now();
            const duration = end - start;
            const span = { type, eventTimeStamp: event?.timeStamp || 0, handlerStart: start, handlerEnd: end, duration, targetTag: String(event?.target?.tagName || '') };
            m.eventSpans.push(span);
            if (type === 'pointerdown') m.pointerdownHandlerDurations.push(duration);
            if (type === 'pointermove') m.pointermoveHandlerDurations.push(duration);
            if (type === 'click') m.clickHandlerDurations.push(duration);
          }
        }
      };
      listenerMap.set(listener, wrapped);
      return originalAdd.call(this, type, wrapped, options);
    }
    return originalAdd.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    const wrapped = listenerMap.get(listener);
    if (wrapped) {
      listenerMap.delete(listener);
      return originalRemove.call(this, type, wrapped, options);
    }
    return originalRemove.call(this, type, listener, options);
  };

  EventTarget.prototype.dispatchEvent = function(event) {
    if (active && event?.type === 'nv-svg-editor-context-ready') mark('contextReady');
    if (active && event?.type === 'nv-svg-editor-selection-changed') bump('selectionChangedDispatches');
    if (active && event?.type === 'nv-svg-editor-selection-mutated') bump('selectionMutatedDispatches');
    return originalDispatch.call(this, event);
  };

  function makeMetrics(label, fixture) {
    return { label, fixture, marks: {}, zeroDelayTimerDelayMs: null, rafDelayMs: null, eventLoopProbeDelays: [], eventLoopProbeMaxDelayMs: 0, unrelatedControl: {}, unrelatedControlAttempts: [], longTasks: [], totalBlockingTimeMs: 0, longestTaskMs: 0, domNodesBefore: 0, domNodesAfterOpen: 0, domNodesAfterLine: 0, appendChildCalls: 0, panelCellInsertions: 0, querySelectorAllCalls: 0, querySelectorAllStar: 0, panelCellQueries: 0, layerQueries: 0, getBBoxCalls: 0, getScreenCTMCalls: 0, serializeCalls: 0, svgSetAttributeCalls: 0, svgLineSetAttributeCalls: 0, svgPathSetAttributeCalls: 0, mutationObserversCreated: 0, mutationObserverObserveCalls: 0, mutationObserverCallbacks: 0, mutationObserverDisconnects: 0, mutationRecordCount: 0, selectionChangedDispatches: 0, selectionMutatedDispatches: 0, pointerdownHandlerCalls: 0, pointerdownHandlerDurations: [], pointermoveHandlerDurations: [], clickHandlerDurations: [], eventSpans: [], lineModeActivation: null, lineSessions: [], lineClicks: [] };
  }
  function installLongTaskObserver(metrics) {
    if (!('PerformanceObserver' in window)) return () => {};
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const duration = entry.duration || 0;
          metrics.longTasks.push({ startTime: entry.startTime, duration });
          metrics.longestTaskMs = Math.max(metrics.longestTaskMs, duration);
          if (duration > 50) metrics.totalBlockingTimeMs += duration - 50;
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
      return () => observer.disconnect();
    } catch { return () => {}; }
  }
  function cleanupBenchmarkWorkspace() {
    document.querySelectorAll('#workspace, .panel-row[data-nv-mode-layout-id="SVGEditorMode"], #global-toolbar, #sub-toolbar').forEach((node) => node.remove());
  }
  function resetWorkspace() {
    cleanupBenchmarkWorkspace();
    const toolbar = document.createElement('div');
    toolbar.id = 'global-toolbar';
    document.body.appendChild(toolbar);
    const subToolbar = document.createElement('div');
    subToolbar.id = 'sub-toolbar';
    document.body.appendChild(subToolbar);
    const workspace = document.createElement('div');
    workspace.id = 'workspace';
    workspace.className = 'panel-row';
    document.body.appendChild(workspace);
    const viewer = document.createElement('div');
    viewer.className = 'panel-cell probe-viewer';
    viewer.dataset.id = 'FileView'; viewer.dataset.panelId = 'FileView'; viewer.dataset.panelClass = 'ViewPanel';
    const close = document.createElement('button'); close.className = 'probe-close'; close.type = 'button'; close.textContent = 'Close File Viewer';
    const result = document.createElement('div'); result.className = 'probe-result'; result.textContent = 'open';
    viewer.append(close, result);
    const editorCell = document.createElement('div');
    editorCell.className = 'panel-cell editor-cell';
    editorCell.dataset.id = 'GraphicalEditor'; editorCell.dataset.panelId = 'GraphicalEditor'; editorCell.dataset.panelClass = 'EditorPanel';
    workspace.append(viewer, editorCell);
    window.activeCell = editorCell;
    return { workspace, viewer, close, result, editorCell };
  }
  async function loadGraphicalEditor(fixture) {
    const module = await import('/PanelInstances/EditorPanels/GraphicalEditor.mjs?v=' + Date.now() + Math.random());
    return module;
  }
  function rectCenter(el) { const r = el.getBoundingClientRect(); return { x: r.left + Math.max(40, r.width * 0.25), y: r.top + Math.max(40, r.height * 0.25), rect: r }; }
  function pointer(type, x, y, detail = 1, init = {}) {
    return new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y, detail, ...init });
  }
  function snapshotCounters(metrics) {
    return {
      qsa: metrics.querySelectorAllCalls || 0,
      qsaStar: metrics.querySelectorAllStar || 0,
      getBBox: metrics.getBBoxCalls || 0,
      getScreenCTM: metrics.getScreenCTMCalls || 0,
      serialize: metrics.serializeCalls || 0,
      setAttr: metrics.svgSetAttributeCalls || 0,
      lineSetAttr: metrics.svgLineSetAttributeCalls || 0,
      appendChild: metrics.appendChildCalls || 0,
      selectionChanged: metrics.selectionChangedDispatches || 0,
      selectionMutated: metrics.selectionMutatedDispatches || 0,
      mutationCallbacks: metrics.mutationObserverCallbacks || 0,
      mutationRecords: metrics.mutationRecordCount || 0,
    };
  }
  function counterDelta(before, metrics) {
    const after = snapshotCounters(metrics);
    const delta = {};
    for (const [key, value] of Object.entries(after)) delta[key] = value - (before[key] || 0);
    return delta;
  }
  function findToolbarButtonByLabel(root, label) {
    const wanted = String(label || '').trim().toLowerCase();
    const normalize = (value) => {
      const text = String(value || '').trim().toLowerCase();
      return text.split('\\nshortcut:')[0].replace('. shortcut:', '').trim();
    };
    return Array.from(root?.querySelectorAll?.('button') || []).find((button) => {
      const values = [
        button.textContent,
        button.getAttribute('aria-label'),
        button.title,
        button.dataset?.tooltipText,
        button.closest?.('[data-heading]')?.dataset?.heading,
      ];
      return values.some((value) => normalize(value) === wanted);
    }) || null;
  }

  async function clickElementForUiMetrics(element, label) {
    if (!element) return { label, clicked: false };
    const start = now();
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0 }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0 }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));
    const frameAt = await nextFrame();
    return { label, clicked: true, dispatchMs: now() - start, nextFrameDelayMs: frameAt - start };
  }

  async function activateLineViaToolbar(metrics) {
    const before = snapshotCounters(metrics);
    const start = now();
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.currentMode = 'SVG Editing';
    window.NodevisionState.activePanelType = 'GraphicalEditor';
    window.NodevisionState.svgDrawTool = 'select';
    const { createToolbar, showToolbarSubToolbar } = await import('/panels/createToolbar.mjs?v=' + Date.now() + Math.random());
    await createToolbar('#global-toolbar', 'SVG Editing');
    const toolbar = document.getElementById('global-toolbar');
    const subToolbar = document.getElementById('sub-toolbar');
    const steps = [];
    steps.push(await clickElementForUiMetrics(findToolbarButtonByLabel(toolbar, 'Draw'), 'Draw'));
    showToolbarSubToolbar('Vector Draw', { force: true, toggle: false });
    await nextFrame();
    steps.push(await clickElementForUiMetrics(findToolbarButtonByLabel(document, 'Vector Draw'), 'Vector Draw'));
    showToolbarSubToolbar('Vector Draw', { force: true, toggle: false });
    await nextFrame();
    steps.push(await clickElementForUiMetrics(findToolbarButtonByLabel(subToolbar, 'Line'), 'Line'));
    if (window.SVGEditorContext?.setMode && window.NodevisionState?.svgDrawTool !== 'line') {
      const mod = await import('/ToolbarCallbacks/draw/svgModeLine.mjs?v=' + Date.now() + Math.random());
      mod.default?.();
      steps.push({ label: 'fallback-svgModeLine', clicked: true });
    }
    const frameAt = await nextFrame();
    metrics.lineModeActivation = { latencyMs: frameAt - start, steps, mode: window.NodevisionState?.svgDrawTool || null, counters: counterDelta(before, metrics) };
  }

  function getLineGeometryCount(svg) {
    return svg.querySelectorAll('line:not([data-nv-editor-ui]), polygon:not([data-nv-editor-ui]), polyline:not([data-nv-editor-ui]), path:not([data-nv-editor-ui])').length;
  }

  function observeCommittedGeometry(svg, beforeGeometryCount) {
    const candidates = Array.from(svg.querySelectorAll('line:not([data-nv-editor-ui]), polygon:not([data-nv-editor-ui]), polyline:not([data-nv-editor-ui]), path:not([data-nv-editor-ui])'));
    return candidates.length > beforeGeometryCount;
  }

  async function dispatchLineInput(svg, point, { method = 'pointer', shiftKey = false, detail = 1 } = {}) {
    if (method === 'mouse') {
      svg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, button: 0, buttons: 1, shiftKey }));
      svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, button: 0, buttons: 0, shiftKey }));
      svg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, button: 0, buttons: 0, shiftKey, detail }));
      return;
    }
    svg.dispatchEvent(pointer('pointerdown', point.x, point.y, detail, { shiftKey }));
  }

  async function measureLineInput(metrics, svg, { sessionLabel, phase, point, method = 'pointer', shiftKey = false, detail = 1, expectCommit = false, objectCount } = {}) {
    const beforeCounters = snapshotCounters(metrics);
    const beforeGeometryCount = getLineGeometryCount(svg);
    const beforeSpanCount = metrics.eventSpans.length;
    const probe = { firstDomMutationAt: null };
    currentLineProbe = probe;
    const dispatchStart = now();
    const eventTimeStamp = performance.now();
    await dispatchLineInput(svg, point, { method, shiftKey, detail });
    const dispatchEnd = now();
    currentLineProbe = null;
    const span = metrics.eventSpans.slice(beforeSpanCount).findLast?.((item) => item.type === 'pointerdown') || metrics.eventSpans.slice(beforeSpanCount).find((item) => item.type === 'pointerdown') || null;
    const geometryExistsImmediately = observeCommittedGeometry(svg, beforeGeometryCount);
    const frameAt = await nextFrame();
    const geometryObservedAfterFrame = observeCommittedGeometry(svg, beforeGeometryCount);
    const afterGeometryCount = getLineGeometryCount(svg);
    const measurement = {
      session: sessionLabel,
      phase,
      method,
      shiftKey,
      objectCount,
      eventTimeStamp,
      dispatchStart,
      eventQueueDelayMs: span ? span.handlerStart - dispatchStart : null,
      handlerStartDelayMs: span ? span.handlerStart - eventTimeStamp : null,
      handlerDurationMs: span ? span.duration : 0,
      dispatchReturnMs: dispatchEnd - dispatchStart,
      domMutationDelayMs: probe.firstDomMutationAt ? probe.firstDomMutationAt - dispatchStart : null,
      geometryExistsImmediately,
      nextFrameDelayMs: frameAt - dispatchStart,
      geometryObservedAfterFrame,
      visualObservation: geometryObservedAfterFrame ? 'geometry-present-after-next-frame' : 'no-new-geometry-after-next-frame',
      newGeometryCount: afterGeometryCount - beforeGeometryCount,
      expectedCommit: Boolean(expectCommit),
      counters: counterDelta(beforeCounters, metrics),
    };
    metrics.lineClicks.push(measurement);
    return measurement;
  }

  async function runLineSession(metrics, svg, objectCount, { label, shiftKey = false, offsetY = 0, method = 'pointer' } = {}) {
    const base = rectCenter(svg);
    const pts = [{ x: base.x + 10, y: base.y + offsetY + 10 }, { x: base.x + 100, y: base.y + offsetY + 55 }, { x: base.x + 160, y: base.y + offsetY + 105 }];
    const session = { label, shiftKey, method, clicks: [] };
    metrics.lineSessions.push(session);
    session.clicks.push(await measureLineInput(metrics, svg, { sessionLabel: label, phase: 'first', point: pts[0], method, shiftKey, objectCount }));
    const moveBefore = snapshotCounters(metrics);
    const moveStart = now();
    svg.dispatchEvent(pointer('pointermove', pts[0].x + 50, pts[0].y + 20, 1, { shiftKey }));
    const moveSpan = metrics.eventSpans.findLast?.((item) => item.type === 'pointermove') || null;
    const moveFrameAt = await nextFrame();
    session.clicks.push({ phase: 'preview-move', method: 'pointer', shiftKey, eventQueueDelayMs: moveSpan ? moveSpan.handlerStart - moveStart : null, handlerDurationMs: moveSpan ? moveSpan.duration : 0, nextFrameDelayMs: moveFrameAt - moveStart, counters: counterDelta(moveBefore, metrics) });
    session.clicks.push(await measureLineInput(metrics, svg, { sessionLabel: label, phase: 'intermediate', point: pts[1], method, shiftKey, expectCommit: method === 'pointer', objectCount }));
    session.clicks.push(await measureLineInput(metrics, svg, { sessionLabel: label, phase: 'intermediate', point: pts[2], method, shiftKey, expectCommit: method === 'pointer', objectCount }));
    const beforeFinishCounters = snapshotCounters(metrics);
    const beforeFinish = now();
    const keyTarget = svg.closest('[data-nv-svg-editor-root="true"]') || svg.parentElement || window;
    keyTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    const finishFrameAt = await nextFrame();
    session.clicks.push({ phase: 'final', method: 'keyboard', shiftKey, dispatchReturnMs: now() - beforeFinish, nextFrameDelayMs: finishFrameAt - beforeFinish, counters: counterDelta(beforeFinishCounters, metrics) });
  }

  async function runLineWorkflow(metrics, objectCount) {
    const ctx = window.SVGEditorContext;
    const svg = ctx?.svgRoot;
    if (!ctx || !svg) return;
    await activateLineViaToolbar(metrics);
    await runLineSession(metrics, svg, objectCount, { label: 'ui-pointer-normal', shiftKey: false, offsetY: 0, method: 'pointer' });
    ctx.setMode?.('line');
    await nextFrame();
    await runLineSession(metrics, svg, objectCount, { label: 'ui-pointer-shift-snap', shiftKey: true, offsetY: 140, method: 'pointer' });
    ctx.setMode?.('line');
    await nextFrame();
    await runLineSession(metrics, svg, objectCount, { label: 'dispatched-mouse-control', shiftKey: false, offsetY: 280, method: 'mouse' });
  }
  window.__nvSvgEditorLatencyBenchmark = {
    async runFixture(fixture) {
      const domBeforeReset = document.querySelectorAll('*').length;
      const { close, result, editorCell } = resetWorkspace();
      const metrics = makeMetrics('current', fixture);
      const stopLongTasks = installLongTaskObserver(metrics);
      active = metrics;
      metrics.domNodesBefore = domBeforeReset;
      let closeVisualFrame = null;
      close.addEventListener('click', () => {
        const attempt = metrics.__pendingControlAttempt || metrics.unrelatedControlAttempts[metrics.unrelatedControlAttempts.length - 1] || metrics.unrelatedControl;
        attempt.handlerStart = now();
        if (!metrics.unrelatedControl.handlerStart) metrics.unrelatedControl.handlerStart = attempt.handlerStart;
        result.textContent = 'closed ' + metrics.unrelatedControlAttempts.length;
        closeVisualFrame = frame().then(() => { attempt.visualResult = now(); metrics.unrelatedControl.visualResult = attempt.visualResult; });
        metrics.__pendingControlAttempt = null;
      });
      const module = await loadGraphicalEditor(fixture);
      const openStart = now();
      metrics.marks.openCommand = openStart;
      const timerDue = openStart;
      setTimeout(() => { metrics.zeroDelayTimerDelayMs = now() - timerDue; }, 0);
      originalRAF((ts) => { metrics.rafDelayMs = now() - openStart; });
      const closeDispatchDue = openStart;
      setTimeout(() => {
        metrics.unrelatedControl.intendedDispatch = closeDispatchDue;
        metrics.unrelatedControl.actualDispatch = now();
        close.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }, 0);
      let probeTimer = 0;
      let probeExpected = now() + 5;
      const probeTick = () => {
        const actual = now();
        const delay = actual - probeExpected;
        metrics.eventLoopProbeDelays.push(delay);
        metrics.eventLoopProbeMaxDelayMs = Math.max(metrics.eventLoopProbeMaxDelayMs, delay);
        probeExpected = actual + 5;
        probeTimer = setTimeout(probeTick, 5);
      };
      probeTimer = setTimeout(probeTick, 5);
      [0, 20, 50, 100, 180].forEach((delayMs) => {
        setTimeout(() => {
          const intended = openStart + delayMs;
          const attempt = { delayMs, intended, actualDispatch: now() };
          metrics.unrelatedControlAttempts.push(attempt);
          metrics.__pendingControlAttempt = attempt;
          close.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }, delayMs);
      });
      const setupResult = await module.setupPanel(editorCell, { filePath: fixture.relativePath });
      if (probeTimer) clearTimeout(probeTimer);
      metrics.marks.setupResolved = now();
      await frame();
      metrics.marks.firstPostOpenFrame = now();
      await new Promise((resolve) => setTimeout(resolve, 220));
      if (closeVisualFrame) await closeVisualFrame;
      metrics.domNodesAfterOpen = document.querySelectorAll('*').length;
      metrics.panelCellsAfterOpen = document.querySelectorAll('.panel-cell').length;
      metrics.modeLayoutRootsAfterOpen = document.querySelectorAll('.panel-row[data-nv-mode-layout-id="SVGEditorMode"]').length;
      metrics.svgLayerPanelCellsAfterOpen = document.querySelectorAll('.panel-cell[data-id="SVGLayersPanel"], .panel-cell[data-panel-id="SVGLayersPanel"]').length;
      metrics.svgPropertiesPanelCellsAfterOpen = document.querySelectorAll('.panel-cell[data-id="SVGPropertiesPanel"], .panel-cell[data-panel-id="SVGPropertiesPanel"]').length;
      metrics.editorAcceptsInputAt = metrics.marks.contextReady || metrics.marks.setupResolved;
      metrics.workspaceResponsiveAt = metrics.unrelatedControl.handlerStart || metrics.zeroDelayTimerDelayMs;
      if (!window.__nvSvgEditorLatencySkipLineWorkflow) {
        await runLineWorkflow(metrics, fixture.objectCount);
      }
      metrics.domNodesAfterLine = document.querySelectorAll('*').length;
      active = null;
      stopLongTasks();
      if (setupResult && typeof setupResult.destroy === 'function') setupResult.destroy();
      else if (typeof setupResult === 'function') setupResult();
      cleanupBenchmarkWorkspace();
      await frame();
      return metrics;
    },
    async runRapidCloseCheck(fixture) {
      cleanupBenchmarkWorkspace();
      const { editorCell } = resetWorkspace();
      const module = await loadGraphicalEditor(fixture);
      const setupResult = await module.setupPanel(editorCell, { filePath: fixture.relativePath });
      if (setupResult && typeof setupResult.destroy === 'function') setupResult.destroy();
      else if (typeof setupResult === 'function') setupResult();
      await frame();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const result = {
        modeLayoutRootsAfterClose: document.querySelectorAll('.panel-row[data-nv-mode-layout-id="SVGEditorMode"]').length,
        layerPanelsAfterClose: document.querySelectorAll('.panel-cell[data-id="SVGLayersPanel"], .panel-cell[data-panel-id="SVGLayersPanel"]').length,
        propertiesPanelsAfterClose: document.querySelectorAll('.panel-cell[data-id="SVGPropertiesPanel"], .panel-cell[data-panel-id="SVGPropertiesPanel"]').length,
      };
      cleanupBenchmarkWorkspace();
      await frame();
      return result;
    },
    async runFileSwitchCheck(firstFixture, secondFixture) {
      cleanupBenchmarkWorkspace();
      const { editorCell } = resetWorkspace();
      const module = await loadGraphicalEditor(firstFixture);
      const first = await module.setupPanel(editorCell, { filePath: firstFixture.relativePath });
      if (first && typeof first.destroy === 'function') first.destroy();
      else if (typeof first === 'function') first();
      editorCell.replaceChildren();
      const second = await module.setupPanel(editorCell, { filePath: secondFixture.relativePath });
      await frame();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const result = {
        activePath: window.SVGEditorContext?.filePath || null,
        expectedPath: secondFixture.relativePath,
        modeLayoutRootsAfterSwitch: document.querySelectorAll('.panel-row[data-nv-mode-layout-id="SVGEditorMode"]').length,
        layerPanelsAfterSwitch: document.querySelectorAll('.panel-cell[data-id="SVGLayersPanel"], .panel-cell[data-panel-id="SVGLayersPanel"]').length,
        propertiesPanelsAfterSwitch: document.querySelectorAll('.panel-cell[data-id="SVGPropertiesPanel"], .panel-cell[data-panel-id="SVGPropertiesPanel"]').length,
      };
      if (second && typeof second.destroy === 'function') second.destroy();
      else if (typeof second === 'function') second();
      cleanupBenchmarkWorkspace();
      await frame();
      return result;
    }
  };
})();
</script></body></html>`, "utf8");
}

async function createRuntime() {
  process.env.NODEVISION_ROOT = ROOT;
  process.env.NODEVISION_PHP_ENABLED = "0";
  process.env.NODEVISION_PERF_DIAGNOSTICS = "0";
  const runtimeMod = await import(pathToFileURL(path.join(ROOT, "ApplicationSystem/core/runtime.js")).href);
  const runtimeController = runtimeMod.createRuntime({ runtimeRoot: ROOT, host: "127.0.0.1", port: PORT, portFallback: true, phpEnabled: false, mqttCsvLoggersEnabled: false });
  return { runtimeController, runtime: await runtimeController.start() };
}
function createWindow() {
  const win = new BrowserWindow({ show: true, width: 1320, height: 920, webPreferences: { contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  win.webContents.on("console-message", (_event, _level, message) => { if (/SVG editor|Error|failed|warn/i.test(String(message || ""))) console.log("[renderer]", message); });
  return win;
}
async function waitFor(win, expression, timeout = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ok = await win.webContents.executeJavaScript(`Boolean(${expression})`, true).catch(() => false);
    if (ok) return true;
    await delay(50);
  }
  throw new Error("Timed out waiting for " + expression);
}
async function prepareWindow(win, runtimeUrl) {
  writeHarness();
  await win.loadURL(runtimeUrl + "/__svg-editor-latency-benchmark-harness.html");
  await win.webContents.executeJavaScript(`fetch("/api/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "admin" }) }).then(r => r.json()).catch(() => ({}))`, true);
  await win.loadURL(runtimeUrl + "/__svg-editor-latency-benchmark-harness.html");
  await waitFor(win, "document.readyState === 'complete' && window.__nvSvgEditorLatencyBenchmark");
}
function summarizeRow(row) {
  const m = row.marks || {};
  const open = m.openCommand || 0;
  const line = row.lineClicks || [];
  return {
    fixture: row.fixture.id,
    objectCount: row.fixture.objectCount,
    setupMs: round((m.setupResolved || 0) - open),
    contextReadyMs: round((m.contextReady || 0) - open),
    firstFrameMs: round((m.firstPostOpenFrame || 0) - open),
    zeroDelayTimerDelayMs: round(row.zeroDelayTimerDelayMs),
    rafDelayMs: round(row.rafDelayMs),
    unrelatedDispatchDelayMs: round((row.unrelatedControl.actualDispatch || 0) - (row.unrelatedControl.intendedDispatch || open)),
    unrelatedHandlerDelayMs: round(Math.max(0, ...(row.unrelatedControlAttempts || []).map((attempt) => (attempt.handlerStart || 0) - (attempt.intended || open)))),
    eventLoopProbeMaxDelayMs: round(row.eventLoopProbeMaxDelayMs),
    panelCellsAfterOpen: row.panelCellsAfterOpen,
    modeLayoutRootsAfterOpen: row.modeLayoutRootsAfterOpen,
    svgLayerPanelCellsAfterOpen: row.svgLayerPanelCellsAfterOpen,
    svgPropertiesPanelCellsAfterOpen: row.svgPropertiesPanelCellsAfterOpen,
    qsaStar: row.querySelectorAllStar,
    getBBox: row.getBBoxCalls,
    getScreenCTM: row.getScreenCTMCalls,
    serializeCalls: row.serializeCalls,
    svgSetAttributeCalls: row.svgSetAttributeCalls,
    longestTaskMs: round(row.longestTaskMs),
    totalBlockingTimeMs: round(row.totalBlockingTimeMs),
    lineModeActivationMs: round(row.lineModeActivation?.latencyMs || 0),
    lineFirstHandlerMs: round(line.find((item) => item.session === 'ui-pointer-normal' && item.phase === 'first')?.handlerDurationMs || 0),
    lineFirstDomMs: round(line.find((item) => item.session === 'ui-pointer-normal' && item.phase === 'first')?.domMutationDelayMs || 0),
    lineFirstFrameMs: round(line.find((item) => item.session === 'ui-pointer-normal' && item.phase === 'first')?.nextFrameDelayMs || 0),
    lineIntermediateHandlerMs: round(line.find((item) => item.session === 'ui-pointer-normal' && item.phase === 'intermediate')?.handlerDurationMs || 0),
    lineIntermediateDomMs: round(line.find((item) => item.session === 'ui-pointer-normal' && item.phase === 'intermediate')?.domMutationDelayMs || 0),
    lineShiftIntermediateHandlerMs: round(line.find((item) => item.session === 'ui-pointer-shift-snap' && item.phase === 'intermediate')?.handlerDurationMs || 0),
    lineShiftIntermediateDomMs: round(line.find((item) => item.session === 'ui-pointer-shift-snap' && item.phase === 'intermediate')?.domMutationDelayMs || 0),
    lineMouseNewGeometry: line.filter((item) => item.session === 'dispatched-mouse-control').reduce((sum, item) => sum + (item.newGeometryCount || 0), 0),
    lineHandlerMedianMs: stats(line.map((item) => item.handlerDurationMs || 0)).median,
  };
}
function makeMarkdown(report) {
  const lines = ["# SVG Editor Latency Benchmark", "", `Generated: ${report.generatedAt}`, "", "## Environment", "", `- Electron: ${report.environment.electron}`, `- Chrome: ${report.environment.chrome}`, `- Node: ${report.environment.node}`, `- Platform: ${report.environment.platform} ${report.environment.release} ${report.environment.arch}`, "", "## Summary", "", "| Fixture | Objects | Setup ms | Context ready ms | First frame ms | 0ms timer delay | RAF delay | Unrelated handler delay | Panel cells | Mode roots | Layers panels | Properties panels | qSA * | getBBox | Serialize | getScreenCTM | SVG attrs | Longest task | Loop max delay | Line mode | First handler | First DOM | First frame | Mid handler | Mid DOM | Shift mid handler | Shift mid DOM | Mouse geometry | Handler median |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"];
  for (const row of report.summary) lines.push(`| ${row.fixture} | ${row.objectCount} | ${row.setupMs} | ${row.contextReadyMs} | ${row.firstFrameMs} | ${row.zeroDelayTimerDelayMs} | ${row.rafDelayMs} | ${row.unrelatedHandlerDelayMs} | ${row.panelCellsAfterOpen} | ${row.modeLayoutRootsAfterOpen} | ${row.svgLayerPanelCellsAfterOpen} | ${row.svgPropertiesPanelCellsAfterOpen} | ${row.qsaStar} | ${row.getBBox} | ${row.serializeCalls} | ${row.getScreenCTM} | ${row.svgSetAttributeCalls} | ${row.longestTaskMs} | ${row.eventLoopProbeMaxDelayMs} | ${row.lineModeActivationMs} | ${row.lineFirstHandlerMs} | ${row.lineFirstDomMs} | ${row.lineFirstFrameMs} | ${row.lineIntermediateHandlerMs} | ${row.lineIntermediateDomMs} | ${row.lineShiftIntermediateHandlerMs} | ${row.lineShiftIntermediateDomMs} | ${row.lineMouseNewGeometry} | ${row.lineHandlerMedianMs} |`);
  if (report.safety) {
    lines.push("", "## Deferred Layout Safety", "");
    lines.push(`- Rapid close: ${JSON.stringify(report.safety.rapidClose)}`);
    lines.push(`- File switch: ${JSON.stringify(report.safety.fileSwitch)}`);
  }
  if (report.consoleMessages?.length) {
    lines.push("", "## Captured Console Diagnostics", "");
    for (const message of report.consoleMessages) lines.push(`- [${message.level}] ${String(message.text || '').replace(/\s+/g, ' ').slice(0, 500)}`);
  }
  return lines.join("\n");
}
function assertDeferredLayout(report) {
  if (!EXPECT_DEFERRED_LAYOUT) return;
  const small = report.summary.find((row) => row.fixture === 'empty') || report.summary[0];
  if (!small) throw new Error('Missing benchmark rows');
  if (small.unrelatedHandlerDelayMs > 120) throw new Error(`Expected unrelated control to respond promptly for empty SVG; saw ${small.unrelatedHandlerDelayMs}ms`);
  if (small.contextReadyMs > 250) throw new Error(`Expected context ready promptly for empty SVG; saw ${small.contextReadyMs}ms`);
  for (const row of report.summary) {
    if (row.modeLayoutRootsAfterOpen !== 1) throw new Error(`Expected one SVG mode layout root for ${row.fixture}; saw ${row.modeLayoutRootsAfterOpen}`);
    if (row.svgLayerPanelCellsAfterOpen !== 1) throw new Error(`Expected one SVG layers panel for ${row.fixture}; saw ${row.svgLayerPanelCellsAfterOpen}`);
    if (row.svgPropertiesPanelCellsAfterOpen !== 1) throw new Error(`Expected one SVG properties panel for ${row.fixture}; saw ${row.svgPropertiesPanelCellsAfterOpen}`);
  }
  if (report.safety?.rapidClose?.modeLayoutRootsAfterClose !== 0) throw new Error(`Deferred layout was not canceled on rapid close: ${JSON.stringify(report.safety.rapidClose)}`);
  if (report.safety?.fileSwitch?.activePath !== report.safety?.fileSwitch?.expectedPath) throw new Error(`File switch left stale SVG context: ${JSON.stringify(report.safety.fileSwitch)}`);
  if (report.safety?.fileSwitch?.modeLayoutRootsAfterSwitch !== 1) throw new Error(`File switch created duplicate/missing layout roots: ${JSON.stringify(report.safety.fileSwitch)}`);
}
async function runBenchmark() {
  app.on("window-all-closed", (event) => event.preventDefault());
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-dev-shm-usage");
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  await app.whenReady();
  const fixtures = buildFixtures();
  const { runtimeController, runtime } = await createRuntime();
  const win = createWindow();
  const rows = [];
  let safety = null;
  let consoleMessages = [];
  try {
    await prepareWindow(win, runtime.url);
    await win.webContents.executeJavaScript(`window.__nvSvgEditorLatencySkipLineWorkflow = ${SKIP_LINE_WORKFLOW ? "true" : "false"}`, true);
    for (const fixture of fixtures) rows.push(await win.webContents.executeJavaScript(`window.__nvSvgEditorLatencyBenchmark.runFixture(${JSON.stringify(fixture)})`, true));
    safety = {
      rapidClose: await win.webContents.executeJavaScript(`window.__nvSvgEditorLatencyBenchmark.runRapidCloseCheck(${JSON.stringify(fixtures.find((fixture) => fixture.id === '1000-objects') || fixtures[0])})`, true),
      fileSwitch: await win.webContents.executeJavaScript(`window.__nvSvgEditorLatencyBenchmark.runFileSwitchCheck(${JSON.stringify(fixtures.find((fixture) => fixture.id === '1000-objects') || fixtures[0])}, ${JSON.stringify(fixtures.find((fixture) => fixture.id === 'mixed') || fixtures[fixtures.length - 1])})`, true),
    };
    consoleMessages = await win.webContents.executeJavaScript('window.__nvSvgEditorLatencyConsole || []', true).catch(() => []);
  } finally {
    try { win.close(); } catch {}
    await runtimeController.stop().catch(() => {});
  }
  const report = { generatedAt: new Date().toISOString(), configuration: { expectDeferredLayout: EXPECT_DEFERRED_LAYOUT, skipLineWorkflow: SKIP_LINE_WORKFLOW }, environment: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, v8: process.versions.v8, platform: os.platform(), release: os.release(), arch: os.arch(), cpus: os.cpus().length, totalMemoryBytes: os.totalmem() }, fixtures, rows, safety, consoleMessages, summary: rows.map(summarizeRow) };
  assertDeferredLayout(report);
  fs.writeFileSync(JSON_REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(MARKDOWN_REPORT_PATH, makeMarkdown(report), "utf8");
  return report;
}
runBenchmark().then((report) => {
  console.log(JSON.stringify({ jsonReportPath: JSON_REPORT_PATH, markdownReportPath: MARKDOWN_REPORT_PATH, summary: report.summary }, null, 2));
}).catch((err) => { console.error(err); process.exitCode = 1; }).finally(() => {
  try { fs.rmSync(PUBLIC_HARNESS, { force: true }); } catch {}
  try { app.quit(); } catch {}
});
