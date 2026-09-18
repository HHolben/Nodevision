// Nodevision/ApplicationSystem/tests/svgLineStationaryFeedbackBenchmark.electron.cjs
// Focused Electron benchmark for stationary-pointer visual feedback in SVG Vector Draw Line mode.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, nativeImage } = require("electron");

const ROOT = process.cwd();
const PORT = Number(process.env.NODEVISION_SVG_LINE_FEEDBACK_PORT || 39487);
const FIXTURE_ROOT = path.join(ROOT, "Notebook", "__nv_svg_line_feedback_benchmark");
const PUBLIC_HARNESS = path.join(ROOT, "ApplicationSystem/public/__svg-line-feedback-benchmark-harness.html");
const JSON_REPORT_PATH = process.env.NODEVISION_SVG_LINE_FEEDBACK_REPORT || path.join(ROOT, "ApplicationSystem/tests/svgLineStationaryFeedbackBenchmark.report.json");
const MD_REPORT_PATH = process.env.NODEVISION_SVG_LINE_FEEDBACK_MD || path.join(ROOT, "ApplicationSystem/tests/svgLineStationaryFeedbackBenchmark.report.md");
const CAPTURE_SCREENSHOTS = process.env.NODEVISION_SVG_LINE_FEEDBACK_SCREENSHOTS !== "0";
const SCENARIO_MODES = (process.env.NODEVISION_SVG_LINE_FEEDBACK_MODES || "native,dispatched-pointer,dispatched-mouse")
  .split(",")
  .map((mode) => mode.trim())
  .filter(Boolean);
const ACTIVATION_WAIT_MS = Number(process.env.NODEVISION_SVG_LINE_FEEDBACK_ACTIVATION_WAIT_MS || 0);

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function round(value, digits = 2) { const factor = 10 ** digits; return Math.round(Number(value || 0) * factor) / factor; }
function fixtureSvg(objectCount = 0) {
  const rects = [];
  for (let i = 0; i < objectCount; i += 1) {
    const col = i % 40;
    const row = Math.floor(i / 40);
    rects.push(`<rect id="obj-${i}" x="${20 + col * 28}" y="${20 + row * 18}" width="16" height="10" fill="#dbeafe" stroke="#1e3a8a" stroke-width="0.75"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="720" viewBox="0 0 1000 720"><rect x="0" y="0" width="1000" height="720" fill="#ffffff"/>${rects.join("\n")}</svg>`;
}
function buildFixtures() {
  fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
  return [0, 1, 100, 1000].map((count) => {
    const id = count === 0 ? "empty" : `${count}-objects`;
    const fileName = `${id}.svg`;
    fs.writeFileSync(path.join(FIXTURE_ROOT, fileName), fixtureSvg(count), "utf8");
    return { id, objectCount: count, relativePath: `__nv_svg_line_feedback_benchmark/${fileName}` };
  });
}
function writeHarness() {
  fs.writeFileSync(PUBLIC_HARNESS, `<!doctype html><html><head><meta charset="utf-8"><title>SVG Line Stationary Feedback</title><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;font-family:Arial,sans-serif;background:#f8fafc}
#global-toolbar,#sub-toolbar{display:flex;gap:4px;min-height:34px;align-items:center;background:#eef2ff;border-bottom:1px solid #c7d2fe;padding:2px 4px;box-sizing:border-box}
#sub-toolbar{background:#f1f5f9}
#workspace{display:flex;width:1280px;height:850px;align-items:stretch}.panel-row{display:flex;min-width:0;min-height:0}.panel-cell{display:flex;min-width:0;min-height:0;position:relative;overflow:hidden;border:1px solid #ddd;box-sizing:border-box}.editor-cell{flex:1 1 auto}
</style></head><body><div id="global-toolbar"></div><div id="sub-toolbar"></div><div id="workspace" class="panel-row"></div><script type="module">
(() => {
  const originalAdd = EventTarget.prototype.addEventListener;
  const originalRemove = EventTarget.prototype.removeEventListener;
  const originalAppend = Element.prototype.appendChild;
  const originalSetAttribute = Element.prototype.setAttribute;
  const originalRAF = window.requestAnimationFrame.bind(window);
  const listenerMap = new WeakMap();
  let active = null;
  let pendingPointPhase = null;
  const now = () => performance.now();
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const nextFrame = () => new Promise((resolve) => originalRAF(() => resolve(now())));
  function recordTimeline(kind, detail = {}) { if (active) active.timeline.push({ kind, time: now(), ...detail }); }
  function isEditorUi(el) { return el instanceof SVGElement && el.hasAttribute('data-nv-editor-ui'); }
  function elName(el) { return el?.tagName ? String(el.tagName).toLowerCase() : ''; }
  Element.prototype.appendChild = function(child) {
    if (active && child instanceof SVGElement) {
      if (isEditorUi(child)) recordTimeline('overlay-inserted', { tag: elName(child), ui: child.getAttribute('data-nv-editor-ui') || '' });
      else if (['line','polyline','polygon','path','circle'].includes(elName(child))) recordTimeline('committed-inserted', { tag: elName(child), phase: pendingPointPhase || '' });
    }
    return originalAppend.call(this, child);
  };
  Element.prototype.setAttribute = function(name, value) {
    if (active && this instanceof SVGElement) {
      const tag = elName(this);
      const ui = this.getAttribute('data-nv-editor-ui') || '';
      if (ui && ui.startsWith('line-tool-')) recordTimeline('overlay-attribute', { tag, ui, name, value: String(value), phase: pendingPointPhase || '' });
      if (!ui && ['line','polyline','polygon','path','circle'].includes(tag)) recordTimeline('committed-attribute', { tag, name, value: String(value), phase: pendingPointPhase || '' });
    }
    return originalSetAttribute.call(this, name, value);
  };
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (typeof listener !== 'function') return originalAdd.call(this, type, listener, options);
    const wrapped = function(event) {
      const isSvgPointer = active && (type === 'pointerdown' || type === 'pointermove' || type === 'mousedown' || type === 'click') && this instanceof SVGElement;
      const span = isSvgPointer ? { type, delivered: now(), target: elName(event.target), shiftKey: Boolean(event.shiftKey), phase: pendingPointPhase || '' } : null;
      if (span) active.eventSpans.push(span);
      try { return listener.call(this, event); }
      finally {
        if (span) {
          span.ended = now();
          span.duration = span.ended - span.delivered;
        }
      }
    };
    listenerMap.set(listener, wrapped);
    return originalAdd.call(this, type, wrapped, options);
  };
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    const wrapped = listenerMap.get(listener);
    if (wrapped) {
      listenerMap.delete(listener);
      return originalRemove.call(this, type, wrapped, options);
    }
    return originalRemove.call(this, type, listener, options);
  };
  window.__nvLineFeedbackNextFrame = nextFrame;
  function resetWorkspace() {
    document.querySelectorAll('#workspace, .panel-row[data-nv-mode-layout-id="SVGEditorMode"]').forEach((node) => node.remove());
    const workspace = document.createElement('div');
    workspace.id = 'workspace';
    workspace.className = 'panel-row';
    const editorCell = document.createElement('div');
    editorCell.className = 'panel-cell editor-cell';
    editorCell.dataset.panelClass = 'EditorPanel';
    editorCell.dataset.panelId = 'SVGEditor';
    workspace.appendChild(editorCell);
    document.body.appendChild(workspace);
    return { editorCell };
  }
  function cleanup() {
    try { window.SVGEditorContext?.destroy?.(); } catch {}
    window.SVGEditorContext = null;
    window.__nvSvgEditorActivePath = null;
    document.querySelectorAll('#workspace, .panel-row[data-nv-mode-layout-id="SVGEditorMode"]').forEach((node) => node.remove());
    document.querySelector('#global-toolbar')?.replaceChildren();
    document.querySelector('#sub-toolbar')?.replaceChildren();
  }
  function buttonByLabel(root, label) {
    const wanted = String(label || '').trim().toLowerCase();
    const norm = (value) => String(value || '').trim().toLowerCase().split('\\nshortcut:')[0].replace('. shortcut:', '').trim();
    return Array.from(root?.querySelectorAll?.('button') || []).find((button) => [button.textContent, button.title, button.getAttribute('aria-label'), button.dataset?.tooltipText, button.closest?.('[data-heading]')?.dataset?.heading].some((value) => norm(value) === wanted)) || null;
  }
  function clickButton(button) {
    if (!button) return false;
    button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }));
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0 }));
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0 }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));
    return true;
  }
  async function activateLineTool() {
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.currentMode = 'SVG Editing';
    window.NodevisionState.activePanelType = 'GraphicalEditor';
    window.NodevisionState.svgDrawTool = 'select';
    const timings = [];
    const timed = async (label, fn) => { const started = now(); try { return await fn(); } finally { timings.push({ label, started, ended: now(), duration: now() - started }); } };
    const timedSync = (label, fn) => { const started = now(); try { return fn(); } finally { timings.push({ label, started, ended: now(), duration: now() - started }); } };
    const toolbar = await timed('import:createToolbar', () => import('/panels/createToolbar.mjs?v=' + Date.now() + Math.random()));
    await timed('createToolbar:SVG Editing', () => toolbar.createToolbar('#global-toolbar', 'SVG Editing'));
    const steps = [];
    steps.push({ label: 'Draw', clicked: timedSync('click:Draw', () => clickButton(buttonByLabel(document.getElementById('global-toolbar'), 'Draw'))) });
    timedSync('showToolbarSubToolbar:Vector Draw', () => toolbar.showToolbarSubToolbar('Vector Draw', { force: true, toggle: false }));
    await nextFrame();
    steps.push({ label: 'Vector Draw', clicked: timedSync('click:Vector Draw', () => clickButton(buttonByLabel(document, 'Vector Draw'))) });
    timedSync('showToolbarSubToolbar:Vector Draw', () => toolbar.showToolbarSubToolbar('Vector Draw', { force: true, toggle: false }));
    await nextFrame();
    steps.push({ label: 'Line', clicked: timedSync('click:Line', () => clickButton(buttonByLabel(document.getElementById('sub-toolbar'), 'Line'))) });
    if (window.NodevisionState?.svgDrawTool !== 'line') {
      const mod = await timed('fallback-import:svgModeLine', () => import('/ToolbarCallbacks/draw/svgModeLine.mjs?v=' + Date.now() + Math.random()));
      timedSync('fallback-run:svgModeLine', () => mod.default?.());
      steps.push({ label: 'fallback-svgModeLine', clicked: true });
    }
    await nextFrame();
    return { steps, mode: window.NodevisionState?.svgDrawTool || null, timings };
  }
  function svgClientPoint(svg, rootPoint) {
    const pt = svg.createSVGPoint();
    pt.x = rootPoint.x;
    pt.y = rootPoint.y;
    const screen = pt.matrixTransform(svg.getScreenCTM());
    return { x: Math.round(screen.x), y: Math.round(screen.y) };
  }
  function snapshotDom(label) {
    const svg = window.SVGEditorContext?.svgRoot;
    const previewLine = svg?.querySelector('[data-nv-editor-ui="line-tool-preview-line"]') || null;
    const previewEnd = svg?.querySelector('[data-nv-editor-ui="line-tool-preview-end"]') || null;
    const markers = Array.from(svg?.querySelectorAll('[data-nv-editor-ui="line-tool-vertex-marker"]') || [])
      .map((el) => ({ attrs: Object.fromEntries(Array.from(el.attributes).map((attr) => [attr.name, attr.value])), style: el.getAttribute("style") || "" }));
    const committed = Array.from(svg?.querySelectorAll('line, polyline, polygon, path, circle') || [])
      .filter((el) => !el.closest('[data-nv-editor-ui]'))
      .map((el) => ({ tag: el.tagName.toLowerCase(), attrs: Object.fromEntries(Array.from(el.attributes).map((attr) => [attr.name, attr.value])) }));
    const out = {
      label,
      time: now(),
      state: window.SVGEditorContext?.debugLineToolState?.() || null,
      committed,
      previewLine: previewLine ? Object.fromEntries(Array.from(previewLine.attributes).map((attr) => [attr.name, attr.value])) : null,
      previewEnd: previewEnd ? Object.fromEntries(Array.from(previewEnd.attributes).map((attr) => [attr.name, attr.value])) : null,
      markers,
    };
    if (active) active.domSnapshots.push(out);
    return out;
  }
  function dispatchPointer(svg, point, options = {}) {
    pendingPointPhase = options.phase || '';
    const type = options.type || 'pointerdown';
    if (type === 'pointerdown') window.__nvSvgLinePointerProbe = [];
    const evt = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse', isPrimary: true, clientX: point.x, clientY: point.y, button: 0, buttons: 1, detail: options.detail || 1, shiftKey: Boolean(options.shiftKey) });
    svg.dispatchEvent(evt);
    if (type === 'pointerdown' && active && Array.isArray(window.__nvSvgLinePointerProbe)) {
      active.lineProbes.push({ phase: pendingPointPhase, entries: window.__nvSvgLinePointerProbe.slice() });
    }
    pendingPointPhase = null;
  }
  function dispatchMouse(svg, point, options = {}) {
    pendingPointPhase = options.phase || '';
    svg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, button: 0, buttons: 1, shiftKey: Boolean(options.shiftKey) }));
    svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, button: 0, buttons: 0, shiftKey: Boolean(options.shiftKey) }));
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, button: 0, buttons: 0, shiftKey: Boolean(options.shiftKey), detail: options.detail || 1 }));
    pendingPointPhase = null;
  }
  window.__nvLineFeedbackBenchmark = {
    async setup(fixture) {
      cleanup();
      const { editorCell } = resetWorkspace();
      const ready = new Promise((resolve) => window.addEventListener('nv-svg-editor-context-ready', resolve, { once: true }));
      const module = await import('/PanelInstances/EditorPanels/GraphicalEditor.mjs?v=' + Date.now() + Math.random());
      await module.setupPanel(editorCell, { filePath: fixture.relativePath });
      await ready;
      await delay(120);
      const activation = await activateLineTool();
      const activationWaitMs = Number(window.__nvLineFeedbackActivationWaitMs || 0);
      if (Number.isFinite(activationWaitMs) && activationWaitMs > 0) {
        const started = now();
        await delay(activationWaitMs);
        activation.activationWaitAppliedMs = now() - started;
      }
      const svg = window.SVGEditorContext.svgRoot;
      const rootPoints = [{ x: 220, y: 180 }, { x: 360, y: 260 }, { x: 480, y: 220 }];
      return { activation, clientPoints: rootPoints.map((p) => svgClientPoint(svg, p)) };
    },
    startRun(label, fixture) {
      active = { label, fixture, timeline: [], eventSpans: [], domSnapshots: [], lineProbes: [] };
      snapshotDom('initial');
      return active;
    },
    finishRun() { const result = active; active = null; pendingPointPhase = null; return result; },
    snapshotDom,
    async dispatchedPointerClick(point, phase, shiftKey = false) {
      const svg = window.SVGEditorContext.svgRoot;
      snapshotDom(phase + '-before');
      recordTimeline('input-requested', { method: 'dispatched-pointer', phase });
      dispatchPointer(svg, point, { phase, shiftKey });
      recordTimeline('input-returned', { method: 'dispatched-pointer', phase });
      snapshotDom(phase + '-after-handler');
      await nextFrame();
      snapshotDom(phase + '-after-raf');
      await delay(1000);
      snapshotDom(phase + '-after-1s-still');
    },
    async dispatchedPointerMove(point, phase, shiftKey = false) {
      const svg = window.SVGEditorContext.svgRoot;
      recordTimeline('move-requested', { method: 'dispatched-pointer', phase });
      dispatchPointer(svg, point, { phase, shiftKey, type: 'pointermove' });
      recordTimeline('move-returned', { method: 'dispatched-pointer', phase });
      snapshotDom(phase + '-after-move-handler');
      await nextFrame();
      snapshotDom(phase + '-after-move-raf');
    },
    async dispatchedMouseClick(point, phase, shiftKey = false) {
      const svg = window.SVGEditorContext.svgRoot;
      snapshotDom(phase + '-before');
      dispatchMouse(svg, point, { phase, shiftKey });
      snapshotDom(phase + '-after-handler');
      await nextFrame();
      snapshotDom(phase + '-after-raf');
    },
    directSetModeLine() { window.SVGEditorContext?.setMode?.('line'); return window.NodevisionState?.svgDrawTool || null; },
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
  win.focus();
  win.webContents.on("console-message", (_event, _level, message) => { if (/SVG editor|Error|failed|warn|TypeError/i.test(String(message || ""))) console.log("[renderer]", message); });
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
  await win.loadURL(runtimeUrl + "/__svg-line-feedback-benchmark-harness.html");
  await win.webContents.executeJavaScript(`fetch("/api/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "admin" }) }).then(r => r.json()).catch(() => ({}))`, true);
  await win.loadURL(runtimeUrl + "/__svg-line-feedback-benchmark-harness.html");
  await waitFor(win, "document.readyState === 'complete' && window.__nvLineFeedbackBenchmark");
  await win.webContents.executeJavaScript("window.__nvLineFeedbackActivationWaitMs = " + (Number(ACTIVATION_WAIT_MS) || 0), true);
}
function imageDiffMetric(a, b) {
  const ia = nativeImage.createFromBuffer(a).toBitmap();
  const ib = nativeImage.createFromBuffer(b).toBitmap();
  const len = Math.min(ia.length, ib.length);
  let changed = 0;
  let sum = 0;
  for (let i = 0; i < len; i += 4) {
    const d = Math.abs(ia[i] - ib[i]) + Math.abs(ia[i + 1] - ib[i + 1]) + Math.abs(ia[i + 2] - ib[i + 2]) + Math.abs(ia[i + 3] - ib[i + 3]);
    if (d > 12) changed += 1;
    sum += d;
  }
  return { changedPixels: changed, totalDiff: sum };
}
async function captureCrop(win, point, label, baseBuffer = null) {
  const rect = { x: Math.max(0, Math.round(point.x - 34)), y: Math.max(0, Math.round(point.y - 34)), width: 68, height: 68 };
  if (!CAPTURE_SCREENSHOTS) return { label, time: Date.now(), rect, skipped: true, diffFromBase: null, buffer: Buffer.alloc(0) };
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await delay(attempt ? 60 : 0);
      let img;
      try {
        img = await win.webContents.capturePage(rect);
      } catch (err) {
        lastError = err;
        const full = await win.webContents.capturePage();
        img = typeof full.crop === 'function' ? full.crop(rect) : full;
      }
      const buffer = img.toPNG();
      return { label, time: Date.now(), rect, diffFromBase: baseBuffer ? imageDiffMetric(baseBuffer, buffer) : null, buffer };
    } catch (err) {
      lastError = err;
    }
  }
  return { label, time: Date.now(), rect, captureError: String(lastError?.message || lastError || 'capture failed'), diffFromBase: null, buffer: Buffer.alloc(0) };
}
async function nativeClick(win, point, phase, modifiers = []) {
  await win.webContents.executeJavaScript(`window.__nvLineFeedbackBenchmark.snapshotDom(${JSON.stringify(phase + '-before')})`, true);
  win.focus();
  win.webContents.focus();
  win.webContents.sendInputEvent({ type: "mouseMove", x: Math.round(point.x), y: Math.round(point.y), modifiers });
  await delay(30);
  win.webContents.sendInputEvent({ type: "mouseDown", x: Math.round(point.x), y: Math.round(point.y), button: "left", clickCount: 1, modifiers });
  win.webContents.sendInputEvent({ type: "mouseUp", x: Math.round(point.x), y: Math.round(point.y), button: "left", clickCount: 1, modifiers });
  await win.webContents.executeJavaScript(`window.__nvLineFeedbackBenchmark.snapshotDom(${JSON.stringify(phase + '-after-sendInput')})`, true);
}
async function nativeMove(win, point, phase, modifiers = []) {
  win.webContents.sendInputEvent({ type: "mouseMove", x: Math.round(point.x), y: Math.round(point.y), modifiers });
  await win.webContents.executeJavaScript(`window.__nvLineFeedbackBenchmark.snapshotDom(${JSON.stringify(phase + '-after-native-move')})`, true);
}
async function runScenario(win, fixture, mode) {
  const setup = await win.webContents.executeJavaScript(`window.__nvLineFeedbackBenchmark.setup(${JSON.stringify(fixture)})`, true);
  const points = setup.clientPoints;
  await win.webContents.executeJavaScript(`window.__nvLineFeedbackBenchmark.startRun(${JSON.stringify(mode)}, ${JSON.stringify(fixture)})`, true);
  const screenshots = [];
  screenshots.push(await captureCrop(win, points[0], `${mode}-before-first`));
  const firstBase = screenshots[screenshots.length - 1].buffer;
  if (mode === "native") await nativeClick(win, points[0], 'first');
  else if (mode === "dispatched-pointer") await win.webContents.executeJavaScript(`window.__nvLineFeedbackBenchmark.dispatchedPointerClick(${JSON.stringify(points[0])}, 'first', false)`, true);
  else if (mode === "dispatched-mouse") await win.webContents.executeJavaScript(`window.__nvLineFeedbackBenchmark.dispatchedMouseClick(${JSON.stringify(points[0])}, 'first', false)`, true);
  screenshots.push(await captureCrop(win, points[0], `${mode}-first-immediate`, firstBase));
  await win.webContents.executeJavaScript('window.__nvLineFeedbackNextFrame()', true);
  screenshots.push(await captureCrop(win, points[0], `${mode}-first-after-raf`, firstBase));
  await delay(1000);
  screenshots.push(await captureCrop(win, points[0], `${mode}-first-after-1s`, firstBase));
  if (mode === "native") await nativeMove(win, { x: points[0].x + 12, y: points[0].y + 5 }, 'first-small-move');
  else if (mode === "dispatched-pointer") await win.webContents.executeJavaScript(`window.__nvLineFeedbackBenchmark.dispatchedPointerMove(${JSON.stringify({ x: points[0].x + 12, y: points[0].y + 5 })}, 'first-small-move', false)`, true);
  screenshots.push(await captureCrop(win, points[0], `${mode}-first-after-small-move`, firstBase));

  screenshots.push(await captureCrop(win, points[1], `${mode}-before-second`));
  const secondBase = screenshots[screenshots.length - 1].buffer;
  if (mode === "native") await nativeClick(win, points[1], 'second');
  else if (mode === "dispatched-pointer") await win.webContents.executeJavaScript(`window.__nvLineFeedbackBenchmark.dispatchedPointerClick(${JSON.stringify(points[1])}, 'second', false)`, true);
  else if (mode === "dispatched-mouse") await win.webContents.executeJavaScript(`window.__nvLineFeedbackBenchmark.dispatchedMouseClick(${JSON.stringify(points[1])}, 'second', false)`, true);
  screenshots.push(await captureCrop(win, points[1], `${mode}-second-immediate`, secondBase));
  await win.webContents.executeJavaScript('window.__nvLineFeedbackNextFrame()', true);
  screenshots.push(await captureCrop(win, points[1], `${mode}-second-after-raf`, secondBase));
  await delay(1000);
  screenshots.push(await captureCrop(win, points[1], `${mode}-second-after-1s`, secondBase));
  if (mode === "native") await nativeMove(win, { x: points[1].x + 12, y: points[1].y + 5 }, 'second-small-move');
  else if (mode === "dispatched-pointer") await win.webContents.executeJavaScript(`window.__nvLineFeedbackBenchmark.dispatchedPointerMove(${JSON.stringify({ x: points[1].x + 12, y: points[1].y + 5 })}, 'second-small-move', false)`, true);
  screenshots.push(await captureCrop(win, points[1], `${mode}-second-after-small-move`, secondBase));

  const run = await win.webContents.executeJavaScript('window.__nvLineFeedbackBenchmark.finishRun()', true);
  return { mode, fixture, setup, run, screenshots: screenshots.map(({ buffer, ...rest }) => rest) };
}
function summarizeScenario(result) {
  const snaps = Object.fromEntries((result.run.domSnapshots || []).map((snap) => [snap.label, snap]));
  const shot = Object.fromEntries((result.screenshots || []).map((snap) => [snap.label, snap]));
  const prefix = result.mode;
  return {
    mode: result.mode,
    fixture: result.fixture.id,
    activation: result.setup.activation,
    firstAfterStill: snaps['first-after-1s-still'] || snaps['first-after-sendInput'] || null,
    secondAfterStill: snaps['second-after-1s-still'] || snaps['second-after-sendInput'] || null,
    firstMarkers: (snaps['first-after-1s-still'] || snaps['first-after-sendInput'] || {}).markers || [],
    secondMarkers: (snaps['second-after-1s-still'] || snaps['second-after-sendInput'] || {}).markers || [],
    screenshotDiffs: {
      firstImmediate: shot[`${prefix}-first-immediate`]?.diffFromBase || null,
      firstAfter1s: shot[`${prefix}-first-after-1s`]?.diffFromBase || null,
      firstAfterMove: shot[`${prefix}-first-after-small-move`]?.diffFromBase || null,
      secondImmediate: shot[`${prefix}-second-immediate`]?.diffFromBase || null,
      secondAfter1s: shot[`${prefix}-second-after-1s`]?.diffFromBase || null,
      secondAfterMove: shot[`${prefix}-second-after-small-move`]?.diffFromBase || null,
    },
    eventSpans: result.run.eventSpans,
    lineProbes: result.run.lineProbes || [],
  };
}
function markdown(report) {
  const lines = ['# SVG Line Stationary Feedback Benchmark', '', `Generated: ${report.generatedAt}`, '', `Electron: ${report.environment.electron}`, `Node: ${report.environment.node}`, `Platform: ${report.environment.platform} ${report.environment.release}`, '', '## Summary', ''];
  for (const item of report.summary) {
    lines.push(`### ${item.mode} / ${item.fixture}`);
    lines.push(`- Activation: ${JSON.stringify(item.activation)}`);
    lines.push(`- Screenshot diffs: ${JSON.stringify(item.screenshotDiffs)}`);
    lines.push(`- Event spans: ${JSON.stringify(item.eventSpans?.map((s) => ({ type: s.type, duration: round(s.duration), phase: s.phase })))}`);
    lines.push(`- First still DOM/state: ${JSON.stringify(item.firstAfterStill?.state || item.firstAfterStill)}`);
    lines.push(`- Second still DOM/state: ${JSON.stringify(item.secondAfterStill?.state || item.secondAfterStill)}`);
    lines.push(`- Marker counts: first=${item.firstMarkers?.length || 0}, second=${item.secondMarkers?.length || 0}`);
    lines.push('');
  }
  return lines.join('\n');
}
async function run() {
  app.on('window-all-closed', (event) => event.preventDefault());
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  await app.whenReady();
  const fixtures = buildFixtures();
  const fixture = fixtures.find((item) => item.id === (process.env.NODEVISION_SVG_LINE_FEEDBACK_FIXTURE || 'empty')) || fixtures[0];
  const { runtimeController, runtime } = await createRuntime();
  const win = createWindow();
  const scenarios = [];
  try {
    await prepareWindow(win, runtime.url);
    for (const mode of SCENARIO_MODES) scenarios.push(await runScenario(win, fixture, mode));
  } finally {
    try { win.close(); } catch {}
    await runtimeController.stop().catch(() => {});
  }
  const report = { generatedAt: new Date().toISOString(), environment: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, platform: os.platform(), release: os.release(), arch: os.arch(), captureScreenshots: CAPTURE_SCREENSHOTS, scenarioModes: SCENARIO_MODES, activationWaitMs: ACTIVATION_WAIT_MS }, fixture, scenarios, summary: scenarios.map(summarizeScenario) };
  fs.writeFileSync(JSON_REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(MD_REPORT_PATH, markdown(report), 'utf8');
  console.log(JSON.stringify({ jsonReportPath: JSON_REPORT_PATH, markdownReportPath: MD_REPORT_PATH, summary: report.summary }, null, 2));
}
run().catch((err) => { console.error(err); process.exitCode = 1; }).finally(() => {
  try { fs.rmSync(PUBLIC_HARNESS, { force: true }); } catch {}
  try { app.quit(); } catch {}
});
