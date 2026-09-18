// Nodevision/ApplicationSystem/tests/svgSelectionGeometryBenchmark.electron.cjs
// Synthetic Electron benchmark for SVG selection geometry refresh during drag.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

const ROOT = process.cwd();
const PORT = Number(process.env.NODEVISION_SVG_SELECTION_GEOMETRY_PORT || 39484);
const FIXTURE_ROOT = path.join(ROOT, "Notebook", "__nv_svg_selection_geometry_benchmark");
const PUBLIC_HARNESS = path.join(ROOT, "ApplicationSystem/public/__svg-selection-geometry-benchmark-harness.html");
const JSON_REPORT_PATH = process.env.NODEVISION_SVG_SELECTION_GEOMETRY_REPORT ||
  path.join(ROOT, "ApplicationSystem/tests/svgSelectionGeometryBenchmark.report.json");
const MARKDOWN_REPORT_PATH = process.env.NODEVISION_SVG_SELECTION_GEOMETRY_MD ||
  path.join(ROOT, "ApplicationSystem/tests/svgSelectionGeometryBenchmark.report.md");
const WARMUPS = Math.max(0, Number(process.env.NODEVISION_SVG_SELECTION_GEOMETRY_WARMUPS || 1));
const REPETITIONS = Math.max(1, Number(process.env.NODEVISION_SVG_SELECTION_GEOMETRY_REPETITIONS || 3));
const POINTER_UPDATES = Math.max(1, Number(process.env.NODEVISION_SVG_SELECTION_GEOMETRY_POINTER_UPDATES || 60));
const DRAG_CLIENT_DELTA = {
  x: Number(process.env.NODEVISION_SVG_SELECTION_GEOMETRY_DX || 120),
  y: Number(process.env.NODEVISION_SVG_SELECTION_GEOMETRY_DY || 72),
};
const EXPECT_OPTIMIZED = process.env.NODEVISION_SVG_SELECTION_GEOMETRY_EXPECT_OPTIMIZED === "1";
const OBJECT_COUNTS = [0, 1, 10, 100, 1000];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function percentile(sortedValues, ratio) {
  if (!sortedValues.length) return 0;
  return sortedValues[Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * ratio))];
}

function stats(values, digits = 2) {
  const clean = values.map(Number).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const mean = clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
  const variance = clean.length > 1
    ? clean.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (clean.length - 1)
    : 0;
  return {
    count: clean.length,
    mean: round(mean, digits),
    median: round(percentile(clean, 0.5), digits),
    p95: round(percentile(clean, 0.95), digits),
    max: round(clean[clean.length - 1] || 0, digits),
    stdev: round(Math.sqrt(variance), digits),
  };
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function makeSvg(count) {
  const rows = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count))));
  const rects = [];
  for (let index = 0; index < count; index += 1) {
    const col = index % rows;
    const row = Math.floor(index / rows);
    const x = 40 + col * 34;
    const y = 40 + row * 26;
    rects.push(
      `<rect id="bench-rect-${index}" x="${x}" y="${y}" width="20" height="14" fill="#80c0ff" stroke="#1f2937" stroke-width="1"/>`
    );
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="820" viewBox="0 0 1200 820">`,
    `<title>SVG selection geometry benchmark ${count}</title>`,
    rects.join("\n"),
    `</svg>`,
  ].join("\n");
}

function buildFixtures() {
  fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
  return OBJECT_COUNTS.map((count) => {
    const id = count === 0 ? "empty" : `${count}-objects`;
    const fileName = `${id}.svg`;
    const relativePath = `__nv_svg_selection_geometry_benchmark/${fileName}`;
    const absPath = path.join(FIXTURE_ROOT, fileName);
    fs.writeFileSync(absPath, makeSvg(count), "utf8");
    return {
      id,
      objectCount: count,
      relativePath,
      absPath,
      label: count === 0 ? "Empty SVG control" : `${count} rectangle object${count === 1 ? "" : "s"}`,
    };
  });
}

function writeHarness() {
  fs.writeFileSync(PUBLIC_HARNESS, [
    "<!doctype html>",
    "<html>",
    "<head>",
    "  <meta charset=\"utf-8\">",
    "  <title>SVG Selection Geometry Benchmark</title>",
    "  <link rel=\"stylesheet\" href=\"/Stylesheets/GraphStyles.css\">",
    "  <style>",
    "    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }",
    "    #harness { width: 1280px; height: 880px; }",
    "    #editor-host { width: 100%; height: 100%; }",
    "    #properties-host { position: fixed; right: 0; top: 0; width: 320px; height: 480px; overflow: auto; opacity: 0; pointer-events: none; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <div id=\"harness\"><div id=\"editor-host\"></div><div id=\"properties-host\"></div></div>",
    "  <script type=\"module\">",
    "    import { renderEditor } from '/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntime.mjs';",
    "    import { setupPanel as setupSvgPropertiesPanel } from '/PanelInstances/InfoPanels/SVGPropertiesPanel.mjs';",
    "",
    "    const originalAddEventListener = EventTarget.prototype.addEventListener;",
    "    const originalDispatchEvent = EventTarget.prototype.dispatchEvent;",
    "    const originalQuerySelectorAll = Element.prototype.querySelectorAll;",
    "    const originalSetAttribute = Element.prototype.setAttribute;",
    "    const originalRemoveAttribute = Element.prototype.removeAttribute;",
    "    const originalGetBBox = SVGGraphicsElement.prototype.getBBox;",
    "",
    "    const now = () => performance.now();",
    "    const state = { installed: false, active: false, selectedId: '', metrics: null };",
    "    const freshMetrics = () => ({",
    "      activeMs: 0,",
    "      pointerUpdateDurations: [],",
    "      pointerMoveListenerCalls: 0,",
    "      getSelectableElementsCalls: 0,",
    "      querySelectorAllStar: 0,",
    "      selectionRefreshQuerySelectorAllStar: 0,",
    "      selectionBoundsCalculations: 0,",
    "      selectionVisualizationGetBBoxCalls: 0,",
    "      refreshSelectionVisualsGetBBoxCalls: 0,",
    "      refreshTransformHandlesGetBBoxCalls: 0,",
    "      transformHandleRefreshes: 0,",
    "      transformHandleAttributeWrites: 0,",
    "      transformHandleHideWrites: 0,",
    "      selectionMutatedDispatches: 0,",
    "      selectionChangedDispatches: 0,",
    "      dataSelectedWrites: 0,",
    "      unrelatedDataSelectedWrites: 0,",
    "      layersRefreshes: 0,",
    "      propertiesPanelRefreshes: 0,",
    "      propertiesPanelRefreshMs: 0,",
    "      mutationObserverCallbacks: 0,",
    "      childListMutationRecords: 0",
    "    });",
    "",
    "    function stackIncludes(...needles) {",
    "      const stack = String(new Error().stack || '');",
    "      return needles.some((needle) => stack.includes(needle));",
    "    }",
    "",
    "    function current() { return state.active && state.metrics ? state.metrics : null; }",
    "",
    "    function installInstrumentation() {",
    "      if (state.installed) return;",
    "      state.installed = true;",
    "",
    "      EventTarget.prototype.addEventListener = function(type, listener, options) {",
    "        if (type === 'pointermove' && typeof listener === 'function') {",
    "          const wrapped = function(event) {",
    "            const metrics = current();",
    "            if (!metrics) return listener.call(this, event);",
    "            const start = now();",
    "            try {",
    "              return listener.call(this, event);",
    "            } finally {",
    "              const duration = now() - start;",
    "              metrics.pointerMoveListenerCalls += 1;",
    "              metrics.pointerUpdateDurations.push(duration);",
    "            }",
    "          };",
    "          return originalAddEventListener.call(this, type, wrapped, options);",
    "        }",
    "",
    "        if (type === 'nv-svg-editor-selection-mutated' && typeof listener === 'function') {",
    "          const stack = String(new Error().stack || '');",
    "          const isPropertiesPanel = stack.includes('SVGPropertiesPanel') || stack.includes('setupPanel');",
    "          if (isPropertiesPanel) {",
    "            const wrapped = function(event) {",
    "              const metrics = current();",
    "              if (!metrics) return listener.call(this, event);",
    "              const start = now();",
    "              try {",
    "                return listener.call(this, event);",
    "              } finally {",
    "                metrics.propertiesPanelRefreshes += 1;",
    "                metrics.propertiesPanelRefreshMs += now() - start;",
    "              }",
    "            };",
    "            return originalAddEventListener.call(this, type, wrapped, options);",
    "          }",
    "        }",
    "",
    "        if (type === 'nv-svg-editor-selection-changed' && typeof listener === 'function') {",
    "          const stack = String(new Error().stack || '');",
    "          const isLayerPanel = stack.includes('ElementLayers/panel') || stack.includes('renderLayersPanel');",
    "          if (isLayerPanel) {",
    "            const wrapped = function(event) {",
    "              const metrics = current();",
    "              if (metrics) metrics.layersRefreshes += 1;",
    "              return listener.call(this, event);",
    "            };",
    "            return originalAddEventListener.call(this, type, wrapped, options);",
    "          }",
    "        }",
    "",
    "        return originalAddEventListener.call(this, type, listener, options);",
    "      };",
    "",
    "      EventTarget.prototype.dispatchEvent = function(event) {",
    "        const metrics = current();",
    "        if (metrics && event?.type === 'nv-svg-editor-selection-mutated') metrics.selectionMutatedDispatches += 1;",
    "        if (metrics && event?.type === 'nv-svg-editor-selection-changed') metrics.selectionChangedDispatches += 1;",
    "        return originalDispatchEvent.call(this, event);",
    "      };",
    "",
    "      Element.prototype.querySelectorAll = function(selector) {",
    "        const metrics = current();",
    "        if (metrics && selector === '*') {",
    "          metrics.querySelectorAllStar += 1;",
    "          if (stackIncludes('getSelectableElements')) {",
    "            metrics.getSelectableElementsCalls += 1;",
    "            metrics.selectionRefreshQuerySelectorAllStar += 1;",
    "          }",
    "        }",
    "        return originalQuerySelectorAll.call(this, selector);",
    "      };",
    "",
    "      Element.prototype.setAttribute = function(name, value) {",
    "        const metrics = current();",
    "        if (metrics) {",
    "          const attr = String(name || '');",
    "          if (attr === 'data-selected') {",
    "            metrics.dataSelectedWrites += 1;",
    "            if (this.id !== state.selectedId) metrics.unrelatedDataSelectedWrites += 1;",
    "          }",
    "          if (this.getAttribute?.('data-nv-editor-ui') === 'handle' && stackIncludes('refreshTransformHandles', 'hideTransformHandles', 'updateResizeHandles', 'updateLineEndpointHandles')) {",
    "            metrics.transformHandleAttributeWrites += 1;",
    "            if (attr === 'display' && String(value) === 'none' && stackIncludes('hideTransformHandles')) {",
    "              metrics.transformHandleHideWrites += 1;",
    "            }",
    "          }",
    "        }",
    "        return originalSetAttribute.call(this, name, value);",
    "      };",
    "",
    "      Element.prototype.removeAttribute = function(name) {",
    "        const metrics = current();",
    "        if (metrics && String(name || '') === 'data-selected') {",
    "          metrics.dataSelectedWrites += 1;",
    "          if (this.id !== state.selectedId) metrics.unrelatedDataSelectedWrites += 1;",
    "        }",
    "        return originalRemoveAttribute.call(this, name);",
    "      };",
    "",
    "      SVGGraphicsElement.prototype.getBBox = function(...args) {",
    "        const metrics = current();",
    "        if (metrics && stackIncludes('getSelectedUnionBBox')) {",
    "          metrics.selectionBoundsCalculations += 1;",
    "          metrics.selectionVisualizationGetBBoxCalls += 1;",
    "          if (stackIncludes('refreshSelectionVisuals')) metrics.refreshSelectionVisualsGetBBoxCalls += 1;",
    "          if (stackIncludes('refreshTransformHandles')) metrics.refreshTransformHandlesGetBBoxCalls += 1;",
    "        }",
    "        return originalGetBBox.apply(this, args);",
    "      };",
    "    }",
    "",
    "    function summarizeMetrics() {",
    "      const metrics = { ...(state.metrics || freshMetrics()) };",
    "      metrics.transformHandleRefreshes = Math.round((metrics.transformHandleHideWrites || 0) / 6);",
    "      return metrics;",
    "    }",
    "",
    "    window.__nvSvgSelectionGeometryBenchmark = {",
    "      async mount({ filePath, mountPropertiesPanel = true } = {}) {",
    "        installInstrumentation();",
    "        state.active = false;",
    "        state.metrics = freshMetrics();",
    "        state.selectedId = 'bench-rect-0';",
    "        const host = document.getElementById('editor-host');",
    "        host.innerHTML = '';",
    "        const propertiesHost = document.getElementById('properties-host');",
    "        propertiesHost.innerHTML = '';",
    "        await renderEditor(filePath, host);",
    "        if (mountPropertiesPanel) await setupSvgPropertiesPanel(propertiesHost, {});",
    "        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));",
    "        const ctx = window.SVGEditorContext;",
    "        const rect = ctx?.svgRoot?.querySelector('#bench-rect-0') || null;",
    "        if (rect) {",
    "          ctx.setMode?.('select');",
    "          ctx.setSelection?.([rect], { primary: rect });",
    "        }",
    "        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));",
    "        return this.geometry();",
    "      },",
    "      reset() {",
    "        state.metrics = freshMetrics();",
    "      },",
    "      start() {",
    "        state.metrics = freshMetrics();",
    "        state.metrics.startedAt = now();",
    "        state.active = true;",
    "      },",
    "      async stop() {",
    "        const metrics = state.metrics || freshMetrics();",
    "        metrics.activeMs = now() - (metrics.startedAt || now());",
    "        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));",
    "        state.active = false;",
    "        return summarizeMetrics();",
    "      },",
    "      geometry() {",
    "        const ctx = window.SVGEditorContext;",
    "        const rect = ctx?.svgRoot?.querySelector('#bench-rect-0') || null;",
    "        const selected = Array.from(ctx?.svgRoot?.querySelectorAll('[data-selected=\"true\"]') || []).map((el) => el.id);",
    "        const unrelatedSelected = selected.filter((id) => id !== 'bench-rect-0');",
    "        const selectionBox = ctx?.svgRoot?.querySelector('[data-nv-editor-ui=\"selection-box\"]');",
    "        const handles = Array.from(ctx?.svgRoot?.querySelectorAll('[data-nv-editor-ui=\"handle\"]') || [])",
    "          .map((el) => ({",
    "            tag: el.tagName,",
    "            display: el.getAttribute('display') || '',",
    "            x: el.getAttribute('x'),",
    "            y: el.getAttribute('y'),",
    "            cx: el.getAttribute('cx'),",
    "            cy: el.getAttribute('cy')",
    "          }));",
    "        if (!rect) return { hasRect: false, selected, unrelatedSelected, handles };",
    "        const bbox = rect.getBBox();",
    "        return {",
    "          hasRect: true,",
    "          id: rect.id,",
    "          x: Number(rect.getAttribute('x') || 0),",
    "          y: Number(rect.getAttribute('y') || 0),",
    "          transform: rect.getAttribute('transform') || '',",
    "          bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height },",
    "          selected,",
    "          unrelatedSelected,",
    "          dataSelected: rect.getAttribute('data-selected') || '',",
    "          selectionBox: selectionBox ? {",
    "            display: selectionBox.getAttribute('display') || '',",
    "            x: Number(selectionBox.getAttribute('x') || 0),",
    "            y: Number(selectionBox.getAttribute('y') || 0),",
    "            width: Number(selectionBox.getAttribute('width') || 0),",
    "            height: Number(selectionBox.getAttribute('height') || 0)",
    "          } : null,",
    "          handles",
    "        };",
    "      },",
    "      pointForSelectedRect() {",
    "        const ctx = window.SVGEditorContext;",
    "        const rect = ctx?.svgRoot?.querySelector('#bench-rect-0') || null;",
    "        if (!rect) return null;",
    "        const box = rect.getBoundingClientRect();",
    "        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };",
    "      },",
    "      async dispatchSyntheticDrag({ updates = 60, dx = 120, dy = 72 } = {}) {",
    "        const ctx = window.SVGEditorContext;",
    "        const svgRoot = ctx?.svgRoot || null;",
    "        const rect = svgRoot?.querySelector('#bench-rect-0') || null;",
    "        if (!svgRoot || !rect) throw new Error('Missing SVG root or selected rectangle');",
    "        const start = this.pointForSelectedRect();",
    "        if (!start) throw new Error('Missing drag start point');",
    "        const pointerId = 701;",
    "        const makeEvent = (type, x, y, extra = {}) => new PointerEvent(type, {",
    "          bubbles: true,",
    "          cancelable: true,",
    "          composed: true,",
    "          pointerId,",
    "          pointerType: 'mouse',",
    "          isPrimary: true,",
    "          clientX: x,",
    "          clientY: y,",
    "          screenX: x,",
    "          screenY: y,",
    "          button: 0,",
    "          buttons: type === 'pointerup' ? 0 : 1,",
    "          ...extra",
    "        });",
    "        rect.dispatchEvent(makeEvent('pointerdown', start.x, start.y, { button: 0, buttons: 1 }));",
    "        this.start();",
    "        for (let index = 1; index <= updates; index += 1) {",
    "          const x = start.x + (dx * index) / updates;",
    "          const y = start.y + (dy * index) / updates;",
    "          svgRoot.dispatchEvent(makeEvent('pointermove', x, y, { button: -1, buttons: 1 }));",
    "        }",
    "        svgRoot.dispatchEvent(makeEvent('pointerup', start.x + dx, start.y + dy, { button: 0, buttons: 0 }));",
    "        return await this.stop();",
    "      },",
    "      metrics() { return summarizeMetrics(); }",
    "    };",
    "  </script>",
    "</body>",
    "</html>",
  ].join("\n"), "utf8");
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

async function createRuntime() {
  process.env.NODEVISION_ROOT = ROOT;
  process.env.NODEVISION_PHP_ENABLED = "0";
  process.env.NODEVISION_PERF_DIAGNOSTICS = "0";
  const runtimeMod = await import(pathToFileURL(path.join(ROOT, "ApplicationSystem/core/runtime.js")).href);
  const runtimeController = runtimeMod.createRuntime({
    runtimeRoot: ROOT,
    host: "127.0.0.1",
    port: PORT,
    portFallback: true,
    phpEnabled: false,
    mqttCsvLoggersEnabled: false,
  });
  return { runtimeController, runtime: await runtimeController.start() };
}

function createWindow() {
  const win = new BrowserWindow({
    show: true,
    width: 1320,
    height: 960,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  win.webContents.on("console-message", (_event, _level, message) => {
    if (/SVG selection geometry|Failed|Error|SVG editor/i.test(String(message || ""))) {
      console.log("[renderer]", message);
    }
  });
  return win;
}

async function prepareWindow(win, runtimeUrl) {
  writeHarness();
  await win.loadURL(runtimeUrl + "/__svg-selection-geometry-benchmark-harness.html");
  await win.webContents.executeJavaScript(
    `fetch("/api/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "admin" }) }).then(r => r.json()).catch(() => ({}))`,
    true
  );
  await win.loadURL(runtimeUrl + "/__svg-selection-geometry-benchmark-harness.html");
  await waitFor(win, "document.readyState === 'complete' && window.__nvSvgSelectionGeometryBenchmark");
}

async function mountFixture(win, fixture) {
  return await win.webContents.executeJavaScript(
    `window.__nvSvgSelectionGeometryBenchmark.mount(${JSON.stringify({ filePath: fixture.relativePath, mountPropertiesPanel: true })})`,
    true
  );
}

async function sendDrag(win, updates = POINTER_UPDATES, delta = DRAG_CLIENT_DELTA) {
  return await win.webContents.executeJavaScript(
    `window.__nvSvgSelectionGeometryBenchmark.dispatchSyntheticDrag(${JSON.stringify({ updates, dx: delta.x, dy: delta.y })})`,
    true
  );
}

async function runPass(win, fixture, kind, repetition) {
  const before = await mountFixture(win, fixture);
  if (!before.hasRect) {
    return {
      fixtureId: fixture.id,
      objectCount: fixture.objectCount,
      kind,
      repetition,
      skipped: true,
      reason: "empty SVG control",
      before,
      after: before,
      metrics: {},
    };
  }
  const metrics = await sendDrag(win);
  const after = await win.webContents.executeJavaScript("window.__nvSvgSelectionGeometryBenchmark.geometry()", true);
  const moved = Math.abs((after.x || 0) - (before.x || 0)) > 0.01 || Math.abs((after.y || 0) - (before.y || 0)) > 0.01 || after.transform !== before.transform;
  if (!moved) throw new Error(`${fixture.id} did not move during drag`);
  if (after.dataSelected !== "true") throw new Error(`${fixture.id} lost data-selected on the selected rectangle`);
  if (after.unrelatedSelected?.length) throw new Error(`${fixture.id} left unrelated elements selected: ${after.unrelatedSelected.join(", ")}`);
  if (EXPECT_OPTIMIZED && metrics.getSelectableElementsCalls !== 0) {
    throw new Error(`${fixture.id} optimized run expected zero getSelectableElements calls, saw ${metrics.getSelectableElementsCalls}`);
  }
  if (EXPECT_OPTIMIZED && metrics.unrelatedDataSelectedWrites !== 0) {
    throw new Error(`${fixture.id} optimized run expected zero unrelated data-selected writes, saw ${metrics.unrelatedDataSelectedWrites}`);
  }
  return {
    fixtureId: fixture.id,
    objectCount: fixture.objectCount,
    kind,
    repetition,
    skipped: false,
    before,
    after,
    metrics,
    finalObjectPosition: {
      x: after.x,
      y: after.y,
      transform: after.transform,
    },
  };
}

function aggregatePasses(passes) {
  return OBJECT_COUNTS.map((objectCount) => {
    const measured = passes.filter((pass) => !pass.skipped && pass.objectCount === objectCount && pass.kind === "measured");
    const skipped = passes.find((pass) => pass.skipped && pass.objectCount === objectCount);
    if (!measured.length) {
      return {
        objectCount,
        fixtureId: skipped?.fixtureId || `${objectCount}-objects`,
        skipped: true,
        reason: skipped?.reason || "no measured passes",
      };
    }
    const totals = measured.map((pass) => pass.metrics.activeMs);
    const allPointerDurations = measured.flatMap((pass) => pass.metrics.pointerUpdateDurations || []);
    const sum = (key) => measured.reduce((total, pass) => total + Number(pass.metrics[key] || 0), 0);
    const avg = (key) => round(sum(key) / measured.length, 2);
    return {
      objectCount,
      fixtureId: measured[0].fixtureId,
      skipped: false,
      repetitions: measured.length,
      totalDragMs: stats(totals),
      pointerUpdateMs: stats(allPointerDurations),
      avgGetSelectableElementsCalls: avg("getSelectableElementsCalls"),
      avgSelectionRefreshQuerySelectorAllStar: avg("selectionRefreshQuerySelectorAllStar"),
      avgSelectionBoundsCalculations: avg("selectionBoundsCalculations"),
      avgSelectionVisualizationGetBBoxCalls: avg("selectionVisualizationGetBBoxCalls"),
      avgRefreshSelectionVisualsGetBBoxCalls: avg("refreshSelectionVisualsGetBBoxCalls"),
      avgRefreshTransformHandlesGetBBoxCalls: avg("refreshTransformHandlesGetBBoxCalls"),
      avgTransformHandleRefreshes: avg("transformHandleRefreshes"),
      avgSelectionMutatedDispatches: avg("selectionMutatedDispatches"),
      avgSelectionChangedDispatches: avg("selectionChangedDispatches"),
      avgDataSelectedWrites: avg("dataSelectedWrites"),
      avgUnrelatedDataSelectedWrites: avg("unrelatedDataSelectedWrites"),
      avgLayersRefreshes: avg("layersRefreshes"),
      avgPropertiesPanelRefreshes: avg("propertiesPanelRefreshes"),
      avgPropertiesPanelRefreshMs: avg("propertiesPanelRefreshMs"),
      finalObjectPosition: measured[measured.length - 1].finalObjectPosition,
    };
  });
}

function makeMarkdownReport(report) {
  const lines = [
    "# SVG Selection Geometry Benchmark",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Command",
    "",
    "```sh",
    report.command,
    "```",
    "",
    "## Configuration",
    "",
    `- Warmups: ${report.configuration.warmups}`,
    `- Measured repetitions: ${report.configuration.repetitions}`,
    `- Pointer updates per drag: ${report.configuration.pointerUpdates}`,
    `- Drag client delta: ${report.configuration.dragClientDelta.x}, ${report.configuration.dragClientDelta.y}`,
    `- Expect optimized assertions: ${report.configuration.expectOptimized ? "yes" : "no"}`,
    "",
    "## Environment",
    "",
    `- Electron: ${report.environment.electron}`,
    `- Chrome: ${report.environment.chrome}`,
    `- Node: ${report.environment.node}`,
    `- Platform: ${report.environment.platform} ${report.environment.release} ${report.environment.arch}`,
    "",
    "## Aggregate Results",
    "",
    "| Objects | Total ms median | Pointer ms median | Pointer ms p95 | getSelectableElements | qSA(*) selection | Bounds calcs | getBBox visual | Handle refreshes | Mutated events | Unrelated data-selected writes | Properties refreshes | Final position |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const row of report.aggregates) {
    if (row.skipped) {
      lines.push(`| ${row.objectCount} | skipped | skipped | skipped | skipped | skipped | skipped | skipped | skipped | skipped | skipped | skipped | ${row.reason} |`);
      continue;
    }
    const pos = row.finalObjectPosition || {};
    lines.push([
      `| ${row.objectCount}`,
      row.totalDragMs.median,
      row.pointerUpdateMs.median,
      row.pointerUpdateMs.p95,
      row.avgGetSelectableElementsCalls,
      row.avgSelectionRefreshQuerySelectorAllStar,
      row.avgSelectionBoundsCalculations,
      row.avgSelectionVisualizationGetBBoxCalls,
      row.avgTransformHandleRefreshes,
      row.avgSelectionMutatedDispatches,
      row.avgUnrelatedDataSelectedWrites,
      row.avgPropertiesPanelRefreshes,
      `x=${round(pos.x)}, y=${round(pos.y)}, transform=${pos.transform || ""} |`,
    ].join(" | "));
  }
  return lines.join("\n");
}

async function runBenchmark() {
  app.on("window-all-closed", (event) => event.preventDefault());
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-dev-shm-usage");
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
  await app.whenReady();

  const fixtures = buildFixtures();
  const { runtimeController, runtime } = await createRuntime();
  const win = createWindow();
  const passes = [];
  try {
    await prepareWindow(win, runtime.url);
    for (const fixture of fixtures) {
      for (let repetition = 0; repetition < WARMUPS; repetition += 1) {
        passes.push(await runPass(win, fixture, "warmup", repetition));
      }
      for (let repetition = 0; repetition < REPETITIONS; repetition += 1) {
        passes.push(await runPass(win, fixture, "measured", repetition));
      }
    }
  } finally {
    try { win.close(); } catch {}
    await runtimeController.stop().catch(() => {});
  }

  const report = {
    generatedAt: new Date().toISOString(),
    note: "Synthetic benchmark. SVG fixtures are generated under Notebook/__nv_svg_selection_geometry_benchmark during the run and then removed.",
    command: process.argv.join(" "),
    configuration: {
      warmups: WARMUPS,
      repetitions: REPETITIONS,
      pointerUpdates: POINTER_UPDATES,
      dragClientDelta: DRAG_CLIENT_DELTA,
      objectCounts: OBJECT_COUNTS,
      expectOptimized: EXPECT_OPTIMIZED,
    },
    environment: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      v8: process.versions.v8,
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
    },
    fixtures: fixtures.map(({ id, objectCount, relativePath, label }) => ({ id, objectCount, relativePath, label })),
    passes,
    aggregates: aggregatePasses(passes),
  };
  fs.writeFileSync(JSON_REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(MARKDOWN_REPORT_PATH, makeMarkdownReport(report), "utf8");
  return report;
}

runBenchmark()
  .then((report) => {
    console.log(JSON.stringify({
      jsonReportPath: JSON_REPORT_PATH,
      markdownReportPath: MARKDOWN_REPORT_PATH,
      measuredPasses: report.passes.filter((pass) => pass.kind === "measured").length,
      aggregates: report.aggregates.map((row) => row.skipped
        ? { objectCount: row.objectCount, skipped: true }
        : {
          objectCount: row.objectCount,
          medianTotalMs: row.totalDragMs.median,
          medianPointerMs: row.pointerUpdateMs.median,
          p95PointerMs: row.pointerUpdateMs.p95,
          getSelectableElementsCalls: row.avgGetSelectableElementsCalls,
          selectionQuerySelectorAllStar: row.avgSelectionRefreshQuerySelectorAllStar,
          selectionBoundsCalculations: row.avgSelectionBoundsCalculations,
          unrelatedDataSelectedWrites: row.avgUnrelatedDataSelectedWrites,
        }),
    }, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    try { fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(PUBLIC_HARNESS, { force: true }); } catch {}
    try { app.quit(); } catch {}
  });
