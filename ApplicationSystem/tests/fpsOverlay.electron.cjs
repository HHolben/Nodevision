// Nodevision/ApplicationSystem/tests/fpsOverlay.electron.cjs
// Browser smoke test for toggling the FPS/frame-time overlay from the View toolbar menu.

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron/main");

const ROOT = process.cwd();
const PORT = Number(process.env.NODEVISION_FPS_OVERLAY_PORT || 39462);
const HARNESS_PATH = path.join(ROOT, "ApplicationSystem/public/__fps-overlay-harness.html");

function writeHarness() {
  fs.writeFileSync(HARNESS_PATH, `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>FPS Overlay Harness</title>
  <link rel="stylesheet" href="/Stylesheets/ToolbarStyles/globalToolbar.css">
</head>
<body>
  <div id="global-toolbar"></div>
  <div id="sub-toolbar"></div>
  <div id="workspace" style="width:1000px;height:600px;"></div>
  <div id="status-bar"></div>
</body>
</html>`);
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(win, expression, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ok = await win.webContents.executeJavaScript("Boolean(" + expression + ")", true).catch(() => false);
    if (ok) return true;
    await delay(50);
  }
  const state = await win.webContents.executeJavaScript("window.__fpsOverlaySmokeState?.()", true).catch(() => null);
  throw new Error("Timed out waiting for " + expression + " state=" + JSON.stringify(state));
}

async function clickSelector(win, selector) {
  const rect = await win.webContents.executeJavaScript(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + Math.min(rect.width / 2, 40), y: rect.top + Math.min(rect.height / 2, 16), width: rect.width, height: rect.height };
  })()`, true);
  if (!rect || rect.width <= 0 || rect.height <= 0) throw new Error("Cannot click missing or hidden selector: " + selector);
  win.focus();
  win.webContents.focus();
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  win.webContents.sendInputEvent({ type: "mouseMove", x, y });
  win.webContents.sendInputEvent({ type: "mouseDown", x, y, button: "left", clickCount: 1 });
  win.webContents.sendInputEvent({ type: "mouseUp", x, y, button: "left", clickCount: 1 });
  await delay(150);
}

async function state(win) {
  return await win.webContents.executeJavaScript("window.__fpsOverlaySmokeState()", true);
}

async function openViewMenu(win) {
  await clickSelector(win, '[data-heading="View"] > .toolbar-main-button');
  await waitFor(win, `(() => {
    const btn = document.querySelector('.toolbar-button[data-heading="Show FPS"] .toolbar-dropdown-button');
    const panel = btn?.closest?.('.toolbar-dropdown-panel');
    return Boolean(btn && panel && getComputedStyle(panel).display !== 'none');
  })()`);
}

(async () => {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-dev-shm-usage");
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  await app.whenReady();
  writeHarness();

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
  const runtime = await runtimeController.start();
  const win = new BrowserWindow({
    show: true,
    width: 1180,
    height: 780,
    webPreferences: { contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false },
  });

  try {
    await win.loadURL(runtime.url + "/__fps-overlay-harness.html");
    await win.webContents.executeJavaScript(`fetch("/api/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "admin" }) }).then(r => r.json())`, true);
    await win.loadURL(runtime.url + "/__fps-overlay-harness.html");
    await waitFor(win, "document.readyState === \"complete\"");
    await win.webContents.executeJavaScript(`
      (async () => {
        localStorage.setItem("nodevision.fpsOverlay", "0");
        window.NodevisionState = { currentMode: "Default" };
        const overlay = await import("/FpsOverlay.mjs");
        overlay.disableFpsOverlay({ persist: false });
        const toolbar = await import("/panels/createToolbar.mjs");
        await toolbar.createToolbar("#global-toolbar");
        window.__fpsOverlaySmokeState = () => {
          const snapshot = window.NodevisionFpsOverlay?.snapshot?.() || {};
          const showFpsButtons = Array.from(document.querySelectorAll(".toolbar-dropdown-button"))
            .filter((btn) => btn.textContent.includes("Show FPS"));
          return {
            overlayCount: document.querySelectorAll("#nv-fps-overlay").length,
            overlayText: document.getElementById("nv-fps-overlay")?.textContent || "",
            enabled: Boolean(snapshot.enabled),
            rafActive: Boolean(snapshot.rafActive),
            frameHistoryLength: snapshot.frameHistoryLength || 0,
            buttonCount: showFpsButtons.length,
            pressedStates: showFpsButtons.map((btn) => btn.getAttribute("aria-pressed") || ""),
          };
        };
      })()
    `, true);

    await openViewMenu(win);
    const before = await state(win);
    await clickSelector(win, '.toolbar-button[data-heading="Show FPS"] .toolbar-dropdown-button');
    await waitFor(win, 'window.__fpsOverlaySmokeState().enabled && window.__fpsOverlaySmokeState().overlayCount === 1');
    await delay(350);
    await openViewMenu(win);
    const afterEnable = await state(win);

    await clickSelector(win, '.toolbar-button[data-heading="Show FPS"] .toolbar-dropdown-button');
    await waitFor(win, '!window.__fpsOverlaySmokeState().enabled && window.__fpsOverlaySmokeState().overlayCount === 0 && !window.__fpsOverlaySmokeState().rafActive');
    await openViewMenu(win);
    const afterDisable = await state(win);

    await clickSelector(win, '.toolbar-button[data-heading="Show FPS"] .toolbar-dropdown-button');
    await waitFor(win, 'window.__fpsOverlaySmokeState().enabled && window.__fpsOverlaySmokeState().overlayCount === 1 && window.__fpsOverlaySmokeState().rafActive');
    const afterReenable = await state(win);

    const result = { before, afterEnable, afterDisable, afterReenable };
    console.log(JSON.stringify(result, null, 2));
    if (before.buttonCount < 1) throw new Error("View menu did not expose Show FPS");
    if (before.enabled || before.overlayCount !== 0) throw new Error("overlay should start disabled for smoke test");
    if (!afterEnable.enabled || !afterEnable.rafActive || afterEnable.overlayCount !== 1) throw new Error("Show FPS did not enable one overlay and RAF loop");
    if (!afterEnable.pressedStates.includes("true")) throw new Error("Show FPS menu item did not show pressed state after enabling");
    if (afterDisable.enabled || afterDisable.rafActive || afterDisable.overlayCount !== 0) throw new Error("Show FPS did not disable overlay and RAF loop");
    if (!afterDisable.pressedStates.includes("false")) throw new Error("Show FPS menu item did not show unpressed state after disabling");
    if (!afterReenable.enabled || !afterReenable.rafActive || afterReenable.overlayCount !== 1) throw new Error("Show FPS did not re-enable cleanly");
  } finally {
    try { await win.close(); } catch {}
    await runtimeController.stop();
    try { fs.rmSync(HARNESS_PATH, { force: true }); } catch {}
    app.quit();
  }
})().catch((err) => {
  console.error(err);
  try { app.quit(); } catch {}
  process.exit(1);
});
