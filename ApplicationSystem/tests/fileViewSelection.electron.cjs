// Nodevision/ApplicationSystem/tests/fileViewSelection.electron.cjs
// Browser smoke test for real-click FileManager selection following and directory index resolution.

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron/main");

const ROOT = process.cwd();
const PORT = Number(process.env.NODEVISION_FILEVIEW_SELECTION_PORT || 39461);
const FIXTURE_DIR = path.join(ROOT, "Notebook", "__nv_fileview_selection");
const HARNESS_PATH = path.join(ROOT, "ApplicationSystem/public/__fileview-selection-harness.html");

function writeFixtures() {
  fs.mkdirSync(path.join(FIXTURE_DIR, "Dir"), { recursive: true });
  fs.mkdirSync(path.join(FIXTURE_DIR, "EmptyDir"), { recursive: true });
  fs.writeFileSync(path.join(FIXTURE_DIR, "A.md"), "# A\n");
  fs.writeFileSync(path.join(FIXTURE_DIR, "B.md"), "# B\n");
  fs.writeFileSync(path.join(FIXTURE_DIR, "C.md"), "# C\n");
  fs.writeFileSync(path.join(FIXTURE_DIR, "D.md"), "# D\n");
  fs.writeFileSync(path.join(FIXTURE_DIR, "Dir", "index.html"), "<!doctype html><h1>Dir Index</h1>");
  fs.writeFileSync(HARNESS_PATH, "<!doctype html><html><head><meta charset=\"utf-8\"><title>FileView Selection Harness</title></head><body></body></html>");
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(page, expression, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ok = await page.webContents.executeJavaScript("Boolean(" + expression + ")", true).catch(() => false);
    if (ok) return true;
    await delay(50);
  }
  const state = await page.webContents.executeJavaScript("window.__collectFileViewClickState?.()", true).catch(() => null);
  throw new Error("Timed out waiting for " + expression + " state=" + JSON.stringify(state));
}

async function clickSelector(win, selector) {
  const rect = await win.webContents.executeJavaScript(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + Math.min(rect.width / 2, 24), y: rect.top + Math.min(rect.height / 2, 14), width: rect.width, height: rect.height };
  })()`, true);
  if (!rect || rect.width <= 0 || rect.height <= 0) throw new Error("Cannot click missing or hidden selector: " + selector);
  win.focus();
  win.webContents.focus();
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  win.webContents.sendInputEvent({ type: "mouseMove", x, y });
  win.webContents.sendInputEvent({ type: "mouseDown", x, y, button: "left", clickCount: 1 });
  win.webContents.sendInputEvent({ type: "mouseUp", x, y, button: "left", clickCount: 1 });
  await delay(120);
}

async function state(win) {
  return await win.webContents.executeJavaScript("window.__collectFileViewClickState?.()", true);
}

const setupScript = String.raw`
(async () => {
  window.__nvPanelTabContentIsActive = (node) => !node?.closest?.(".nv-panel-tab-content")?.hidden;
  await import("/NodevisionSelection.mjs");
  await import("/EditorSwitchGuard.mjs");
  await import("/panels/workspace.mjs");
  const tabs = await import("/panels/panelTabs.mjs");
  const fileManager = await import("/PanelInstances/InfoPanels/FileManager.mjs?smoke=" + Date.now());
  const fileView = await import("/PanelInstances/ViewPanels/FileView.mjs?smoke=" + Date.now());

  document.body.innerHTML = "";
  const workspace = document.createElement("div");
  workspace.id = "workspace";
  workspace.style.cssText = "display:flex;width:1260px;height:820px;gap:8px;align-items:stretch;";
  const makeCell = (name, panelId, panelClass) => {
    const cell = document.createElement("div");
    cell.className = "panel-cell";
    cell.dataset.nvTestCell = name;
    cell.dataset.id = panelId;
    cell.dataset.panelId = panelId;
    cell.dataset.panelClass = panelClass;
    cell.style.cssText = "flex:1;min-width:0;min-height:0;overflow:hidden;border:1px solid #999;";
    return cell;
  };
  const managerCell = makeCell("manager", "FileManager", "InfoPanel");
  const viewACell = makeCell("viewA", "FileView", "ViewPanel");
  const viewBCell = makeCell("viewB", "FileView", "ViewPanel");
  workspace.append(managerCell, viewACell, viewBCell);
  document.body.append(workspace);

  await tabs.openPanelTabInCell(managerCell, {
    panelType: "FileManager",
    panelClass: "InfoPanel",
    panelVars: { currentDirectory: "__nv_fileview_selection" },
    allowDuplicate: true,
  }, (host, vars) => fileManager.setupPanel(host, vars));

  const viewATab = await tabs.openPanelTabInCell(viewACell, {
    panelType: "FileView",
    panelClass: "ViewPanel",
    panelVars: { filePath: "__nv_fileview_selection/A.md" },
    allowDuplicate: true,
  }, (host, vars) => fileView.setupPanel(host, vars));

  const viewBTab = await tabs.openPanelTabInCell(viewBCell, {
    panelType: "FileView",
    panelClass: "ViewPanel",
    panelVars: { filePath: "__nv_fileview_selection/B.md" },
    allowDuplicate: true,
  }, (host, vars) => fileView.setupPanel(host, vars));

  window.__fileViewClickTrace = [];
  document.addEventListener("click", (event) => {
    const cell = event.target?.closest?.(".panel-cell");
    window.__fileViewClickTrace.push({
      type: "document-click-capture",
      targetPath: event.target?.dataset?.fullPath || "",
      cell: cell?.dataset?.nvTestCell || "",
      activeCell: document.querySelector(".panel-cell.active-panel")?.dataset?.nvTestCell || "",
    });
  }, true);
  window.addEventListener("nodevision-selection-changed", (event) => {
    window.__fileViewClickTrace.push({
      type: "selection-changed",
      path: event.detail?.path || "",
      isDirectory: Boolean(event.detail?.isDirectory),
      activeCell: document.querySelector(".panel-cell.active-panel")?.dataset?.nvTestCell || "",
    });
  });

  window.__collectFileViewClickState = () => {
    const viewARoot = document.querySelector('[data-nv-test-cell="viewA"] [data-nv-file-view-root]');
    const viewBRoot = document.querySelector('[data-nv-test-cell="viewB"] [data-nv-file-view-root]');
    const selection = window.NodevisionSelection?.get?.();
    return {
      activeCell: document.querySelector(".panel-cell.active-panel")?.dataset?.nvTestCell || "",
      activePanel: window.activePanel || "",
      selectionPath: window.NodevisionState?.selectedFile || "",
      selectionKind: selection?.kind || "",
      viewAPath: viewARoot?.dataset?.currentFilePath || "",
      viewBPath: viewBRoot?.dataset?.currentFilePath || "",
      viewASelectionPath: viewARoot?.dataset?.nvFileViewSelectionPath || "",
      viewBSelectionPath: viewBRoot?.dataset?.nvFileViewSelectionPath || "",
      viewAHasCreateIndexButton: Boolean(viewARoot?.querySelector?.("button")),
      viewBHasCreateIndexButton: Boolean(viewBRoot?.querySelector?.("button")),
      rowCount: document.querySelectorAll("#file-list a.file, #file-list a.folder").length,
      trace: window.__fileViewClickTrace.slice(-20),
      viewATabRef: viewATab.reference?.path || "",
      viewBTabRef: viewBTab.reference?.path || "",
    };
  };

  return window.__collectFileViewClickState();
})()
`;

(async () => {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-dev-shm-usage");
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  await app.whenReady();
  writeFixtures();

  process.env.NODEVISION_ROOT = ROOT;
  process.env.NODEVISION_PHP_ENABLED = "0";
  process.env.NODEVISION_PERF_DIAGNOSTICS = "1";
  const runtimeMod = await import(pathToFileURL(path.join(ROOT, "ApplicationSystem/core/runtime.js")).href);
  const runtimeController = runtimeMod.createRuntime({
    runtimeRoot: ROOT,
    host: "127.0.0.1",
    port: PORT,
    portFallback: true,
    phpEnabled: false,
    mqttCsvLoggersEnabled: false,
  });
  const runtime = await runtimeController.start();
  const win = new BrowserWindow({
    show: true,
    width: 1320,
    height: 900,
    webPreferences: { contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false },
  });
  win.webContents.on("console-message", (_event, _level, message) => {
    if (/Error|Failed|FileView selection/i.test(message)) console.log("[renderer]", message);
  });

  try {
    await win.loadURL(runtime.url + "/__fileview-selection-harness.html");
    await win.webContents.executeJavaScript(`fetch("/api/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "admin" }) }).then(r => r.json())`, true);
    await win.loadURL(runtime.url + "/__fileview-selection-harness.html");
    await waitFor(win, "document.readyState === \"complete\"");
    const initial = await win.webContents.executeJavaScript(setupScript, true);
    await waitFor(win, "document.querySelector('[data-full-path=\"__nv_fileview_selection/B.md\"]')");

    await clickSelector(win, '[data-nv-test-cell="viewA"] [data-nv-file-view-root]');
    await clickSelector(win, '[data-full-path="__nv_fileview_selection/B.md"]');
    await waitFor(win, "window.__collectFileViewClickState?.().viewAPath === \"__nv_fileview_selection/B.md\"");
    const afterClickB = await state(win);

    await clickSelector(win, '[data-nv-test-cell="viewB"] [data-nv-file-view-root]');
    await clickSelector(win, '[data-full-path="__nv_fileview_selection/C.md"]');
    await waitFor(win, "window.__collectFileViewClickState?.().viewBPath === \"__nv_fileview_selection/C.md\"");
    const afterClickC = await state(win);

    await clickSelector(win, '[data-nv-test-cell="viewA"] [data-nv-file-view-root]');
    await clickSelector(win, '[data-full-path="__nv_fileview_selection/D.md"]');
    await waitFor(win, "window.__collectFileViewClickState?.().viewAPath === \"__nv_fileview_selection/D.md\"");
    const afterClickD = await state(win);

    await clickSelector(win, '[data-full-path="__nv_fileview_selection/Dir"]');
    await waitFor(win, "window.__collectFileViewClickState?.().viewAPath === \"__nv_fileview_selection/Dir/index.html\" && window.__collectFileViewClickState?.().selectionPath === \"__nv_fileview_selection/Dir\"");
    const afterClickDir = await state(win);

    await clickSelector(win, '[data-full-path="__nv_fileview_selection/EmptyDir"]');
    await waitFor(win, "window.__collectFileViewClickState?.().viewAHasCreateIndexButton && window.__collectFileViewClickState?.().selectionPath === \"__nv_fileview_selection/EmptyDir\"");
    const afterClickEmptyDir = await state(win);

    const result = { initial, afterClickB, afterClickC, afterClickD, afterClickDir, afterClickEmptyDir };
    console.log(JSON.stringify(result, null, 2));
    if (afterClickB.activeCell !== "manager") throw new Error("real FileManager click did not transfer active panel focus");
    if (afterClickB.selectionPath !== "__nv_fileview_selection/B.md") throw new Error("workspace selection did not follow clicked B.md");
    if (afterClickB.viewAPath !== "__nv_fileview_selection/B.md") throw new Error("selection-following FileView A did not render clicked B.md");
    if (afterClickB.viewBPath !== "__nv_fileview_selection/B.md") throw new Error("FileView B changed unexpectedly before ownership test");
    if (afterClickC.viewBPath !== "__nv_fileview_selection/C.md") throw new Error("FileView B did not become follow target after activation");
    if (afterClickC.viewAPath !== "__nv_fileview_selection/B.md") throw new Error("FileView A was retargeted while FileView B owned follow-selection");
    if (afterClickD.viewAPath !== "__nv_fileview_selection/D.md") throw new Error("FileView A did not become follow target after reactivation");
    if (afterClickD.viewBPath !== "__nv_fileview_selection/C.md") throw new Error("FileView B was retargeted while FileView A owned follow-selection");
    if (afterClickDir.viewAPath !== "__nv_fileview_selection/Dir/index.html") throw new Error("directory index was not resolved through real FileManager click");
    if (afterClickDir.selectionPath !== "__nv_fileview_selection/Dir" || afterClickDir.selectionKind !== "directory") throw new Error("workspace selection did not remain selected directory");
    if (afterClickEmptyDir.viewAPath !== "__nv_fileview_selection/EmptyDir") throw new Error("empty directory fallback did not update the FileView target metadata");
    if (!afterClickEmptyDir.viewAHasCreateIndexButton) throw new Error("empty directory did not show existing create-index fallback through real click");
    if (afterClickEmptyDir.selectionPath !== "__nv_fileview_selection/EmptyDir" || afterClickEmptyDir.selectionKind !== "directory") throw new Error("empty directory selection did not remain canonical directory");
  } finally {
    try { await win.close(); } catch {}
    await runtimeController.stop();
    try { fs.rmSync(HARNESS_PATH, { force: true }); } catch {}
    try { fs.rmSync(FIXTURE_DIR, { recursive: true, force: true }); } catch {}
    app.quit();
  }
})().catch((err) => {
  console.error(err);
  try { app.quit(); } catch {}
  process.exit(1);
});
