// Nodevision/ApplicationSystem/tests/htmlDomBloat/electronHarness.cjs
// This module holds reusable Electron BrowserWindow actions for the HTML DOM bloat benchmark while leaving fixture generation and operation suites in dedicated modules.

const { TYPING_TEXT, delay } = require("./config.cjs");

async function waitFor(win, expression, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ok = await win.webContents.executeJavaScript(`Boolean(${expression})`, true).catch(() => false);
    if (ok) return true;
    await delay(50);
  }
  throw new Error("Timed out waiting for " + expression);
}

async function mount(win, fixturePath, options = {}) {
  await win.webContents.executeJavaScript(
    `window.__nvDomBloatMountEditor(${JSON.stringify({ filePath: fixturePath, ...options })})`,
    true
  );
  await waitFor(win, "document.getElementById('wysiwyg') && typeof window.getEditorHTML === 'function'");
}

async function runTypingPass(win, fixture, options = {}) {
  await mount(win, fixture.relativePath, options);
  const position = options.position || "end";
  const selection = await win.webContents.executeJavaScript(`window.__nvDomBloatSelectPosition(${JSON.stringify(position)})`, true);
  await win.webContents.executeJavaScript("window.__nvDomBloatMetricPatch.reset(); window.__nvHtmlTypingLatency = { samples: [], mutationBatches: [], counters: {} };", true);
  const idleFrames = await win.webContents.executeJavaScript("window.__nvDomBloatCollectFrames(900)", true);
  const rapidFramesPromise = win.webContents.executeJavaScript("window.__nvDomBloatCollectFrames(2200)", true);
  await win.webContents.executeJavaScript(`window.__nvDomBloatTypeChars(${JSON.stringify(TYPING_TEXT)}, { delayMs: 12 })`, true);
  const rapidFrames = await rapidFramesPromise;
  const afterRapidMetrics = await win.webContents.executeJavaScript("window.__nvDomBloatMetricPatch.snapshot()", true);
  await win.webContents.executeJavaScript("window.__nvDomBloatBackspace(24)", true);
  const recoveryFrames = await win.webContents.executeJavaScript("window.__nvDomBloatCollectFrames(900)", true);
  const result = await win.webContents.executeJavaScript("window.__nvDomBloatFinishPass()", true);
  delete result.savedHtml;
  return {
    fixtureId: fixture.id,
    family: fixture.family,
    words: fixture.metrics.wordCount,
    position,
    spellcheck: options.spellcheck !== false,
    contentVisibility: options.disableContentVisibility ? "disabled" : "enabled",
    selection,
    structuralMetrics: fixture.metrics,
    idleFrames,
    rapidFrames,
    recoveryFrames,
    afterRapidMetrics,
    result,
  };
}

module.exports = { mount, runTypingPass, waitFor };
