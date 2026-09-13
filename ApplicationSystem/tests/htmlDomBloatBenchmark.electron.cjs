// Nodevision/ApplicationSystem/tests/htmlDomBloatBenchmark.electron.cjs
// This Electron benchmark orchestrates deterministic synthetic HTML editor stress tests for Nodevision and writes local reports without using private Notebook documents or network services.

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");
const {
  OPS_ONLY,
  PORT,
  PUBLIC_HARNESS,
  REPORT_PATH,
  ROOT,
  RUN_FULL,
  ATTACH_LAYERS,
  TYPING_TEXT,
} = require("./htmlDomBloat/config.cjs");
const { runDomBehaviorExperiments, runRoundTripGrowth, runSaveReloadStability } = require("./htmlDomBloat/behaviorSuites.cjs");
const { inspectEditorSource } = require("./htmlDomBloat/editorSourceScan.cjs");
const { runTypingPass, waitFor } = require("./htmlDomBloat/electronHarness.cjs");
const { chooseBenchmarkFixtures, compactFixtureMetrics, runOperationFragmentationSuite } = require("./htmlDomBloat/operationSuites.cjs");
const { rendererSetup } = require("./htmlDomBloat/rendererSetup.cjs");
const { buildFixtures } = require("./htmlDomBloat/textFixtures.cjs");

function createWindow() {
  const win = new BrowserWindow({
    show: true,
    width: 1280,
    height: 920,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  win.webContents.on("console-message", (_event, _level, message) => {
    if (/dom bloat|typing|Failed|Error/i.test(message)) console.log("[renderer]", message);
  });
  return win;
}

async function startRuntime() {
  process.env.NODEVISION_ROOT = ROOT;
  process.env.NODEVISION_PHP_ENABLED = "0";
  process.env.NODEVISION_PERF_DIAGNOSTICS = "0";
  const runtimeModulePath = path.join(ROOT, "ApplicationSystem/core/runtime.js");
  const runtimeMod = await import(pathToFileURL(runtimeModulePath).href);
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

async function prepareWindow(win, runtimeUrl) {
  const harnessHtml = [
    "<!-- Nodevision/ApplicationSystem/public/__html-dom-bloat-harness.html -->",
    "<!-- This HTML harness provides an empty local page where the Electron DOM bloat benchmark mounts the Nodevision graphical HTML editor for deterministic synthetic performance tests. -->",
    "<!doctype html>",
    "<html>",
    "<head>",
    "  <meta charset=\"utf-8\">",
    "  <title>HTML DOM Bloat Harness</title>",
    "</head>",
    "<body></body>",
    "</html>",
  ].join("\n");
  fs.writeFileSync(PUBLIC_HARNESS, harnessHtml, "utf8");
  await win.loadURL(runtimeUrl + "/__html-dom-bloat-harness.html?nvPerf=1");
  await win.webContents.executeJavaScript(
    `fetch("/api/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "admin" }) }).then(r => r.json())`,
    true
  );
  await win.loadURL(runtimeUrl + "/__html-dom-bloat-harness.html?nvPerf=1");
  await waitFor(win, "document.readyState === 'complete'");
  await win.webContents.executeJavaScript(rendererSetup, true);
}

async function runTypingSuites(win, fixtures) {
  const typingPasses = [];
  const benchmarkFixtures = chooseBenchmarkFixtures(fixtures);
  for (const fixture of benchmarkFixtures) {
    console.log("[dom-bloat] typing pass " + fixture.id);
    typingPasses.push(await runTypingPass(win, fixture, { spellcheck: true, position: "end" }));
  }
  for (const id of ["A-clean-20000", "B-realistic-20000", "E3-blank-class-20000"]) {
    const fixture = fixtures.find((item) => item.id === id);
    console.log("[dom-bloat] spellcheck-off pass " + fixture.id);
    typingPasses.push(await runTypingPass(win, fixture, { spellcheck: false, position: "end" }));
  }
  for (const position of ["beginning", "middle"]) {
    const fixture = fixtures.find((item) => item.id === "E3-blank-class-20000");
    typingPasses.push(await runTypingPass(win, fixture, { spellcheck: true, position }));
  }
  for (const id of ["A-clean-20000", "E3-blank-class-20000"]) {
    const fixture = fixtures.find((item) => item.id === id);
    typingPasses.push(await runTypingPass(win, fixture, { spellcheck: true, position: "end", disableContentVisibility: true }));
  }
  return typingPasses;
}

async function runBenchmark() {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-dev-shm-usage");
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
  await app.whenReady();

  const fixtures = buildFixtures();
  const { runtimeController, runtime } = await startRuntime();
  const win = createWindow();
  await prepareWindow(win, runtime.url);

  let typingPasses = [];
  let roundTripGrowth = null;
  let behaviorExperiments = null;
  let saveReloadStability = null;
  if (!OPS_ONLY) {
    typingPasses = await runTypingSuites(win, fixtures);
    const growthFixture = fixtures.find((item) => item.id === "E2-blank-class-5000");
    roundTripGrowth = await runRoundTripGrowth(win, growthFixture);
    behaviorExperiments = await runDomBehaviorExperiments(win);
    saveReloadStability = await runSaveReloadStability(win);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    note: "All fixtures are deterministic synthetic prose generated by this benchmark. No user document content is used.",
    configuration: { runFull: RUN_FULL, opsOnly: OPS_ONLY, layersAttached: ATTACH_LAYERS, typingCharacters: TYPING_TEXT.length, typingDelayMs: 12 },
    fixtures: compactFixtureMetrics(fixtures),
    typingPasses,
    roundTripGrowth,
    behaviorExperiments,
    saveReloadStability,
    operationFragmentation: await runOperationFragmentationSuite(win, fixtures),
    sourceInvestigation: inspectEditorSource(),
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ reportPath: REPORT_PATH, fixtureCount: fixtures.length, typingPassCount: typingPasses.length }, null, 2));

  await win.close();
  await runtimeController.stop();
  app.quit();
}

runBenchmark().catch(async (err) => {
  console.error(err);
  try { app.quit(); } catch {}
  process.exit(1);
});
