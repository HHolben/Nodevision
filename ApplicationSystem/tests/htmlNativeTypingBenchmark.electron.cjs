// Nodevision/ApplicationSystem/tests/htmlNativeTypingBenchmark.electron.cjs
// Native Electron typing benchmark for long synthetic HTML documents.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const cheerio = require("cheerio");
const { app, BrowserWindow } = require("electron");

const ROOT = process.cwd();
const PORT = Number(process.env.NODEVISION_HTML_NATIVE_TYPING_PORT || 39471);
const FIXTURE_ROOT = path.join(ROOT, "Notebook", "__nv_html_native_typing");
const PUBLIC_HARNESS = path.join(ROOT, "ApplicationSystem/public/__html-native-typing-harness.html");
const JSON_REPORT_PATH = process.env.NODEVISION_HTML_NATIVE_TYPING_REPORT ||
  path.join(ROOT, "ApplicationSystem/tests/htmlNativeTypingBenchmark.report.json");
const MARKDOWN_REPORT_PATH = process.env.NODEVISION_HTML_NATIVE_TYPING_MD ||
  path.join(ROOT, "ApplicationSystem/tests/htmlNativeTypingBenchmark.report.md");
const REPETITIONS = Math.max(1, Number(process.env.NODEVISION_HTML_NATIVE_TYPING_REPETITIONS || 3));
const PACED_DELAY_MS = Math.max(0, Number(process.env.NODEVISION_HTML_NATIVE_TYPING_PACED_DELAY_MS || 45));
const RAPID_DELAY_MS = Math.max(0, Number(process.env.NODEVISION_HTML_NATIVE_TYPING_RAPID_DELAY_MS || 0));
const WARMUP_TEXT = "warmupnative";
const PACED_TEXT = "pacednativeinputsamplepacednativeinput";
const RAPID_TEXT = "rapidnativeinputburstrapidnativeinputburstrapidnativeinputburst";
const LOCATIONS = ["beginning", "middle", "end"];
const CONFIGS = [
  { id: "nodevision-layers-visible", label: "Nodevision + Layers", kind: "nodevision", layers: true },
  { id: "nodevision-layers-hidden", label: "Nodevision, Layers hidden", kind: "nodevision", layers: false },
  { id: "bare-contenteditable", label: "Bare contenteditable", kind: "bare", layers: false },
];
const MODES = [
  { id: "paced", label: "Paced", text: PACED_TEXT, delayMs: PACED_DELAY_MS },
  { id: "rapid", label: "Rapid burst", text: RAPID_TEXT, delayMs: RAPID_DELAY_MS },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function percentile(sortedValues, ratio) {
  if (!sortedValues.length) return 0;
  return sortedValues[Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * ratio))];
}

function stats(values) {
  const clean = values.map(Number).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const mean = clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
  const variance = clean.length > 1
    ? clean.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (clean.length - 1)
    : 0;
  return {
    count: clean.length,
    mean: round(mean),
    median: round(percentile(clean, 0.5)),
    p95: round(percentile(clean, 0.95)),
    max: round(clean[clean.length - 1] || 0),
    stdev: round(Math.sqrt(variance)),
  };
}

const WORD_BANK = [
  "steady", "notebook", "analysis", "chapter", "reader", "context", "method",
  "example", "system", "careful", "signal", "revision", "paragraph", "editor",
  "document", "evidence", "neutral", "design", "process", "detail", "section",
  "visible", "result", "measure", "structure", "typing", "browser", "layout",
  "selection", "content", "sample", "ordinary", "language", "record", "stable",
  "synthetic", "prose", "benchmark", "diagnostic", "fragment", "inline",
  "blank", "block", "render", "latency", "frame", "mutation", "attribute",
  "sequence", "position", "article", "draft", "summary", "finding", "control",
  "variant", "repeatable", "window", "style", "paint", "observe", "plain",
  "sentence", "reference", "however", "therefore", "because", "between"
];

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function words(count, offset = 0) {
  return Array.from({ length: count }, (_, index) => WORD_BANK[(index + offset) % WORD_BANK.length]);
}

function makeParagraphs(wordCount, paragraphCount, offset = 0) {
  const source = words(wordCount, offset);
  const paragraphs = [];
  let cursor = 0;
  for (let index = 0; index < paragraphCount; index += 1) {
    const remainingWords = source.length - cursor;
    const remainingParagraphs = paragraphCount - index;
    const length = Math.max(1, Math.floor(remainingWords / remainingParagraphs));
    const slice = source.slice(cursor, cursor + length);
    cursor += length;
    const sentences = [];
    for (let start = 0; start < slice.length; start += 12) {
      const sentence = slice.slice(start, start + 12).join(" ");
      sentences.push(sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".");
    }
    paragraphs.push(sentences.join(" "));
  }
  return paragraphs;
}

function documentHtml(title, body) {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    "  <meta charset=\"utf-8\">",
    `  <title>${escapeHtml(title)}</title>`,
    "  <style>body{font-family:Arial,sans-serif;line-height:1.55;max-width:820px;margin:32px auto;padding:0 24px;color:#242424}section{margin:0 0 18px}p{margin:0 0 10px}</style>",
    "</head>",
    "<body>",
    body,
    "</body>",
    "</html>",
  ].join("\n");
}

function cleanFixture() {
  const paragraphs = makeParagraphs(19960, 600, 0);
  const sections = [];
  for (let section = 0; section < 20; section += 1) {
    const sectionParagraphs = paragraphs.slice(section * 30, (section + 1) * 30)
      .map((paragraph, index) => {
        const paragraphIndex = section * 30 + index;
        return `<p data-nv-native-block="${paragraphIndex}"${paragraphIndex === 0 ? " id=\"typing-target\"" : ""}>${escapeHtml(paragraph)}</p>`;
      })
      .join("\n");
    sections.push(`<section data-nv-native-section="${section}">\n<h2>Section ${section + 1}</h2>\n${sectionParagraphs}\n</section>`);
  }
  return documentHtml("Clean native typing fixture", sections.join("\n"));
}

function fragmentedParts() {
  const paragraphs = makeParagraphs(20000, 600, 11);
  const parts = [];
  const normalized = [];
  let blockIndex = 0;
  let linkCount = 0;
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const tokens = paragraph.split(/\s+/).filter(Boolean);
    const normalizedText = [];
    for (let start = 0; start < tokens.length; start += 5) {
      const chunk = tokens.slice(start, start + 5).join(" ");
      normalizedText.push(chunk);
      let html = escapeHtml(chunk);
      if ((blockIndex + paragraphIndex) % 17 === 0) {
        html = `<span>${html}</span>`;
      } else if ((blockIndex + paragraphIndex) % 31 === 0) {
        html = `<span><span>${html}</span></span>`;
      } else if (linkCount < 18 && paragraphIndex > 0 && blockIndex % 211 === 0) {
        linkCount += 1;
        html = `<a href="https://example.com/native-${linkCount}">${html}</a>`;
      }
      parts.push(`<div class="" data-nv-native-block="${blockIndex}"${blockIndex === 0 ? " id=\"typing-target\"" : ""}>${html}</div>`);
      blockIndex += 1;
    }
    normalized.push({ type: "text", value: normalizedText.join(" ") });
    const blankCount = paragraphIndex % 5 === 0 ? 2 : paragraphIndex % 3 === 0 ? 1 : 0;
    for (let blank = 0; blank < blankCount; blank += 1) {
      parts.push("<div class=\"\"><br></div>");
      normalized.push({ type: "blank" });
    }
  });
  return { fragmentedBody: parts.join("\n"), normalized };
}

function fragmentedFixture() {
  return documentHtml("Fragmented native typing fixture", fragmentedParts().fragmentedBody);
}

function normalizedFragmentedFixture() {
  const normalized = fragmentedParts().normalized;
  let index = 0;
  const body = normalized.map((part) => {
    if (part.type === "blank") return "<p><br></p>";
    const attrs = `data-nv-native-block="${index}"${index === 0 ? " id=\"typing-target\"" : ""}`;
    index += 1;
    return `<p ${attrs}>${escapeHtml(part.value)}</p>`;
  }).join("\n");
  return documentHtml("Normalized fragmented native typing fixture", body);
}

function wordCount(text = "") {
  return (String(text).match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)?/g) || []).length;
}

function isBlankBlock($, node) {
  const tag = String(node.prop("tagName") || "").toLowerCase();
  if (!["div", "p"].includes(tag)) return false;
  const children = node.contents().toArray().filter((child) => child.type !== "text" || /\S/.test(child.data || ""));
  if (!children.length) return true;
  return children.length === 1 && children[0].type === "tag" && String(children[0].name || "").toLowerCase() === "br";
}

function structuralMetrics(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const body = $("body");
  const metrics = {
    wordCount: wordCount(body.text()),
    totalDomNodes: 0,
    elementCount: 0,
    textNodeCount: 0,
    emptyBlockCount: 0,
    divCount: $("div").length,
    spanCount: $("span").length,
    linkCount: $("a").length,
    paragraphCount: $("p").length,
    sectionCount: $("section").length,
    maximumDomDepth: 0,
  };
  function visit(node, depth) {
    if (!node) return;
    metrics.totalDomNodes += 1;
    metrics.maximumDomDepth = Math.max(metrics.maximumDomDepth, depth);
    if (node.type === "tag" || node.type === "script" || node.type === "style") {
      metrics.elementCount += 1;
      for (const child of node.children || []) visit(child, depth + 1);
    } else if (node.type === "text") {
      metrics.textNodeCount += 1;
    }
  }
  for (const child of body.contents().toArray()) visit(child, 1);
  $("div,p").each((_, el) => {
    if (isBlankBlock($, $(el))) metrics.emptyBlockCount += 1;
  });
  return metrics;
}

function buildFixtures() {
  fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
  const fixtureSpecs = [
    { id: "clean", label: "clean", html: cleanFixture() },
    { id: "fragmented", label: "fragmented", html: fragmentedFixture() },
    { id: "normalized-fragmented", label: "normalized-fragmented", html: normalizedFragmentedFixture() },
  ];
  return fixtureSpecs.map((fixture) => {
    const absPath = path.join(FIXTURE_ROOT, `${fixture.id}.html`);
    fs.writeFileSync(absPath, fixture.html, "utf8");
    return {
      ...fixture,
      relativePath: `__nv_html_native_typing/${fixture.id}.html`,
      absPath,
      metrics: structuralMetrics(fixture.html),
    };
  });
}

function writeHarness() {
  fs.writeFileSync(PUBLIC_HARNESS, [
    "<!doctype html>",
    "<html>",
    "<head><meta charset=\"utf-8\"><title>HTML Native Typing Harness</title></head>",
    "<body></body>",
    "</html>",
  ].join("\n"), "utf8");
}

async function waitFor(win, expression, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ok = await win.webContents.executeJavaScript(`Boolean(${expression})`, true).catch(() => false);
    if (ok) return true;
    await delay(50);
  }
  throw new Error("Timed out waiting for " + expression);
}

const rendererSetup = String.raw`
(() => {
  window.__nvHtmlTypingDiagnostics = true;
  window.__nvPerformanceDiagnostics = false;

  if (!window.__nvNativeTypingMetricPatch) {
    const metrics = {
      querySelectorAllCount: 0,
      querySelectorAllMs: 0,
      querySelectorAllSelectors: {},
      getComputedStyleCount: 0,
      getComputedStyleMs: 0,
      getBoundingClientRectCount: 0,
      getBoundingClientRectMs: 0,
      innerTextReadCount: 0,
      innerTextReadMs: 0,
      textContentReadCount: 0,
      textContentReadMs: 0,
      innerHTMLReadCount: 0,
      innerHTMLReadMs: 0,
      createTreeWalkerCount: 0,
      createTreeWalkerMs: 0,
      mutationObserverCallbackCount: 0,
      mutationObserverCallbackMs: 0,
      mutationRecordCount: 0,
      mutationRecordCharacterData: 0,
      mutationRecordChildList: 0,
      mutationRecordAttributes: 0,
      selectionChangeEventCount: 0,
      longTaskCount: 0,
      longTaskMs: 0,
      requestAnimationFrameScheduled: 0,
      requestAnimationFrameCallbacks: 0,
      layerHostMutationRecords: 0,
    };
    const round = (value) => Math.round(Number(value || 0) * 10) / 10;

    const qsaOriginal = Element.prototype.querySelectorAll;
    Element.prototype.querySelectorAll = function patchedQuerySelectorAll(selector) {
      const started = performance.now();
      try { return qsaOriginal.call(this, selector); }
      finally {
        metrics.querySelectorAllCount += 1;
        metrics.querySelectorAllMs = round(metrics.querySelectorAllMs + performance.now() - started);
        const key = String(selector || "").slice(0, 160);
        metrics.querySelectorAllSelectors[key] = (metrics.querySelectorAllSelectors[key] || 0) + 1;
      }
    };

    const gcsOriginal = window.getComputedStyle.bind(window);
    window.getComputedStyle = function patchedGetComputedStyle() {
      const started = performance.now();
      try { return gcsOriginal(...arguments); }
      finally {
        metrics.getComputedStyleCount += 1;
        metrics.getComputedStyleMs = round(metrics.getComputedStyleMs + performance.now() - started);
      }
    };

    const rectOriginal = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect() {
      const started = performance.now();
      try { return rectOriginal.apply(this, arguments); }
      finally {
        metrics.getBoundingClientRectCount += 1;
        metrics.getBoundingClientRectMs = round(metrics.getBoundingClientRectMs + performance.now() - started);
      }
    };

    function patchGetter(ownerStart, name, countKey, msKey) {
      let owner = ownerStart;
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
            metrics[msKey] = round(metrics[msKey] + performance.now() - started);
          }
        },
        set: descriptor.set ? function(value) { return descriptor.set.call(this, value); } : undefined,
      });
    }
    patchGetter(HTMLElement.prototype, "innerText", "innerTextReadCount", "innerTextReadMs");
    patchGetter(Node.prototype, "textContent", "textContentReadCount", "textContentReadMs");
    patchGetter(Element.prototype, "innerHTML", "innerHTMLReadCount", "innerHTMLReadMs");

    const treeWalkerOriginal = Document.prototype.createTreeWalker;
    Document.prototype.createTreeWalker = function patchedCreateTreeWalker() {
      const started = performance.now();
      try { return treeWalkerOriginal.apply(this, arguments); }
      finally {
        metrics.createTreeWalkerCount += 1;
        metrics.createTreeWalkerMs = round(metrics.createTreeWalkerMs + performance.now() - started);
      }
    };

    const rafOriginal = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      metrics.requestAnimationFrameScheduled += 1;
      return rafOriginal((timestamp) => {
        metrics.requestAnimationFrameCallbacks += 1;
        return callback(timestamp);
      });
    };

    const MutationObserverOriginal = window.MutationObserver;
    window.MutationObserver = function PatchedMutationObserver(callback) {
      return new MutationObserverOriginal((records, observer) => {
        const started = performance.now();
        metrics.mutationObserverCallbackCount += 1;
        metrics.mutationRecordCount += Number(records?.length || 0);
        for (const record of records || []) {
          if (record.type === "characterData") metrics.mutationRecordCharacterData += 1;
          else if (record.type === "childList") metrics.mutationRecordChildList += 1;
          else if (record.type === "attributes") metrics.mutationRecordAttributes += 1;
        }
        try { return callback(records, observer); }
        finally { metrics.mutationObserverCallbackMs = round(metrics.mutationObserverCallbackMs + performance.now() - started); }
      });
    };
    window.MutationObserver.prototype = MutationObserverOriginal.prototype;

    document.addEventListener("selectionchange", () => {
      metrics.selectionChangeEventCount += 1;
    }, true);

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          metrics.longTaskCount += 1;
          metrics.longTaskMs = round(metrics.longTaskMs + entry.duration);
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {}

    window.__nvNativeTypingMetricPatch = {
      metrics,
      reset() {
        for (const key of Object.keys(metrics)) metrics[key] = key === "querySelectorAllSelectors" ? {} : 0;
      },
      snapshot() {
        return JSON.parse(JSON.stringify(metrics));
      },
    };
  }

  function htmlBodyFromDocument(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    return doc.body?.innerHTML || "";
  }

  async function settleLayout() {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  function textBlocks(root) {
    return Array.from(root?.querySelectorAll?.("p,div,li,blockquote,h1,h2,h3") || [])
      .filter((el) => {
        if (el.closest?.("[contenteditable='false'],script,style")) return false;
        return String(el.textContent || "").trim().length >= 8;
      });
  }

  function rangeAtEndOfElement(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    return range;
  }

  function installBenchmarkProbe(root) {
    window.__nvNativeTypingProbeCleanup?.();
    const state = {
      expectedText: "",
      measuredText: "",
      mode: "",
      samples: [],
      mutationRecords: [],
      mutationSummary: {
        total: 0,
        characterData: 0,
        childList: 0,
        attributes: 0,
        addedNodes: 0,
        removedNodes: 0,
      },
    };
    const onBeforeInput = (event) => {
      if (!state.mode) return;
      state.samples.push({
        phase: "beforeinput",
        inputType: event.inputType || "",
        data: event.data || "",
        eventAt: performance.now(),
      });
    };
    const onInput = (event) => {
      if (!state.mode) return;
      const sample = {
        phase: "input",
        mode: state.mode,
        inputType: event.inputType || "",
        data: event.data || "",
        eventAt: performance.now(),
        firstRafMs: null,
        secondRafMs: null,
      };
      state.samples.push(sample);
      requestAnimationFrame(() => {
        sample.firstRafMs = Math.round((performance.now() - sample.eventAt) * 10) / 10;
        requestAnimationFrame(() => {
          sample.secondRafMs = Math.round((performance.now() - sample.eventAt) * 10) / 10;
        });
      });
    };
    const observer = new MutationObserver((records) => {
      state.mutationRecords.push(...records);
      for (const record of records || []) {
        state.mutationSummary.total += 1;
        if (record.type === "characterData") state.mutationSummary.characterData += 1;
        else if (record.type === "childList") {
          state.mutationSummary.childList += 1;
          state.mutationSummary.addedNodes += Number(record.addedNodes?.length || 0);
          state.mutationSummary.removedNodes += Number(record.removedNodes?.length || 0);
        } else if (record.type === "attributes") {
          state.mutationSummary.attributes += 1;
        }
      }
    });
    root.addEventListener("beforeinput", onBeforeInput, true);
    root.addEventListener("input", onInput, true);
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
    window.__nvNativeTypingState = state;
    window.__nvNativeTypingProbeCleanup = () => {
      root.removeEventListener("beforeinput", onBeforeInput, true);
      root.removeEventListener("input", onInput, true);
      observer.disconnect();
    };
  }

  window.__nvNativeMountNodevision = async ({ filePath, layers = false }) => {
    window.__nvNativeGraphicalLifecycle?.destroy?.();
    window.__nvNativeTypingProbeCleanup?.();
    window.__nvNativeLayersCleanup?.();
    window.__nvNativeLayerObserver?.disconnect?.();
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    const shell = document.createElement("div");
    shell.id = "native-typing-shell";
    shell.style.cssText = "display:grid;grid-template-columns:1fr " + (layers ? "280px" : "0") + ";gap:8px;width:1180px;height:820px;padding:8px;box-sizing:border-box";
    const cell = document.createElement("div");
    cell.className = "panel-cell active-panel";
    cell.dataset.id = "GraphicalEditor";
    cell.dataset.panelId = "GraphicalEditor";
    cell.dataset.panelClass = "EditorPanel";
    cell.style.cssText = "min-width:0;min-height:0;display:flex;border:1px solid #aaa";
    const layersHost = document.createElement("div");
    layersHost.id = "native-typing-layers-host";
    layersHost.style.cssText = layers ? "overflow:auto;border:1px solid #bbb;min-width:0" : "display:none";
    shell.append(cell, layersHost);
    document.body.appendChild(shell);
    window.activeCell = cell;
    window.activePanel = "GraphicalEditor";
    window.activePanelClass = "EditorPanel";
    const editor = await import("/PanelInstances/EditorPanels/GraphicalEditor.mjs?nativeTyping=" + Date.now());
    window.__nvNativeGraphicalLifecycle = await editor.setupPanel(cell, { filePath });
    await settleLayout();
    const wysiwyg = document.getElementById("wysiwyg");
    if (!wysiwyg) throw new Error("Nodevision WYSIWYG did not mount");
    if (layers && window.HTMLLayersContext?.attachHost) {
      window.__nvNativeLayersCleanup?.();
      window.__nvNativeLayersCleanup = window.HTMLLayersContext.attachHost(layersHost);
      const layerObserver = new MutationObserver((records) => {
        window.__nvNativeTypingMetricPatch.metrics.layerHostMutationRecords += Number(records?.length || 0);
      });
      layerObserver.observe(layersHost, { subtree: true, childList: true, characterData: true, attributes: true });
      window.__nvNativeLayerObserver = layerObserver;
    }
    installBenchmarkProbe(wysiwyg);
    return { mounted: true, rootId: "wysiwyg", layers };
  };

  window.__nvNativeMountBare = async ({ html }) => {
    window.__nvNativeGraphicalLifecycle?.destroy?.();
    window.__nvNativeTypingProbeCleanup?.();
    window.__nvNativeLayersCleanup?.();
    window.__nvNativeLayerObserver?.disconnect?.();
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    const style = document.createElement("style");
    style.id = "native-typing-bare-style";
    style.textContent = [
      "#wysiwyg{height:804px;width:1180px;box-sizing:border-box;overflow:auto;padding:12px;font-family:Arial,sans-serif;line-height:1.55;overflow-wrap:anywhere;word-break:break-word;border:1px solid #aaa}",
      "#wysiwyg:focus{outline:1px solid #777}",
      "#wysiwyg>section,#wysiwyg>article,#wysiwyg>main,#wysiwyg>aside,#wysiwyg>div{content-visibility:auto;contain-intrinsic-size:auto 96px}",
      "#wysiwyg>:focus-within{content-visibility:visible;contain-intrinsic-size:auto}"
    ].join("\n");
    document.head.appendChild(style);
    const host = document.createElement("div");
    host.id = "wysiwyg";
    host.contentEditable = "true";
    host.spellcheck = false;
    host.innerHTML = htmlBodyFromDocument(html);
    document.body.appendChild(host);
    installBenchmarkProbe(host);
    await settleLayout();
    return { mounted: true, rootId: "wysiwyg", layers: false };
  };

  window.__nvNativeSelectLocation = async (location) => {
    const root = document.getElementById("wysiwyg");
    if (!root) throw new Error("No editable root");
    const blocks = textBlocks(root);
    const index = location === "beginning" ? 0 : location === "middle" ? Math.floor(blocks.length / 2) : blocks.length - 1;
    const target = blocks[index] || root;
    const topLevel = target.closest?.("#wysiwyg > *") || target;
    topLevel.scrollIntoView({ block: "center", inline: "nearest" });
    await settleLayout();
    target.scrollIntoView({ block: "center", inline: "nearest" });
    await settleLayout();
    root.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(rangeAtEndOfElement(target));
    target.dataset.nvNativeTypingSelected = "true";
    window.__nvNativeTypingTarget = target;
    window.__nvNativeTypingBeforeText = target.textContent || "";
    await settleLayout();
    let rootRect = root.getBoundingClientRect();
    let targetRect = target.getBoundingClientRect();
    let targetVisible = targetRect.bottom >= rootRect.top && targetRect.top <= rootRect.bottom;
    if (!targetVisible) {
      root.scrollTop = Math.max(0, root.scrollTop + targetRect.top - rootRect.top - (root.clientHeight / 2));
      await settleLayout();
      rootRect = root.getBoundingClientRect();
      targetRect = target.getBoundingClientRect();
      targetVisible = targetRect.bottom >= rootRect.top && targetRect.top <= rootRect.bottom;
    }
    return {
      location,
      targetIndex: index,
      targetCount: blocks.length,
      tagName: target.tagName,
      id: target.id || "",
      textLength: Number((target.textContent || "").length),
      rootScrollTop: Math.round(root.scrollTop),
      rootScrollHeight: Math.round(root.scrollHeight),
      targetRect: {
        top: Math.round(targetRect.top),
        bottom: Math.round(targetRect.bottom),
        height: Math.round(targetRect.height),
      },
      rootRect: {
        top: Math.round(rootRect.top),
        bottom: Math.round(rootRect.bottom),
        height: Math.round(rootRect.height),
      },
      targetVisible,
    };
  };

  window.__nvNativeStartMeasuredText = (mode, text) => {
    const state = window.__nvNativeTypingState;
    state.mode = String(mode || "");
    state.measuredText = String(text || "");
    state.samples = [];
    state.mutationRecords = [];
    state.mutationSummary = {
      total: 0,
      characterData: 0,
      childList: 0,
      attributes: 0,
      addedNodes: 0,
      removedNodes: 0,
    };
  };

  window.__nvNativeStopMeasuredText = async () => {
    const state = window.__nvNativeTypingState;
    state.mode = "";
    await settleLayout();
    return true;
  };

  window.__nvNativeVerifyInsertion = () => {
    const target = window.__nvNativeTypingTarget;
    const state = window.__nvNativeTypingState;
    const before = String(window.__nvNativeTypingBeforeText || "");
    const measured = String(state?.measuredText || "");
    const current = String(target?.textContent || "");
    return {
      ok: Boolean(target && current.endsWith(measured) && current.startsWith(before)),
      expectedSuffix: measured,
      targetTagName: target?.tagName || "",
      targetId: target?.id || "",
      beforeLength: before.length,
      currentLength: current.length,
      suffix: current.slice(Math.max(0, current.length - measured.length - 8)),
    };
  };

  window.__nvNativeCollectFrames = async (durationMs = 1200) => {
    const frames = [];
    const started = performance.now();
    let previous = started;
    return await new Promise((resolve) => {
      const tick = (timestamp) => {
        frames.push(timestamp - previous);
        previous = timestamp;
        if (timestamp - started >= durationMs) {
          const sorted = frames.slice().sort((a, b) => a - b);
          const avg = frames.length ? frames.reduce((sum, value) => sum + value, 0) / frames.length : 0;
          const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
          const worst = sorted.length ? sorted[sorted.length - 1] : 0;
          resolve({
            frames: frames.length,
            averageFrameMs: Math.round(avg * 10) / 10,
            p95FrameMs: Math.round(p95 * 10) / 10,
            worstFrameMs: Math.round(worst * 10) / 10,
            droppedFrames: frames.filter((value) => value > 33.4).length,
            longFrames: frames.filter((value) => value > 50).length,
            fps: Math.round((1000 / Math.max(avg, 1)) * 10) / 10,
          });
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };

  window.__nvNativePassSnapshot = () => {
    const state = window.__nvNativeTypingState || {};
    const samples = (state.samples || []).filter((sample) => sample.phase === "input");
    const first = samples.map((sample) => Number(sample.firstRafMs || 0)).filter((value) => value > 0);
    const second = samples.map((sample) => Number(sample.secondRafMs || 0)).filter((value) => value > 0);
    const sort = (values) => values.slice().sort((a, b) => a - b);
    const firstSorted = sort(first);
    const secondSorted = sort(second);
    const sampleStats = (values) => {
      const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      return {
        count: values.length,
        mean: Math.round(mean * 10) / 10,
        median: Math.round((values[Math.min(values.length - 1, Math.floor(values.length * 0.5))] || 0) * 10) / 10,
        p95: Math.round((values[Math.min(values.length - 1, Math.floor(values.length * 0.95))] || 0) * 10) / 10,
        max: Math.round((values[values.length - 1] || 0) * 10) / 10,
      };
    };
    return {
      nativeInputCount: samples.length,
      inputToFirstAnimationFrame: sampleStats(firstSorted),
      inputToSecondAnimationFrame: sampleStats(secondSorted),
      mutationSummary: state.mutationSummary || {},
      metrics: window.__nvNativeTypingMetricPatch.snapshot(),
      nodevisionTypingCounters: window.__nvHtmlTypingLatency?.counters || {},
      nodevisionTypingSampleCount: Number((window.__nvHtmlTypingLatency?.samples || []).filter((sample) => sample.phase === "input").length),
    };
  };
})();
`;

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
    if (/native typing|Failed|Error/i.test(String(message || ""))) {
      console.log("[renderer]", message);
    }
  });
  return win;
}

async function prepareWindow(win, runtimeUrl) {
  writeHarness();
  await win.loadURL(runtimeUrl + "/__html-native-typing-harness.html");
  await win.webContents.executeJavaScript(
    `fetch("/api/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "admin" }) }).then(r => r.json())`,
    true
  );
  await win.loadURL(runtimeUrl + "/__html-native-typing-harness.html");
  await waitFor(win, "document.readyState === 'complete'");
  await win.webContents.executeJavaScript(rendererSetup, true);
}

async function mountConfig(win, fixture, config) {
  if (config.kind === "bare") {
    return await win.webContents.executeJavaScript(
      `window.__nvNativeMountBare(${JSON.stringify({ html: fixture.html })})`,
      true
    );
  }
  return await win.webContents.executeJavaScript(
    `window.__nvNativeMountNodevision(${JSON.stringify({ filePath: fixture.relativePath, layers: config.layers })})`,
    true
  );
}

async function sendNativeText(win, text, delayMs) {
  for (const character of String(text || "")) {
    win.webContents.sendInputEvent({ type: "char", keyCode: character });
    if (delayMs > 0) await delay(delayMs);
  }
}

async function runPass(win, fixture, config, location, mode, repetition) {
  console.log(`[native typing] ${fixture.id} ${config.id} ${location} ${mode.id} pass ${repetition + 1}/${REPETITIONS}`);
  const mount = await mountConfig(win, fixture, config);
  const selection = await win.webContents.executeJavaScript(
    `window.__nvNativeSelectLocation(${JSON.stringify(location)})`,
    true
  );
  if (!selection.targetVisible) throw new Error(`${fixture.id} ${location} target was not visible after scroll`);

  await win.webContents.executeJavaScript(`window.__nvNativeStartMeasuredText("warmup", ${JSON.stringify(WARMUP_TEXT)})`, true);
  await sendNativeText(win, WARMUP_TEXT, 8);
  await win.webContents.executeJavaScript("window.__nvNativeStopMeasuredText()", true);
  const warmupVerification = await win.webContents.executeJavaScript("window.__nvNativeVerifyInsertion()", true);
  if (!warmupVerification.ok) throw new Error(`${fixture.id} ${config.id} ${location} warmup insertion verification failed`);

  await win.webContents.executeJavaScript("window.__nvNativeTypingBeforeText = window.__nvNativeTypingTarget.textContent || ''; window.__nvNativeTypingMetricPatch.reset(); window.__nvHtmlTypingLatency = { samples: [], mutationBatches: [], counters: {} };", true);
  const duration = Math.max(900, mode.text.length * Math.max(12, mode.delayMs + 8) + 450);
  const framesPromise = win.webContents.executeJavaScript(`window.__nvNativeCollectFrames(${JSON.stringify(duration)})`, true);
  await win.webContents.executeJavaScript(`window.__nvNativeStartMeasuredText(${JSON.stringify(mode.id)}, ${JSON.stringify(mode.text)})`, true);
  await sendNativeText(win, mode.text, mode.delayMs);
  await win.webContents.executeJavaScript("window.__nvNativeStopMeasuredText()", true);
  const frames = await framesPromise;
  const verification = await win.webContents.executeJavaScript("window.__nvNativeVerifyInsertion()", true);
  if (!verification.ok) throw new Error(`${fixture.id} ${config.id} ${location} ${mode.id} insertion verification failed`);
  const snapshot = await win.webContents.executeJavaScript("window.__nvNativePassSnapshot()", true);
  if (snapshot.nativeInputCount !== mode.text.length) {
    throw new Error(`${fixture.id} ${config.id} ${location} ${mode.id} expected ${mode.text.length} native inputs, saw ${snapshot.nativeInputCount}`);
  }
  return {
    fixtureId: fixture.id,
    fixtureLabel: fixture.label,
    configId: config.id,
    configLabel: config.label,
    location,
    mode: mode.id,
    repetition: repetition + 1,
    typedCharacters: mode.text.length,
    delayMs: mode.delayMs,
    mount,
    selection,
    warmupVerification,
    verification,
    fixtureMetrics: fixture.metrics,
    frames,
    ...snapshot,
  };
}

function groupKey(pass, fields) {
  return fields.map((field) => pass[field]).join("|");
}

function aggregatePasses(passes) {
  const groups = new Map();
  for (const pass of passes) {
    const key = groupKey(pass, ["fixtureId", "configId", "location", "mode"]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(pass);
  }
  return Array.from(groups.values()).map((items) => {
    const first = items[0];
    return {
      fixtureId: first.fixtureId,
      configId: first.configId,
      location: first.location,
      mode: first.mode,
      repetitions: items.length,
      typedCharacters: first.typedCharacters,
      fixtureMetrics: first.fixtureMetrics,
      inputToFirstAnimationFrame: stats(items.flatMap((item) => item.inputToFirstAnimationFrame.count ? [item.inputToFirstAnimationFrame.mean] : [])),
      inputToSecondAnimationFrame: stats(items.flatMap((item) => item.inputToSecondAnimationFrame.count ? [item.inputToSecondAnimationFrame.mean] : [])),
      sampleSecondRafP95: stats(items.map((item) => item.inputToSecondAnimationFrame.p95)),
      rapidTypingFps: stats(items.map((item) => item.frames.fps)),
      droppedFrames: stats(items.map((item) => item.frames.droppedFrames)),
      longTasks: stats(items.map((item) => item.metrics.longTaskCount)),
      longTaskMs: stats(items.map((item) => item.metrics.longTaskMs)),
      mutationObserverCallbacks: stats(items.map((item) => item.metrics.mutationObserverCallbackCount)),
      mutationRecords: stats(items.map((item) => item.metrics.mutationRecordCount)),
      selectionChanges: stats(items.map((item) => item.metrics.selectionChangeEventCount)),
      querySelectorAll: stats(items.map((item) => item.metrics.querySelectorAllCount)),
      querySelectorAllMs: stats(items.map((item) => item.metrics.querySelectorAllMs)),
      getComputedStyle: stats(items.map((item) => item.metrics.getComputedStyleCount)),
      getComputedStyleMs: stats(items.map((item) => item.metrics.getComputedStyleMs)),
      getBoundingClientRect: stats(items.map((item) => item.metrics.getBoundingClientRectCount)),
      getBoundingClientRectMs: stats(items.map((item) => item.metrics.getBoundingClientRectMs)),
      innerTextReads: stats(items.map((item) => item.metrics.innerTextReadCount)),
      innerTextReadMs: stats(items.map((item) => item.metrics.innerTextReadMs)),
      textContentReads: stats(items.map((item) => item.metrics.textContentReadCount)),
      textContentReadMs: stats(items.map((item) => item.metrics.textContentReadMs)),
      innerHTMLReads: stats(items.map((item) => item.metrics.innerHTMLReadCount)),
      innerHTMLReadMs: stats(items.map((item) => item.metrics.innerHTMLReadMs)),
      createTreeWalker: stats(items.map((item) => item.metrics.createTreeWalkerCount)),
      createTreeWalkerMs: stats(items.map((item) => item.metrics.createTreeWalkerMs)),
      mutationObserverCallbackMs: stats(items.map((item) => item.metrics.mutationObserverCallbackMs)),
      nodevisionTypingCounters: items.reduce((merged, item) => {
        for (const [key, value] of Object.entries(item.nodevisionTypingCounters || {})) {
          merged[key] = Number(merged[key] || 0) + Number(value || 0);
        }
        return merged;
      }, {}),
    };
  });
}

function pearson(rows, xKey, yKey) {
  const points = rows.map((row) => [Number(row.fixtureMetrics?.[xKey] || 0), Number(row[yKey]?.mean || 0)])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (points.length < 3) return 0;
  const xMean = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const yMean = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;
  for (const [x, y] of points) {
    numerator += (x - xMean) * (y - yMean);
    xDenominator += (x - xMean) ** 2;
    yDenominator += (y - yMean) ** 2;
  }
  const denominator = Math.sqrt(xDenominator * yDenominator);
  return denominator ? round(numerator / denominator, 3) : 0;
}

function averageRatio(aggregates, numeratorConfig, denominatorConfig) {
  const ratios = [];
  for (const row of aggregates.filter((item) => item.configId === numeratorConfig)) {
    const baseline = aggregates.find((item) =>
      item.fixtureId === row.fixtureId &&
      item.location === row.location &&
      item.mode === row.mode &&
      item.configId === denominatorConfig
    );
    if (!baseline || !baseline.inputToSecondAnimationFrame.mean) continue;
    ratios.push(row.inputToSecondAnimationFrame.mean / baseline.inputToSecondAnimationFrame.mean);
  }
  return stats(ratios);
}

function averageFixtureRatio(aggregates, numeratorFixture, denominatorFixture, configId = "bare-contenteditable") {
  const ratios = [];
  for (const row of aggregates.filter((item) => item.fixtureId === numeratorFixture && item.configId === configId)) {
    const baseline = aggregates.find((item) =>
      item.fixtureId === denominatorFixture &&
      item.configId === configId &&
      item.location === row.location &&
      item.mode === row.mode
    );
    if (!baseline || !baseline.inputToSecondAnimationFrame.mean) continue;
    ratios.push(row.inputToSecondAnimationFrame.mean / baseline.inputToSecondAnimationFrame.mean);
  }
  return stats(ratios);
}

function hottestOperations(aggregates) {
  const totals = {
    querySelectorAllMs: 0,
    getComputedStyleMs: 0,
    getBoundingClientRectMs: 0,
    innerTextReadMs: 0,
    textContentReadMs: 0,
    innerHTMLReadMs: 0,
    mutationObserverCallbackMs: 0,
    longTaskMs: 0,
  };
  for (const pass of aggregates) {
    totals.querySelectorAllMs += pass.querySelectorAllMs.mean;
    totals.getComputedStyleMs += pass.getComputedStyleMs.mean;
    totals.getBoundingClientRectMs += pass.getBoundingClientRectMs.mean;
    totals.innerTextReadMs += pass.innerTextReadMs.mean;
    totals.textContentReadMs += pass.textContentReadMs.mean;
    totals.innerHTMLReadMs += pass.innerHTMLReadMs.mean;
    totals.mutationObserverCallbackMs += pass.mutationObserverCallbackMs.mean;
    totals.longTaskMs += pass.longTaskMs.mean;
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, totalMs]) => ({ name, totalMs: round(totalMs) }));
}

function summarizeDecisions(aggregates) {
  const bareFragmentedRatio = averageFixtureRatio(aggregates, "fragmented", "clean", "bare-contenteditable");
  const fullOverBare = averageRatio(aggregates, "nodevision-layers-hidden", "bare-contenteditable");
  const layersOverHidden = averageRatio(aggregates, "nodevision-layers-visible", "nodevision-layers-hidden");
  const normalizedOverFragmented = averageFixtureRatio(aggregates, "normalized-fragmented", "fragmented", "bare-contenteditable");
  const endOverBeginning = [];
  for (const row of aggregates.filter((item) => item.location === "end")) {
    const beginning = aggregates.find((item) =>
      item.fixtureId === row.fixtureId &&
      item.configId === row.configId &&
      item.mode === row.mode &&
      item.location === "beginning"
    );
    if (beginning?.inputToSecondAnimationFrame.mean) {
      endOverBeginning.push(row.inputToSecondAnimationFrame.mean / beginning.inputToSecondAnimationFrame.mean);
    }
  }

  let recommendation = "Treat the result as inconclusive and rerun with more repetitions before changing production code.";
  if (bareFragmentedRatio.mean >= 1.25 && normalizedOverFragmented.mean <= 0.9) {
    recommendation = "Prototype a conservative document-normalization feature for redundant blank divs and short wrapper blocks.";
  } else if (fullOverBare.mean >= 1.25) {
    recommendation = "Run the next follow-up with Nodevision listener groups toggled individually, starting with live provider, selection tracking, and Layers observers.";
  } else if (layersOverHidden.mean >= 1.2) {
    recommendation = "Isolate the Layers render path by measuring collectLayers/render scheduling around ordinary text input.";
  } else if (stats(endOverBeginning).mean >= 1.2) {
    recommendation = "Investigate caret position, scroll extent, and content-visibility containment before DOM cleanup work.";
  }

  return {
    bareFragmentedOverClean: bareFragmentedRatio,
    nodevisionHiddenOverBare: fullOverBare,
    layersVisibleOverHidden: layersOverHidden,
    normalizedFragmentedOverFragmented: normalizedOverFragmented,
    endOverBeginning: stats(endOverBeginning),
    recommendation,
  };
}

function makeMarkdownReport(report) {
  const rows = report.aggregates
    .map((row) => `| ${row.fixtureId} | ${row.configId} | ${row.location} | ${row.mode} | ${row.inputToSecondAnimationFrame.mean} | ${row.sampleSecondRafP95.mean} | ${row.rapidTypingFps.mean} | ${row.droppedFrames.mean} | ${row.longTaskMs.mean} |`)
    .join("\n");
  const correlations = report.correlations
    .map((item) => `- ${item.metric}: r=${item.r}`)
    .join("\n");
  const hot = report.hottestOperations
    .map((item) => `- ${item.name}: ${item.totalMs} ms aggregate`)
    .join("\n");
  return [
    "# HTML Native Typing Benchmark",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "All documents are deterministic synthetic fixtures generated by this benchmark. No real user document content is read.",
    "",
    "## Comparison Table",
    "",
    "| Fixture | Config | Caret | Mode | Mean 2nd rAF ms | Mean p95 2nd rAF ms | FPS | Dropped frames | Long task ms |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
    rows,
    "",
    "## Correlations",
    "",
    correlations || "- No correlations available.",
    "",
    "## Decision Summary",
    "",
    `- Fragmented vs clean in bare contenteditable: ${report.decisions.bareFragmentedOverClean.mean}x mean second-rAF latency.`,
    `- Nodevision hidden-Layers over bare: ${report.decisions.nodevisionHiddenOverBare.mean}x.`,
    `- Layers visible over hidden: ${report.decisions.layersVisibleOverHidden.mean}x.`,
    `- Normalized-fragmented over fragmented in bare contenteditable: ${report.decisions.normalizedFragmentedOverFragmented.mean}x.`,
    `- End over beginning: ${report.decisions.endOverBeginning.mean}x.`,
    "",
    "## Hottest Observed Operations",
    "",
    hot || "- None recorded.",
    "",
    "## Recommended Next Change",
    "",
    report.decisions.recommendation,
    "",
    "## Environment",
    "",
    `- Electron: ${report.environment.electron}`,
    `- Chromium: ${report.environment.chrome}`,
    `- Node: ${report.environment.node}`,
    `- Platform: ${report.environment.platform} ${report.environment.release} ${report.environment.arch}`,
  ].join("\n");
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
      for (const config of CONFIGS) {
        for (const location of LOCATIONS) {
          for (const mode of MODES) {
            for (let repetition = 0; repetition < REPETITIONS; repetition += 1) {
              passes.push(await runPass(win, fixture, config, location, mode, repetition));
            }
          }
        }
      }
    }
  } finally {
    try { win.close(); } catch {}
    await runtimeController.stop().catch(() => {});
  }

  const aggregates = aggregatePasses(passes);
  const correlationMetrics = ["totalDomNodes", "elementCount", "textNodeCount", "emptyBlockCount", "divCount", "spanCount", "maximumDomDepth"];
  const correlations = correlationMetrics
    .map((metric) => ({ metric, r: pearson(aggregates, metric, "inputToSecondAnimationFrame") }))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  const report = {
    generatedAt: new Date().toISOString(),
    note: "Synthetic benchmark only. Fixtures are generated under Notebook/__nv_html_native_typing during the run and then removed.",
    configuration: {
      repetitions: REPETITIONS,
      locations: LOCATIONS,
      configs: CONFIGS.map(({ id, label }) => ({ id, label })),
      modes: MODES.map(({ id, label, delayMs, text }) => ({ id, label, delayMs, typedCharacters: text.length })),
      warmupCharacters: WARMUP_TEXT.length,
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
    fixtures: fixtures.map(({ id, label, relativePath, metrics }) => ({ id, label, relativePath, metrics })),
    passes,
    aggregates,
    correlations,
    hottestOperations: hottestOperations(aggregates),
    decisions: summarizeDecisions(aggregates),
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
      passCount: report.passes.length,
      aggregateCount: report.aggregates.length,
      recommendation: report.decisions.recommendation,
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
