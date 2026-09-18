// Nodevision/ApplicationSystem/tests/svgPropertiesPanelLifecycleBenchmark.electron.cjs
// Synthetic Electron benchmark for SVG Properties-panel listener lifecycle.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

const ROOT = process.cwd();
const PORT = Number(process.env.NODEVISION_SVG_PROPERTIES_LIFECYCLE_PORT || 39485);
const PUBLIC_HARNESS = path.join(ROOT, "ApplicationSystem/public/__svg-properties-lifecycle-benchmark-harness.html");
const PUBLIC_BASELINE_MODULE = path.join(ROOT, "ApplicationSystem/public/__svg-properties-panel-baseline.mjs");
const JSON_REPORT_PATH = process.env.NODEVISION_SVG_PROPERTIES_LIFECYCLE_REPORT ||
  path.join(ROOT, "ApplicationSystem/tests/svgPropertiesPanelLifecycleBenchmark.report.json");
const MARKDOWN_REPORT_PATH = process.env.NODEVISION_SVG_PROPERTIES_LIFECYCLE_MD ||
  path.join(ROOT, "ApplicationSystem/tests/svgPropertiesPanelLifecycleBenchmark.report.md");
const CYCLES = String(process.env.NODEVISION_SVG_PROPERTIES_LIFECYCLE_CYCLES || "0,1,5,20,50")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0)
  .sort((a, b) => a - b);
const EXPECT_CURRENT_FIXED = process.env.NODEVISION_SVG_PROPERTIES_LIFECYCLE_EXPECT_FIXED === "1";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function writeBaselineModule() {
  const rel = "ApplicationSystem/public/PanelInstances/InfoPanels/SVGPropertiesPanel.mjs";
  const baseline = execFileSync("git", ["show", "HEAD:" + rel], { cwd: ROOT, encoding: "utf8" });
  fs.writeFileSync(PUBLIC_BASELINE_MODULE, baseline, "utf8");
}

function writeHarness() {
  fs.writeFileSync(PUBLIC_HARNESS, [
    "<!doctype html>",
    "<html>",
    "<head>",
    "  <meta charset=\"utf-8\">",
    "  <title>SVG Properties Lifecycle Benchmark</title>",
    "  <style>html,body{margin:0;width:100%;height:100%;font-family:Arial,sans-serif}#panel-root{width:360px;height:640px;overflow:auto;border:1px solid #ccc;margin:16px}</style>",
    "</head>",
    "<body><div id=\"panel-root\"></div><script type=\"module\">",
    "(() => {",
    "  const originalAdd = EventTarget.prototype.addEventListener;",
    "  const originalRemove = EventTarget.prototype.removeEventListener;",
    "  const OriginalMutationObserver = window.MutationObserver;",
    "  let listenerRecords = [];",
    "  let observerRecords = [];",
    "  let activeMetrics = null;",
    "  let callbackSeq = 0;",
    "  const now = () => performance.now();",
    "  const monitoredTypes = new Set(['nv-svg-editor-selection-changed', 'nv-svg-editor-selection-mutated', 'nv-svg-editor-context-ready', 'nv-kml-context-ready']);",
    "  const isMonitoredPropertiesListener = (target, type) => target === window && monitoredTypes.has(type);",
    "  const wrappedListeners = new WeakMap();",
    "  function resetInstrumentation() { listenerRecords = []; observerRecords = []; callbackSeq = 0; }",
    "  function targetLabel(target) {",
    "    if (target === window) return 'window';",
    "    if (target === document) return 'document';",
    "    if (target?.id) return '#' + target.id;",
    "    if (target?.dataset?.nvPanelTabId) return 'panel-tab-content';",
    "    return target?.constructor?.name || 'unknown';",
    "  }",
    "  EventTarget.prototype.addEventListener = function(type, listener, options) {",
    "    if (activeMetrics && typeof listener === 'function' && isMonitoredPropertiesListener(this, type)) {",
    "      const id = ++callbackSeq;",
    "      const record = { id, type, target: targetLabel(this), removed: false, calls: 0 };",
    "      listenerRecords.push(record);",
    "      activeMetrics.listenerRegistrations += 1;",
    "      activeMetrics.listenerTypes[type] = (activeMetrics.listenerTypes[type] || 0) + 1;",
    "      activeMetrics.listenerTargets[record.target] = (activeMetrics.listenerTargets[record.target] || 0) + 1;",
    "      const wrapped = function(event) {",
    "        record.calls += 1;",
    "        if (activeMetrics) {",
    "          activeMetrics.propertiesRefreshCallbacks += 1;",
    "          activeMetrics.callbackTypes[type] = (activeMetrics.callbackTypes[type] || 0) + 1;",
    "          activeMetrics.lastCallbackTarget = record.target;",
    "        }",
    "        return listener.call(this, event);",
    "      };",
    "      wrappedListeners.set(listener, wrapped);",
    "      const opts = options || {};",
    "      if (opts.signal && typeof opts.signal.addEventListener === 'function') {",
    "        opts.signal.addEventListener('abort', () => {",
    "          if (!record.removed) {",
    "            record.removed = true;",
    "            if (activeMetrics) activeMetrics.listenerRemovals += 1;",
    "          }",
    "        }, { once: true });",
    "      }",
    "      return originalAdd.call(this, type, wrapped, options);",
    "    }",
    "    return originalAdd.call(this, type, listener, options);",
    "  };",
    "  EventTarget.prototype.removeEventListener = function(type, listener, options) {",
    "    return originalRemove.call(this, type, wrappedListeners.get(listener) || listener, options);",
    "  };",
    "  window.MutationObserver = class InstrumentedMutationObserver extends OriginalMutationObserver {",
    "    constructor(callback) {",
    "      const record = { disconnected: false, observeCalls: 0 };",
    "      observerRecords.push(record);",
    "      if (activeMetrics) activeMetrics.mutationObserversCreated += 1;",
    "      super((records, observer) => callback(records, observer));",
    "      this.__record = record;",
    "    }",
    "    observe(...args) { this.__record.observeCalls += 1; return super.observe(...args); }",
    "    disconnect() {",
    "      if (!this.__record.disconnected) {",
    "        this.__record.disconnected = true;",
    "        if (activeMetrics) activeMetrics.mutationObserversDisconnected += 1;",
    "      }",
    "      return super.disconnect();",
    "    }",
    "  };",
    "  function freshMetrics(label, cycles) {",
    "    return { label, cycles, listenerRegistrations: 0, listenerRemovals: 0, listenerTypes: {}, listenerTargets: {}, callbackTypes: {}, propertiesRefreshCallbacks: 0, mutationObserversCreated: 0, mutationObserversDisconnected: 0, eventDurations: {}, eventCallbacks: {}, obsoletePanelCallbacks: 0, currentPanelCorrect: false, cleanupReturned: false, cleanupIdempotent: false, activeListeners: 0, activeMutationObservers: 0, retainedPanelInstances: 0, setupDurationMs: 0, removedPanelCallbacks: 0 };",
    "  }",
    "  function makeElement(id, attrs = {}) {",
    "    const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');",
    "    el.id = id;",
    "    Object.entries({ x: 10, y: 20, width: 30, height: 40, fill: '#80c0ff', stroke: '#000000', 'stroke-width': '1', ...attrs }).forEach(([k, v]) => el.setAttribute(k, String(v)));",
    "    return el;",
    "  }",
    "  function installContext(name, attrs = {}) {",
    "    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');",
    "    const selected = makeElement(name + '-rect', attrs);",
    "    svg.appendChild(selected);",
    "    document.body.appendChild(svg);",
    "    window.SVGEditorContext = {",
    "      svgRoot: svg,",
    "      getSelectedElements: () => [selected],",
    "      getSelectedElement: () => selected,",
    "      getCurrentStyleDefaults: () => ({ fill: '#80c0ff', stroke: '#000000', strokeWidth: '1' }),",
    "      getSelectedBounds: () => ({ x: Number(selected.getAttribute('x')), y: Number(selected.getAttribute('y')), width: Number(selected.getAttribute('width')), height: Number(selected.getAttribute('height')) }),",
    "      setSelectedBounds: (bounds = {}) => { Object.entries(bounds).forEach(([k, v]) => selected.setAttribute(k, String(v))); return true; },",
    "      setFillColor: (value) => selected.setAttribute('fill', String(value)),",
    "      setStrokeColor: (value) => selected.setAttribute('stroke', String(value)),",
    "      setStrokeWidth: (value) => selected.setAttribute('stroke-width', String(value)),",
    "      notifyElementChanged: (reason = 'properties') => window.dispatchEvent(new CustomEvent('nv-svg-editor-selection-mutated', { detail: { reason } })),",
    "      recordSvgSnapshot: (_label, operation) => operation?.(),",
    "    };",
    "    return { svg, selected };",
    "  }",
    "  function panelSummary(panel) { return panel.textContent || ''; }",
    "  async function frame() { await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); }",
    "  async function dispatchMeasured(type, detail = {}) {",
    "    const before = activeMetrics.propertiesRefreshCallbacks;",
    "    const start = now();",
    "    window.dispatchEvent(new CustomEvent(type, { detail }));",
    "    await frame();",
    "    activeMetrics.eventDurations[type + ':' + (detail.reason || 'selection')] = now() - start;",
    "    activeMetrics.eventCallbacks[type + ':' + (detail.reason || 'selection')] = activeMetrics.propertiesRefreshCallbacks - before;",
    "  }",
    "  async function runCheckpoint({ modulePath, label, cycles }) {",
    "    resetInstrumentation();",
    "    let root = document.getElementById('panel-root');",
    "    if (!root) { root = document.createElement('div'); root.id = 'panel-root'; document.body.appendChild(root); }",
    "    root.replaceChildren();",
    "    delete window.SVGEditorContext;",
    "    const module = await import(modulePath + '?v=' + encodeURIComponent(label + '-' + cycles + '-' + Date.now() + '-' + Math.random()));",
    "    activeMetrics = freshMetrics(label, cycles);",
    "    const ctxA = installContext('A', { fill: '#112233', stroke: '#445566' });",
    "    let cleanup = null;",
    "    const setupStart = now();",
    "    for (let index = 0; index < cycles; index += 1) cleanup = await module.setupPanel(root, {});",
    "    activeMetrics.setupDurationMs = now() - setupStart;",
    "    activeMetrics.cleanupReturned = typeof cleanup === 'function';",
    "    await frame();",
    "    if (cycles > 0) {",
    "      await dispatchMeasured('nv-svg-editor-selection-changed', { reason: 'selection', selectedElements: [ctxA.selected], primary: ctxA.selected });",
    "      await dispatchMeasured('nv-svg-editor-selection-mutated', { reason: 'geometry', selectedElements: [ctxA.selected], primary: ctxA.selected });",
    "      ctxA.selected.setAttribute('fill', '#abcdef');",
    "      await dispatchMeasured('nv-svg-editor-selection-mutated', { reason: 'style', selectedElements: [ctxA.selected], primary: ctxA.selected });",
    "      activeMetrics.currentPanelCorrect = panelSummary(root).includes('A-rect');",
    "    } else {",
    "      await dispatchMeasured('nv-svg-editor-selection-changed', { reason: 'selection' });",
    "    }",
    "    const callbacksBeforeSwitch = activeMetrics.propertiesRefreshCallbacks;",
    "    const ctxB = installContext('B', { fill: '#778899', stroke: '#101010' });",
    "    if (cycles > 0) cleanup = await module.setupPanel(root, {});",
    "    await frame();",
    "    window.dispatchEvent(new CustomEvent('nv-svg-editor-selection-mutated', { detail: { reason: 'geometry', selectedElements: [ctxA.selected], primary: ctxA.selected } }));",
    "    await frame();",
    "    activeMetrics.obsoletePanelCallbacks = Math.max(0, activeMetrics.propertiesRefreshCallbacks - callbacksBeforeSwitch - (cycles > 0 ? 1 : 0));",
    "    activeMetrics.currentPanelCorrect = cycles === 0 ? activeMetrics.currentPanelCorrect : panelSummary(root).includes('B-rect');",
    "    const beforeCleanupCallbacks = activeMetrics.propertiesRefreshCallbacks;",
    "    if (typeof cleanup === 'function') { cleanup(); cleanup(); activeMetrics.cleanupIdempotent = true; }",
    "    root.remove();",
    "    await frame();",
    "    window.dispatchEvent(new CustomEvent('nv-svg-editor-selection-mutated', { detail: { reason: 'geometry', selectedElements: [ctxB.selected], primary: ctxB.selected } }));",
    "    await frame();",
    "    activeMetrics.removedPanelCallbacks = activeMetrics.propertiesRefreshCallbacks - beforeCleanupCallbacks;",
    "    activeMetrics.activeListeners = listenerRecords.filter((r) => !r.removed).length;",
    "    activeMetrics.activeMutationObservers = observerRecords.filter((r) => !r.disconnected).length;",
    "    activeMetrics.retainedPanelInstances = document.querySelectorAll('#panel-root').length;",
    "    ctxA.svg.remove(); ctxB.svg.remove();",
    "    const result = activeMetrics;",
    "    activeMetrics = null;",
    "    return result;",
    "  }",
    "  window.__nvSvgPropertiesLifecycleBenchmark = { runCheckpoint };",
    "})();",
    "</script></body></html>",
  ].join("\n"), "utf8");
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
  const win = new BrowserWindow({ show: true, width: 900, height: 760, webPreferences: { contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  win.webContents.on("console-message", (_event, _level, message) => { if (/SVG Properties|Error|Failed/i.test(String(message || ""))) console.log("[renderer]", message); });
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
  writeBaselineModule();
  writeHarness();
  await win.loadURL(runtimeUrl + "/__svg-properties-lifecycle-benchmark-harness.html");
  await win.webContents.executeJavaScript(`fetch("/api/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "admin" }) }).then(r => r.json()).catch(() => ({}))`, true);
  await win.loadURL(runtimeUrl + "/__svg-properties-lifecycle-benchmark-harness.html");
  await waitFor(win, "document.readyState === 'complete' && window.__nvSvgPropertiesLifecycleBenchmark");
}

async function runSuite(win, label, modulePath) {
  const checkpoints = [];
  for (const cycles of CYCLES) {
    checkpoints.push(await win.webContents.executeJavaScript(`window.__nvSvgPropertiesLifecycleBenchmark.runCheckpoint(${JSON.stringify({ label, modulePath, cycles })})`, true));
  }
  return { label, modulePath, checkpoints };
}

function makeMarkdownReport(report) {
  const lines = [
    "# SVG Properties Panel Lifecycle Benchmark", "", `Generated: ${report.generatedAt}`, "", "## Environment", "",
    `- Electron: ${report.environment.electron}`, `- Chrome: ${report.environment.chrome}`, `- Node: ${report.environment.node}`,
    `- Platform: ${report.environment.platform} ${report.environment.release} ${report.environment.arch}`, "", "## Results", "",
    "| Variant | Cycles | Listener registrations | Listener removals | Active listeners | Observers created | Observers disconnected | Active observers | Selection callbacks | Geometry callbacks | Style callbacks | Removed callbacks | Correct active panel | Cleanup returned | Setup ms |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: |",
  ];
  for (const suite of report.suites) {
    for (const row of suite.checkpoints) {
      lines.push([`| ${suite.label}`, row.cycles, row.listenerRegistrations, row.listenerRemovals, row.activeListeners, row.mutationObserversCreated, row.mutationObserversDisconnected, row.activeMutationObservers, row.eventCallbacks?.["nv-svg-editor-selection-changed:selection"] || 0, row.eventCallbacks?.["nv-svg-editor-selection-mutated:geometry"] || 0, row.eventCallbacks?.["nv-svg-editor-selection-mutated:style"] || 0, row.removedPanelCallbacks || 0, row.currentPanelCorrect ? "yes" : "no", row.cleanupReturned ? "yes" : "no", `${round(row.setupDurationMs)} |`].join(" | "));
    }
  }
  return lines.join("\n");
}

function assertFixed(report) {
  if (!EXPECT_CURRENT_FIXED) return;
  const current = report.suites.find((suite) => suite.label === "current");
  if (!current) throw new Error("Missing current suite");
  for (const row of current.checkpoints) {
    if (row.cycles === 0) continue;
    const selection = row.eventCallbacks?.["nv-svg-editor-selection-changed:selection"] || 0;
    const geometry = row.eventCallbacks?.["nv-svg-editor-selection-mutated:geometry"] || 0;
    const style = row.eventCallbacks?.["nv-svg-editor-selection-mutated:style"] || 0;
    if (selection !== 1 || geometry !== 1 || style !== 1) throw new Error(`Expected one refresh per representative event after ${row.cycles} cycles, saw selection=${selection} geometry=${geometry} style=${style}`);
    if (row.activeListeners !== 0) throw new Error(`Expected zero active listeners after cleanup at ${row.cycles} cycles, saw ${row.activeListeners}`);
    if (row.activeMutationObservers !== 0) throw new Error(`Expected zero active observers after cleanup at ${row.cycles} cycles, saw ${row.activeMutationObservers}`);
    if (row.removedPanelCallbacks !== 0) throw new Error(`Removed panel responded after ${row.cycles} cycles`);
    if (!row.currentPanelCorrect) throw new Error(`Active panel was stale after ${row.cycles} cycles`);
    if (!row.cleanupReturned || !row.cleanupIdempotent) throw new Error(`Cleanup was not returned/idempotent after ${row.cycles} cycles`);
  }
}

async function runBenchmark() {
  app.on("window-all-closed", (event) => event.preventDefault());
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-dev-shm-usage");
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  await app.whenReady();
  const { runtimeController, runtime } = await createRuntime();
  const win = createWindow();
  let suites = [];
  try {
    await prepareWindow(win, runtime.url);
    suites = [
      await runSuite(win, "baseline", "/__svg-properties-panel-baseline.mjs"),
      await runSuite(win, "current", "/PanelInstances/InfoPanels/SVGPropertiesPanel.mjs"),
    ];
  } finally {
    try { win.close(); } catch {}
    await runtimeController.stop().catch(() => {});
  }
  const report = {
    generatedAt: new Date().toISOString(),
    note: "Synthetic benchmark. Baseline uses git HEAD version of SVGPropertiesPanel.mjs copied to a temporary public module; current uses the working-tree module.",
    configuration: { cycles: CYCLES, expectFixed: EXPECT_CURRENT_FIXED },
    environment: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, v8: process.versions.v8, platform: os.platform(), release: os.release(), arch: os.arch(), cpus: os.cpus().length, totalMemoryBytes: os.totalmem() },
    suites,
  };
  assertFixed(report);
  fs.writeFileSync(JSON_REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(MARKDOWN_REPORT_PATH, makeMarkdownReport(report), "utf8");
  return report;
}

runBenchmark()
  .then((report) => {
    console.log(JSON.stringify({ jsonReportPath: JSON_REPORT_PATH, markdownReportPath: MARKDOWN_REPORT_PATH, suites: report.suites.map((suite) => ({ label: suite.label, checkpoints: suite.checkpoints.map((row) => ({ cycles: row.cycles, registrations: row.listenerRegistrations, removals: row.listenerRemovals, activeListeners: row.activeListeners, selectionCallbacks: row.eventCallbacks?.["nv-svg-editor-selection-changed:selection"] || 0, geometryCallbacks: row.eventCallbacks?.["nv-svg-editor-selection-mutated:geometry"] || 0, styleCallbacks: row.eventCallbacks?.["nv-svg-editor-selection-mutated:style"] || 0, activeMutationObservers: row.activeMutationObservers, cleanupReturned: row.cleanupReturned, currentPanelCorrect: row.currentPanelCorrect })) })) }, null, 2));
  })
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => {
    try { fs.rmSync(PUBLIC_HARNESS, { force: true }); } catch {}
    try { fs.rmSync(PUBLIC_BASELINE_MODULE, { force: true }); } catch {}
    try { app.quit(); } catch {}
  });
