// Nodevision/ApplicationSystem/tests/htmlTypingLatency.electron.cjs
// Browser stress harness for graphical HTML editor typing latency.

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron/main");

const ROOT = process.cwd();
const PORT = Number(process.env.NODEVISION_HTML_TYPING_PORT || 39451);
const FIXTURE_DIR = path.join(ROOT, "Notebook", "__nv_html_typing_latency");
const CHARS = "abcdefghijklmnopqrstuvwxyz".repeat(4).slice(0, 100);
const ATTACH_LAYERS = process.env.NODEVISION_HTML_TYPING_ATTACH_LAYERS !== "0";

function makeHtml(paragraphs) {
  const rows = [];
  for (let i = 0; i < paragraphs; i += 1) {
    const id = i === 0 ? "typing-target" : "section-" + i;
    rows.push("<section id=\"" + id + "\"><h2>Section " + i + "</h2><p>Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu.</p></section>");
  }
  return "<!doctype html><html><head><meta charset=\"utf-8\"><title>Typing Latency " + paragraphs + "</title><style>body{font-family:sans-serif}.nowrap{white-space:nowrap}</style></head><body>" + rows.join("\n") + "</body></html>";
}

function writeFixtures() {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  fs.writeFileSync(path.join(FIXTURE_DIR, "small.html"), makeHtml(35));
  fs.writeFileSync(path.join(FIXTURE_DIR, "medium.html"), makeHtml(250));
  fs.writeFileSync(path.join(FIXTURE_DIR, "large.html"), makeHtml(850));
  fs.writeFileSync(
    path.join(ROOT, "ApplicationSystem/public/__typing-latency-harness.html"),
    "<!doctype html><html><head><meta charset=\"utf-8\"><title>HTML Typing Latency Harness</title></head><body></body></html>"
  );
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
  throw new Error("Timed out waiting for " + expression);
}

const rendererSetup = String.raw`
(() => {
  window.__nvHtmlTypingDiagnostics = true;
  window.NodevisionPerformanceDiagnostics?.enable?.();

  if (!window.__nvTypingFpsOverlay) {
    window.__nvTypingFpsOverlay = {
      async enable() {
        const mod = await import("/FpsOverlay.mjs");
        mod.enableFpsOverlay({ persist: false });
        await new Promise((resolve) => setTimeout(resolve, 350));
        return mod.getFpsOverlaySnapshot();
      },
      disable() {
        window.NodevisionFpsOverlay?.disable?.({ persist: false });
        return window.NodevisionFpsOverlay?.snapshot?.() || null;
      },
      snapshot() {
        return {
          snapshot: window.NodevisionFpsOverlay?.snapshot?.() || null,
          text: document.getElementById("nv-fps-overlay")?.textContent || "",
          overlayCount: document.querySelectorAll("#nv-fps-overlay").length,
        };
      },
    };
  }

  if (!window.__nvTypingMetricPatch) {
    const metrics = {
      getComputedStyleCount: 0,
      getComputedStyleMs: 0,
      qsaCount: 0,
      qsaMs: 0,
      qsaSelectors: {},
      innerTextCount: 0,
      innerTextMs: 0,
      localStorageSetItemCount: 0,
      localStorageSetItemMs: 0,
      recentEvents: 0,
      layerHostMutations: 0,
      longTasks: 0,
      longTaskMs: 0,
      inputDispatchCount: 0,
      inputDispatchTotalMs: 0,
      inputDispatchMaxMs: 0,
      mutationObserverCallbackCount: 0,
      mutationObserverRecordCount: 0,
      innerHTMLReadCount: 0,
      innerHTMLReadMs: 0,
      outerHTMLReadCount: 0,
      outerHTMLReadMs: 0,
      treeWalkerCount: 0,
      treeWalkerMs: 0,
      boundingClientRectCount: 0,
      boundingClientRectMs: 0,
      offsetWidthReadCount: 0,
      offsetHeightReadCount: 0,
      scrollHeightReadCount: 0,
      rafScheduled: 0,
      rafCallbacks: 0,
      fetchCount: 0,
    };
    const patch = { metrics };
    const round = (value) => Math.round(Number(value || 0) * 10) / 10;
    const getComputedStyleOriginal = window.getComputedStyle.bind(window);
    window.getComputedStyle = function patchedGetComputedStyle() {
      const started = performance.now();
      try { return getComputedStyleOriginal(...arguments); }
      finally {
        metrics.getComputedStyleCount += 1;
        metrics.getComputedStyleMs = round(metrics.getComputedStyleMs + performance.now() - started);
      }
    };

    const qsaOriginal = Element.prototype.querySelectorAll;
    Element.prototype.querySelectorAll = function patchedQuerySelectorAll(selector) {
      const started = performance.now();
      try { return qsaOriginal.call(this, selector); }
      finally {
        metrics.qsaCount += 1;
        metrics.qsaMs = round(metrics.qsaMs + performance.now() - started);
        const key = String(selector || "").slice(0, 120);
        metrics.qsaSelectors[key] = (metrics.qsaSelectors[key] || 0) + 1;
      }
    };

    let proto = HTMLElement.prototype;
    let innerTextDescriptor = null;
    while (proto && !innerTextDescriptor) {
      innerTextDescriptor = Object.getOwnPropertyDescriptor(proto, "innerText");
      proto = Object.getPrototypeOf(proto);
    }
    if (innerTextDescriptor?.get && innerTextDescriptor.configurable !== false) {
      Object.defineProperty(HTMLElement.prototype, "innerText", {
        configurable: true,
        enumerable: innerTextDescriptor.enumerable,
        get() {
          const started = performance.now();
          try { return innerTextDescriptor.get.call(this); }
          finally {
            metrics.innerTextCount += 1;
            metrics.innerTextMs = round(metrics.innerTextMs + performance.now() - started);
          }
        },
        set: innerTextDescriptor.set ? function(value) { return innerTextDescriptor.set.call(this, value); } : undefined,
      });
    }

    const patchMeasuredGetter = (name, countKey, msKey) => {
      let owner = Element.prototype;
      let descriptor = null;
      while (owner && !descriptor) {
        descriptor = Object.getOwnPropertyDescriptor(owner, name);
        if (!descriptor) owner = Object.getPrototypeOf(owner);
      }
      if (!descriptor?.get || descriptor.configurable === false) return;
      Object.defineProperty(owner, name, {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
          const started = performance.now();
          try { return descriptor.get.call(this); }
          finally {
            metrics[countKey] += 1;
            if (msKey) metrics[msKey] = round(metrics[msKey] + performance.now() - started);
          }
        },
        set: descriptor.set ? function(value) { return descriptor.set.call(this, value); } : undefined,
      });
    };
    patchMeasuredGetter("innerHTML", "innerHTMLReadCount", "innerHTMLReadMs");
    patchMeasuredGetter("outerHTML", "outerHTMLReadCount", "outerHTMLReadMs");

    const createTreeWalkerOriginal = Document.prototype.createTreeWalker;
    Document.prototype.createTreeWalker = function patchedCreateTreeWalker() {
      const started = performance.now();
      try { return createTreeWalkerOriginal.apply(this, arguments); }
      finally {
        metrics.treeWalkerCount += 1;
        metrics.treeWalkerMs = round(metrics.treeWalkerMs + performance.now() - started);
      }
    };

    const getBoundingClientRectOriginal = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect() {
      const started = performance.now();
      try { return getBoundingClientRectOriginal.apply(this, arguments); }
      finally {
        metrics.boundingClientRectCount += 1;
        metrics.boundingClientRectMs = round(metrics.boundingClientRectMs + performance.now() - started);
      }
    };

    for (const [name, countKey] of [["offsetWidth", "offsetWidthReadCount"], ["offsetHeight", "offsetHeightReadCount"], ["scrollHeight", "scrollHeightReadCount"]]) {
      let owner = HTMLElement.prototype;
      let descriptor = null;
      while (owner && !descriptor) {
        descriptor = Object.getOwnPropertyDescriptor(owner, name);
        if (!descriptor) owner = Object.getPrototypeOf(owner);
      }
      if (descriptor?.get && descriptor.configurable !== false) {
        Object.defineProperty(owner, name, {
          configurable: true,
          enumerable: descriptor.enumerable,
          get() {
            metrics[countKey] += 1;
            return descriptor.get.call(this);
          },
        });
      }
    }

    const requestAnimationFrameOriginal = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      metrics.rafScheduled += 1;
      return requestAnimationFrameOriginal((timestamp) => {
        metrics.rafCallbacks += 1;
        return callback(timestamp);
      });
    };

    const fetchOriginal = window.fetch?.bind(window);
    if (fetchOriginal) {
      window.fetch = function patchedFetch() {
        metrics.fetchCount += 1;
        return fetchOriginal(...arguments);
      };
    }

    const MutationObserverOriginal = window.MutationObserver;
    if (MutationObserverOriginal && !window.__nvTypingMutationObserverPatched) {
      window.MutationObserver = function PatchedMutationObserver(callback) {
        return new MutationObserverOriginal((records, observer) => {
          metrics.mutationObserverCallbackCount += 1;
          metrics.mutationObserverRecordCount += Number(records?.length || 0);
          return callback(records, observer);
        });
      };
      window.MutationObserver.prototype = MutationObserverOriginal.prototype;
      window.__nvTypingMutationObserverPatched = true;
    }

    const localStorageSetItemOriginal = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem() {
      const started = performance.now();
      try { return localStorageSetItemOriginal.apply(this, arguments); }
      finally {
        metrics.localStorageSetItemCount += 1;
        metrics.localStorageSetItemMs = round(metrics.localStorageSetItemMs + performance.now() - started);
      }
    };
    window.addEventListener("nodevision-recents-changed", () => { metrics.recentEvents += 1; });
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          metrics.longTasks += 1;
          metrics.longTaskMs = round(metrics.longTaskMs + entry.duration);
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
      patch.longTaskObserver = observer;
    } catch {}
    patch.reset = () => {
      for (const key of Object.keys(metrics)) {
        if (key === "qsaSelectors") metrics[key] = {};
        else metrics[key] = 0;
      }
    };
    patch.snapshot = () => JSON.parse(JSON.stringify(metrics));
    window.__nvTypingMetricPatch = patch;
  }

  window.__nvTypingMountEditor = async ({ filePath, legacy }) => {
    window.__nvHtmlTypingLegacyInputWork = Boolean(legacy);
    window.__nvHtmlTypingLatency = { samples: [], mutationBatches: [], counters: {} };
    if (window.__nvPerformanceDiagnosticsStore) { window.__nvPerformanceDiagnosticsStore.entries = []; window.__nvPerformanceDiagnosticsStore.counters = {}; }
    window.__nvTypingMetricPatch.reset();
    window.NodevisionPerformanceDiagnostics?.enable?.();

    let shell = document.getElementById("typing-latency-shell");
    if (!shell) {
      document.body.innerHTML = "";
      shell = document.createElement("div");
      shell.id = "typing-latency-shell";
      shell.style.cssText = "display:grid;grid-template-columns:1fr 260px;height:760px;width:1100px;gap:8px";
      document.body.appendChild(shell);
    }
    shell.innerHTML = "";
    const editorHost = document.createElement("div");
    editorHost.id = "typing-latency-editor-host";
    editorHost.style.cssText = "min-height:0;display:flex;overflow:hidden;border:1px solid #aaa";
    const layersHost = document.createElement("div");
    layersHost.id = "typing-latency-layers-host";
    layersHost.style.cssText = "overflow:auto;border:1px solid #bbb";
    window.__nvTypingLayerHostObserver?.disconnect?.();
    const layerObserver = new MutationObserver((records) => {
      const metrics = window.__nvTypingMetricPatch?.metrics;
      if (metrics) metrics.layerHostMutations += Number(records?.length || 0);
    });
    layerObserver.observe(layersHost, { childList: true, subtree: true, attributes: true, characterData: true });
    window.__nvTypingLayerHostObserver = layerObserver;
    shell.append(editorHost, layersHost);

    console.log("[typing] importing editor");
    import("/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs?typing=" + Date.now())
      .then((editor) => {
        console.log("[typing] starting renderEditor");
        return editor.renderEditor(filePath, editorHost, { mode: "HTMLediting" });
      })
      .catch((err) => {
        console.error("[typing] renderEditor failed", err);
      });
    window.__nvTypingTarget = null;
    return { ok: true, scheduled: true };
  };

  window.__nvTypingTypeChars = async (chars, options = {}) => {
    const text = String(chars || "");
    const delayMs = Math.max(0, Number(options.delayMs ?? 22));
    const target = window.__nvTypingTarget || document.querySelector("#wysiwyg #typing-target p") || document.querySelector("#wysiwyg p") || document.getElementById("wysiwyg");
    if (!target) throw new Error("Typing target unavailable");
    let textNode = target.lastChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      textNode = document.createTextNode("");
      target.appendChild(textNode);
    }
    for (const ch of text) {
      const dispatchStarted = performance.now();
      target.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: ch }));
      textNode.nodeValue = String(textNode.nodeValue || "") + ch;
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ch }));
      const dispatchMs = Math.round((performance.now() - dispatchStarted) * 10) / 10;
      const metrics = window.__nvTypingMetricPatch?.metrics;
      if (metrics) {
        metrics.inputDispatchCount += 1;
        metrics.inputDispatchTotalMs = Math.round((metrics.inputDispatchTotalMs + dispatchMs) * 10) / 10;
        metrics.inputDispatchMaxMs = Math.max(metrics.inputDispatchMaxMs, dispatchMs);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    window.__nvTypingExpectedText = String(window.__nvTypingExpectedText || "") + text;
    await new Promise((resolve) => setTimeout(resolve, 80));
    return true;
  };

  window.__nvTypingExerciseEditActions = async () => {
    const target = window.__nvTypingTarget || document.querySelector("#wysiwyg #typing-target p") || document.querySelector("#wysiwyg p") || document.getElementById("wysiwyg");
    if (!target) throw new Error("Typing target unavailable");
    const textNode = target.lastChild?.nodeType === Node.TEXT_NODE ? target.lastChild : target.appendChild(document.createTextNode(""));
    for (let i = 0; i < 8; i += 1) {
      target.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "deleteContentBackward" }));
      textNode.nodeValue = String(textNode.nodeValue || "").slice(0, -1);
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
      await new Promise((resolve) => setTimeout(resolve, 24));
    }
    for (let i = 0; i < 4; i += 1) {
      target.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertParagraph" }));
      target.appendChild(document.createElement("br"));
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertParagraph" }));
      await new Promise((resolve) => setTimeout(resolve, 36));
    }
    const layersHost = document.getElementById("typing-latency-layers-host");
    if (layersHost) {
      layersHost.style.display = "none";
      await new Promise((resolve) => setTimeout(resolve, 160));
      layersHost.style.display = "block";
      await new Promise((resolve) => setTimeout(resolve, 160));
    }
    return window.__nvTypingFpsOverlay?.snapshot?.() || null;
  };

  window.__nvTypingFinishPass = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const samples = (window.__nvHtmlTypingLatency?.samples || []).filter((sample) => sample.phase === "input");
    const values = samples.map((sample) => Number(sample.secondRafMs || sample.firstRafMs || 0)).filter((value) => value > 0);
    values.sort((a, b) => a - b);
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const p95 = values.length ? values[Math.min(values.length - 1, Math.floor(values.length * 0.95))] : 0;
    const mutationBatches = window.__nvHtmlTypingLatency?.mutationBatches || [];
    const mutationBatchSummary = mutationBatches.reduce((summary, batch) => {
      summary.batches += 1;
      summary.totalRecords += Number(batch.total || 0);
      summary.characterData += Number(batch.characterData || 0);
      if (batch.textOnly) summary.textOnly += 1;
      if (batch.structural) summary.structural += 1;
      return summary;
    }, { batches: 0, totalRecords: 0, characterData: 0, textOnly: 0, structural: 0 });
    const metricsBeforeSave = window.__nvTypingMetricPatch.snapshot();
    let saveCheck = { ok: false };
    try {
      const html = typeof window.getEditorHTML === "function" ? window.getEditorHTML() : "";
      const metricsAfterSave = window.__nvTypingMetricPatch.snapshot();
      const expected = String(window.__nvTypingExpectedText || "").slice(0, 80);
      saveCheck = {
        ok: Boolean(html && (!expected || html.includes(expected))),
        htmlLength: Number(html.length || 0),
        containsTypedPrefix: Boolean(!expected || html.includes(expected)),
        innerHTMLReads: metricsAfterSave.innerHTMLReadCount - metricsBeforeSave.innerHTMLReadCount,
        outerHTMLReads: metricsAfterSave.outerHTMLReadCount - metricsBeforeSave.outerHTMLReadCount,
        treeWalks: metricsAfterSave.treeWalkerCount - metricsBeforeSave.treeWalkerCount,
        fetches: metricsAfterSave.fetchCount - metricsBeforeSave.fetchCount,
      };
    } catch (err) {
      saveCheck = { ok: false, error: err?.message || String(err) };
    }

    return {
      samples: samples.length,
      meanSecondRafMs: Math.round(mean * 10) / 10,
      p95SecondRafMs: Math.round(p95 * 10) / 10,
      mutationBatchSummary,
      counters: window.__nvHtmlTypingLatency?.counters || {},
      metrics: metricsBeforeSave,
      saveCheck,
      perfEntryCounts: (window.NodevisionPerformanceDiagnostics?.snapshot?.().entries || []).filter((entry) => String(entry.name || "").startsWith("html typing")).reduce((counts, entry) => { const key = String(entry.name || ""); counts[key] = (counts[key] || 0) + 1; return counts; }, {}),
    };
  };
})();
`;

async function runPass(win, { label, filePath, legacy }) {
  console.log("[typing] starting " + label);
  const prep = await win.webContents.executeJavaScript("window.__nvTypingMountEditor(" + JSON.stringify({ filePath, legacy }) + ")", true);
  await delay(5200);
  if (ATTACH_LAYERS) {
    await win.webContents.executeJavaScript("(() => { const host = document.getElementById(\"typing-latency-layers-host\"); if (host && window.HTMLLayersContext?.attachHost) { window.__nvTypingLayersCleanup?.(); window.__nvTypingLayersCleanup = window.HTMLLayersContext.attachHost(host); return true; } return false; })()", true);
    await delay(900);
  }
  await win.webContents.executeJavaScript("(() => { const wysiwyg = document.getElementById(\"wysiwyg\"); const target = wysiwyg?.querySelector(\"#typing-target p\") || wysiwyg?.querySelector(\"p\") || wysiwyg; if (target) { const range = document.createRange(); range.selectNodeContents(target); range.collapse(false); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); wysiwyg.focus(); window.__nvTypingTarget = target; } window.__nvTypingExpectedText = \"\"; window.__nvTypingMetricPatch.reset(); window.__nvHtmlTypingLatency = { samples: [], mutationBatches: [], counters: {} }; if (window.__nvPerformanceDiagnosticsStore) { window.__nvPerformanceDiagnosticsStore.entries = []; window.__nvPerformanceDiagnosticsStore.counters = {}; } return Boolean(target); })()", true);
  await delay(350);
  await win.webContents.executeJavaScript("(() => { window.__nvTypingLayerHostObserver?.takeRecords?.(); window.__nvTypingMetricPatch.reset(); window.__nvHtmlTypingLatency = { samples: [], mutationBatches: [], counters: {} }; if (window.__nvPerformanceDiagnosticsStore) { window.__nvPerformanceDiagnosticsStore.entries = []; window.__nvPerformanceDiagnosticsStore.counters = {}; } })()", true);
  const idleFps = await win.webContents.executeJavaScript("window.__nvTypingFpsOverlay.enable()", true);
  await win.webContents.executeJavaScript("window.__nvTypingTypeChars(" + JSON.stringify(CHARS.slice(0, 20)) + ", { delayMs: 85 })", true);
  const afterSlowTypingFps = await win.webContents.executeJavaScript("window.__nvTypingFpsOverlay.snapshot()", true);
  await win.webContents.executeJavaScript("window.__nvTypingTypeChars(" + JSON.stringify(CHARS.slice(20)) + ", { delayMs: 6 })", true);
  const afterRapidTypingFps = await win.webContents.executeJavaScript("window.__nvTypingFpsOverlay.snapshot()", true);
  const metricsAfterRapidTyping = await win.webContents.executeJavaScript("window.__nvTypingMetricPatch.snapshot()", true);
  const afterEditActionsFps = await win.webContents.executeJavaScript("window.__nvTypingExerciseEditActions()", true);
  const result = await win.webContents.executeJavaScript("window.__nvTypingFinishPass()", true);
  const finalFps = await win.webContents.executeJavaScript("window.__nvTypingFpsOverlay.snapshot()", true);
  console.log("[typing] finished " + label);
  return { label, filePath, legacy, prep, fpsOverlay: { idleFps, afterSlowTypingFps, afterRapidTypingFps, afterEditActionsFps, finalFps }, operationSnapshots: { afterRapidTyping: metricsAfterRapidTyping }, result };
}


function fpsSnapshotValue(pass, phase) {
  return pass?.fpsOverlay?.[phase]?.snapshot || pass?.fpsOverlay?.[phase] || null;
}

function compactPass(pass) {
  const afterRapid = pass?.operationSnapshots?.afterRapidTyping || {};
  const metrics = pass?.result?.metrics || {};
  const imageTextSelector = ".nodevision-image-text, [data-nodevision-image-text=\"true\"], [data-nodevision-image-src]";
  return {
    label: pass.label,
    legacy: pass.legacy,
    samples: pass?.result?.samples || 0,
    meanSecondRafMs: pass?.result?.meanSecondRafMs || 0,
    p95SecondRafMs: pass?.result?.p95SecondRafMs || 0,
    fps: {
      idle: fpsSnapshotValue(pass, "idleFps"),
      afterSlowTyping: fpsSnapshotValue(pass, "afterSlowTypingFps"),
      afterRapidTyping: fpsSnapshotValue(pass, "afterRapidTypingFps"),
      afterEditActions: fpsSnapshotValue(pass, "afterEditActionsFps"),
      final: fpsSnapshotValue(pass, "finalFps"),
    },
    mutationBatchSummary: pass?.result?.mutationBatchSummary || {},
    counters: pass?.result?.counters || {},
    afterRapidTyping: {
      qsaCount: afterRapid.qsaCount || 0,
      imageTextSelectorCount: afterRapid.qsaSelectors?.[imageTextSelector] || 0,
      innerTextCount: afterRapid.innerTextCount || 0,
      innerHTMLReadCount: afterRapid.innerHTMLReadCount || 0,
      outerHTMLReadCount: afterRapid.outerHTMLReadCount || 0,
      treeWalkerCount: afterRapid.treeWalkerCount || 0,
      boundingClientRectCount: afterRapid.boundingClientRectCount || 0,
      layerHostMutations: afterRapid.layerHostMutations || 0,
      longTasks: afterRapid.longTasks || 0,
      longTaskMs: afterRapid.longTaskMs || 0,
      inputDispatchCount: afterRapid.inputDispatchCount || 0,
      inputDispatchTotalMs: afterRapid.inputDispatchTotalMs || 0,
      inputDispatchMaxMs: afterRapid.inputDispatchMaxMs || 0,
      mutationObserverCallbackCount: afterRapid.mutationObserverCallbackCount || 0,
      mutationObserverRecordCount: afterRapid.mutationObserverRecordCount || 0,
      rafScheduled: afterRapid.rafScheduled || 0,
      rafCallbacks: afterRapid.rafCallbacks || 0,
      fetchCount: afterRapid.fetchCount || 0,
    },
    finalMetrics: {
      qsaCount: metrics.qsaCount || 0,
      imageTextSelectorCount: metrics.qsaSelectors?.[imageTextSelector] || 0,
      innerTextCount: metrics.innerTextCount || 0,
      innerHTMLReadCount: metrics.innerHTMLReadCount || 0,
      outerHTMLReadCount: metrics.outerHTMLReadCount || 0,
      treeWalkerCount: metrics.treeWalkerCount || 0,
      boundingClientRectCount: metrics.boundingClientRectCount || 0,
      layerHostMutations: metrics.layerHostMutations || 0,
      longTasks: metrics.longTasks || 0,
      longTaskMs: metrics.longTaskMs || 0,
      fetchCount: metrics.fetchCount || 0,
    },
    saveCheck: pass?.result?.saveCheck || {},
  };
}

(async () => {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-dev-shm-usage");
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
  await app.whenReady();
  writeFixtures();

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
    width: 1280,
    height: 900,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  win.webContents.on("console-message", (_event, _level, message) => {
    if (/\[typing\]|Failed|Error/i.test(message)) console.log("[renderer]", message);
  });
  await win.loadURL(runtime.url + "/__typing-latency-harness.html?nvPerf=1");
  await win.webContents.executeJavaScript(`fetch("/api/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "admin" }) }).then(r => r.json())`, true);
  await win.loadURL(runtime.url + "/__typing-latency-harness.html?nvPerf=1");
  await waitFor(win, "document.readyState === \"complete\"");
  await win.webContents.executeJavaScript(rendererSetup, true);

  const passes = [];
  for (const size of ["small", "medium", "large"]) {
    const filePath = "__nv_html_typing_latency/" + size + ".html";
    passes.push(await runPass(win, { label: size + " legacy", filePath, legacy: true }));
    passes.push(await runPass(win, { label: size + " optimized", filePath, legacy: false }));
  }

  for (const pass of passes.filter((item) => item.label.includes("optimized"))) {
    const metrics = pass.result?.metrics || {};
    const selectors = metrics.qsaSelectors || {};
    const imageTextSelectorCount = Number(selectors[".nodevision-image-text, [data-nodevision-image-text=\"true\"], [data-nodevision-image-src]"] || 0);
    if (imageTextSelectorCount > 8) throw new Error(pass.label + " ran image-text presentation query too often: " + imageTextSelectorCount);
    if (Number(metrics.innerHTMLReadCount || 0) !== 0) throw new Error(pass.label + " read innerHTML before explicit save serialization");
    if (Number(metrics.outerHTMLReadCount || 0) !== 0) throw new Error(pass.label + " read outerHTML before explicit save serialization");
    const rapidMetrics = pass.operationSnapshots?.afterRapidTyping || {};
    if (Number(rapidMetrics.layerHostMutations || 0) > 8) throw new Error(pass.label + " rebuilt Layers during ordinary text typing: " + rapidMetrics.layerHostMutations);
    if (!pass.result?.saveCheck?.ok) throw new Error(pass.label + " save serialization check failed");
  }
  const overlayCleanup = await win.webContents.executeJavaScript("window.__nvTypingFpsOverlay.disable()", true);
  const report = process.env.NODEVISION_HTML_TYPING_SUMMARY === "1"
    ? { passes: passes.map(compactPass), overlayCleanup }
    : { passes, overlayCleanup };
  console.log(JSON.stringify(report, null, 2));
  await win.close();
  await runtimeController.stop();
  app.quit();
})().catch(async (err) => {
  console.error(err);
  try { app.quit(); } catch {}
  process.exit(1);
});
