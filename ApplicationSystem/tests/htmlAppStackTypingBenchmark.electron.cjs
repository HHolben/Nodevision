// Nodevision/ApplicationSystem/tests/htmlAppStackTypingBenchmark.electron.cjs
// Synthetic full-app-shell typing benchmark for the graphical HTML editor.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const cheerio = require("cheerio");
const { app, BrowserWindow } = require("electron");

const ROOT = process.cwd();
const PORT = Number(process.env.NODEVISION_HTML_APP_STACK_TYPING_PORT || 39483);
const FIXTURE_ROOT = path.join(ROOT, "Notebook", "__nv_html_app_stack_typing");
const PUBLIC_HARNESS = path.join(ROOT, "ApplicationSystem/public/__html-app-stack-typing-harness.html");
const JSON_REPORT_PATH = process.env.NODEVISION_HTML_APP_STACK_TYPING_REPORT ||
  path.join(ROOT, "ApplicationSystem/tests/htmlAppStackTypingBenchmark.report.json");
const MARKDOWN_REPORT_PATH = process.env.NODEVISION_HTML_APP_STACK_TYPING_MD ||
  path.join(ROOT, "ApplicationSystem/tests/htmlAppStackTypingBenchmark.report.md");
const REPETITIONS = Math.max(1, Number(process.env.NODEVISION_HTML_APP_STACK_TYPING_REPETITIONS || 1));
const FRAME_DURATION_MS = Math.max(600, Number(process.env.NODEVISION_HTML_APP_STACK_TYPING_FRAME_MS || 1200));
const LIFECYCLE_CHECKPOINTS = String(process.env.NODEVISION_HTML_APP_STACK_TYPING_LIFECYCLE || "0,5,20,50,100")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0)
  .sort((a, b) => a - b);
const RUN_TAB_CHURN = process.env.NODEVISION_HTML_APP_STACK_TYPING_TAB_CHURN === "1";

const TEXTS = {
  single: "x",
  ten: "abcdefghij",
  rapid: "rapidnativeinputburstrapidnativeinputburst",
};

const MODES = [
  { id: "single", label: "Single char", text: TEXTS.single, delayMs: 0 },
  { id: "ten", label: "10-char burst", text: TEXTS.ten, delayMs: 0 },
  { id: "rapid", label: "Rapid batch", text: TEXTS.rapid, delayMs: 0 },
];

const CONFIGS = [
  { id: "bare-contenteditable", label: "Bare contenteditable", kind: "bare" },
  { id: "bare-nodevision-css", label: "Bare editable + Nodevision CSS", kind: "bare", nodevisionCss: true },
  { id: "bare-editor-scaffold", label: "Bare editable in editor scaffold", kind: "bare", editorScaffold: true },
  { id: "html-direct-cleaned", label: "HTML editor DOM after cleanup", kind: "html-direct", cleanupMode: "all" },
  { id: "html-direct-no-diagnostics", label: "HTML editor minus diagnostics", kind: "html-direct", cleanupMode: "diagnostics" },
  { id: "html-direct-no-selection", label: "HTML editor minus selection sync", kind: "html-direct", cleanupMode: "selection" },
  { id: "html-direct-no-text-wrapping", label: "HTML editor minus text wrapping", kind: "html-direct", cleanupMode: "textWrapping" },
  { id: "html-direct-no-observers", label: "HTML editor minus extra observers", kind: "html-direct", cleanupMode: "observers" },
  { id: "html-direct-full", label: "HTML editor direct full runtime", kind: "html-direct", cleanupMode: "none" },
  { id: "graphical-only", label: "Graphical editor only", kind: "graphical", layers: "detached" },
  { id: "graphical-empty-side-panel", label: "Graphical editor + empty side panel", kind: "graphical", layers: "empty" },
  { id: "graphical-layers-visible", label: "Graphical editor + Layers visible", kind: "graphical", layers: "visible" },
  { id: "graphical-layers-hidden", label: "Graphical editor + Layers hidden", kind: "graphical", layers: "hidden" },
  { id: "graphical-graphmanager", label: "Graphical editor + GraphManager", kind: "graphical", layers: "detached", graphManager: true },
  { id: "graphical-layers-graphmanager", label: "Graphical editor + Layers + GraphManager", kind: "graphical", layers: "visible", graphManager: true },
  { id: "full-workspace", label: "Full representative workspace", kind: "workspace", layers: "visible", stressTabs: 0 },
  { id: "multi-panel-stress", label: "Multiple-panel/tab stress", kind: "workspace", layers: "visible", stressTabs: 6 },
];

function envFilter(name) {
  const raw = String(process.env[name] || "").trim();
  if (!raw) return null;
  return new Set(raw.split(",").map((value) => value.trim()).filter(Boolean));
}

function matchesFilter(item, filter) {
  return !filter || filter.has(item.id);
}

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

function stats(values, digits = 1) {
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

function sumObjectValues(object = {}) {
  return Object.values(object || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function topEntries(object = {}, limit = 12) {
  return Object.entries(object || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, limit)
    .map(([key, value]) => ({ key, value: round(value) }));
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
        return `<p data-nv-app-stack-block="${paragraphIndex}"${paragraphIndex === 0 ? " id=\"typing-target\"" : ""}>${escapeHtml(paragraph)}</p>`;
      })
      .join("\n");
    sections.push(`<section data-nv-app-stack-section="${section}">\n<h2>Section ${section + 1}</h2>\n${sectionParagraphs}\n</section>`);
  }
  return documentHtml("Clean app-stack typing fixture", sections.join("\n"));
}

function fragmentedFixture(chunkSize = 5, title = "Fragmented app-stack typing fixture") {
  const paragraphs = makeParagraphs(20000, 600, 11);
  const parts = [];
  let blockIndex = 0;
  let linkCount = 0;
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const tokens = paragraph.split(/\s+/).filter(Boolean);
    for (let start = 0; start < tokens.length; start += chunkSize) {
      const chunk = tokens.slice(start, start + chunkSize).join(" ");
      let html = escapeHtml(chunk);
      if ((blockIndex + paragraphIndex) % 17 === 0) {
        html = `<span>${html}</span>`;
      } else if ((blockIndex + paragraphIndex) % 31 === 0) {
        html = `<span><span>${html}</span></span>`;
      } else if (linkCount < 18 && paragraphIndex > 0 && blockIndex % 211 === 0) {
        linkCount += 1;
        html = `<a href=\"https://example.com/app-stack-${linkCount}\">${html}</a>`;
      }
      parts.push(`<div class=\"\" data-nv-app-stack-block="${blockIndex}"${blockIndex === 0 ? " id=\"typing-target\"" : ""}>${html}</div>`);
      blockIndex += 1;
    }
    const blankCount = paragraphIndex % 5 === 0 ? 2 : paragraphIndex % 3 === 0 ? 1 : 0;
    for (let blank = 0; blank < blankCount; blank += 1) parts.push("<div class=\"\"><br></div>");
  });
  return documentHtml(title, parts.join("\n"));
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

function writeSyntheticGraphNotebook() {
  const html = (title, body) => documentHtml(title, body);
  fs.mkdirSync(path.join(FIXTURE_ROOT, "graph-alpha"), { recursive: true });
  fs.mkdirSync(path.join(FIXTURE_ROOT, "graph-beta"), { recursive: true });
  fs.mkdirSync(path.join(FIXTURE_ROOT, "assets"), { recursive: true });
  fs.writeFileSync(path.join(FIXTURE_ROOT, "index.html"), html("Synthetic graph index", [
    "<h1>Synthetic Graph Index</h1>",
    "<p><a href=\"clean.html\">Clean fixture</a> and <a href=\"fragmented.html\">fragmented fixture</a>.</p>",
    "<p><a href=\"graph-alpha/topic-a.html\">Topic A</a> links to <a href=\"graph-beta/topic-b.html\">Topic B</a>.</p>",
    "<img src=\"assets/synthetic-preview.svg\" alt=\"Synthetic preview\">"
  ].join("\n")), "utf8");
  fs.writeFileSync(path.join(FIXTURE_ROOT, "references.html"), html("Synthetic references", [
    "<p><a href=\"index.html\">Index</a></p>",
    "<p><a href=\"graph-alpha/topic-a.html#section-one\">Topic A section</a></p>",
    "<img src=\"assets/synthetic-preview.svg\" alt=\"Local src relation\">"
  ].join("\n")), "utf8");
  fs.writeFileSync(path.join(FIXTURE_ROOT, "graph-alpha", "topic-a.html"), html("Synthetic topic A", "<h1 id=\"section-one\">Topic A</h1><p><a href=\"../graph-beta/topic-b.html\">Topic B</a></p>"), "utf8");
  fs.writeFileSync(path.join(FIXTURE_ROOT, "graph-beta", "topic-b.html"), html("Synthetic topic B", "<h1>Topic B</h1><p><a href=\"../references.html\">References</a></p>"), "utf8");
  fs.writeFileSync(path.join(FIXTURE_ROOT, "assets", "synthetic-preview.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"64\" height=\"64\"><rect width=\"64\" height=\"64\" fill=\"#cfe8ff\"/><circle cx=\"32\" cy=\"32\" r=\"18\" fill=\"#2f6fed\"/></svg>\n", "utf8");
}

function syntheticGraphMetrics() {
  const root = FIXTURE_ROOT;
  const metrics = { directories: 0, files: 0, htmlFiles: 0, svgFiles: 0 };
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        metrics.directories += 1;
        visit(abs);
      } else if (entry.isFile()) {
        metrics.files += 1;
        if (entry.name.endsWith(".html")) metrics.htmlFiles += 1;
        if (entry.name.endsWith(".svg")) metrics.svgFiles += 1;
      }
    }
  }
  if (fs.existsSync(root)) visit(root);
  return metrics;
}

function buildFixtures() {
  fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
  const fixtureSpecs = [
    { id: "clean", label: "Clean 20k", html: cleanFixture() },
    { id: "moderate", label: "Moderately fragmented 20k", html: fragmentedFixture(20, "Moderately fragmented app-stack typing fixture") },
    { id: "fragmented", label: "Fragmented 20k", html: fragmentedFixture() },
    { id: "heavy", label: "Heavily fragmented 20k", html: fragmentedFixture(3, "Heavily fragmented app-stack typing fixture") },
  ];
  const fixtures = fixtureSpecs.map((fixture) => {
    const absPath = path.join(FIXTURE_ROOT, `${fixture.id}.html`);
    fs.writeFileSync(absPath, fixture.html, "utf8");
    return {
      ...fixture,
      relativePath: `__nv_html_app_stack_typing/${fixture.id}.html`,
      absPath,
      metrics: structuralMetrics(fixture.html),
    };
  });
  writeSyntheticGraphNotebook();
  return fixtures;
}

function writeHarness() {
  fs.writeFileSync(PUBLIC_HARNESS, [
    "<!doctype html>",
    "<html>",
    "<head><meta charset=\"utf-8\"><title>HTML App Stack Typing Harness</title>",
    "<link rel=\"stylesheet\" href=\"/Stylesheets/GraphStyles.css\">",
    "<script src=\"/vendor/cytoscape/cytoscape.min.js\"></script>",
    "<script src=\"/vendor/layout-base/layout-base.js\"></script>",
    "<script src=\"/vendor/cose-base/cose-base.js\"></script>",
    "<script src=\"/vendor/cytoscape-fcose/cytoscape-fcose.js\"></script>",
    "<script src=\"/vendor/cytoscape-expand-collapse/cytoscape-expand-collapse.js\"></script>",
    "</head>",
    "<body></body>",
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

const rendererSetup = String.raw`
(() => {
  window.__nvHtmlTypingDiagnostics = true;
  window.__nvPerformanceDiagnostics = true;

  if (!window.__nvAppStackTypingMetrics) {
    const round = (value) => Math.round(Number(value || 0) * 10) / 10;
    const now = () => performance.now();
    const store = {
      active: false,
      listenerSeq: 0,
      observerSeq: 0,
      listeners: [],
      observers: [],
      timers: new Map(),
      rafs: new Set(),
      counters: {},
      timings: {},
      longTasks: [],
      layerHostMutationRecords: 0,
      currentOwnerOverride: "",
    };
    const metrics = {
      eventInvocations: {},
      eventTimingMs: {},
      eventWorstMs: {},
      customDispatches: {},
      mutationObserverCallbacks: {},
      mutationObserverTimingMs: {},
      mutationObserverWorstMs: {},
      mutationRecords: {},
      mutationRecordTypes: {},
      querySelectorAll: {},
      getComputedStyle: {},
      getBoundingClientRect: {},
      getClientRects: {},
      scrollIntoView: {},
      focusCalls: {},
      createTreeWalker: {},
      innerTextReads: {},
      textContentReads: {},
      innerHTMLReads: {},
      offsetWidthReads: {},
      offsetHeightReads: {},
      clientWidthReads: {},
      clientHeightReads: {},
      scrollWidthReads: {},
      scrollHeightReads: {},
      domOperationCalls: {},
      domOperationMs: {},
      layoutOperationCalls: {},
      layoutOperationMs: {},
      timeoutScheduled: {},
      timeoutFired: {},
      rafScheduled: {},
      rafFired: {},
    };

    const layoutOperationBuckets = new Set(["getComputedStyle", "getBoundingClientRect", "getClientRects", "scrollIntoView", "focusCalls", "offsetWidthReads", "offsetHeightReads", "clientWidthReads", "clientHeightReads", "scrollWidthReads", "scrollHeightReads"]);

    function bump(bucket, key, amount = 1) {
      bucket[key] = round(Number(bucket[key] || 0) + amount);
    }

    function addTiming(bucket, worstBucket, key, ms) {
      bump(bucket, key, ms);
      worstBucket[key] = round(Math.max(Number(worstBucket[key] || 0), Number(ms || 0)));
    }

    function capture(options) {
      if (typeof options === "boolean") return options;
      return Boolean(options && options.capture);
    }

    function targetId(target) {
      if (target === window) return "window";
      if (target === document) return "document";
      if (target?.nodeType === Node.DOCUMENT_NODE) return "document";
      if (target?.nodeType === Node.TEXT_NODE) return targetId(target.parentElement);
      if (target?.id) return "#" + target.id;
      const cell = target?.closest?.(".panel-cell");
      if (cell?.dataset?.panelId || cell?.dataset?.id) return ".panel-cell:" + (cell.dataset.panelId || cell.dataset.id);
      const tab = target?.closest?.(".nv-panel-tab-content");
      if (tab?.dataset?.nvPanelType) return ".tab:" + tab.dataset.nvPanelType;
      if (target?.classList?.length) return "." + Array.from(target.classList).slice(0, 3).join(".");
      return String(target?.tagName || target?.nodeName || "unknown").toLowerCase();
    }

    function targetCategory(target, fallback = "unknown") {
      if (target === window) return "window";
      if (target === document || target?.nodeType === Node.DOCUMENT_NODE) return "document";
      if (target?.isConnected === false) return "detached-dom";
      if (target?.id === "workspace" || target?.closest?.("#workspace")) return "workspace";
      if (target?.id === "graphical-editor" || target?.closest?.("#graphical-editor")) return "editor-host";
      if (target?.id === "wysiwyg" || target?.closest?.("#wysiwyg")) return "html-editor";
      if (target?.id === "cy" || target?.closest?.("#cy,.graph-manager")) return "graph-manager";
      if (target?.closest?.("#app-stack-layers-host,[data-nv-layer-panel],.nv-layer-row")) return "layers";
      if (target?.closest?.(".nv-panel-tab-content,.nv-panel-tab-shell")) return "tabs";
      if (target?.closest?.(".panel-cell")) return "panel-host";
      return fallback;
    }

    function ownerForTarget(target) {
      if (store.currentOwnerOverride) return store.currentOwnerOverride;
      if (target === window) return "window";
      if (target === document || target?.nodeType === Node.DOCUMENT_NODE) return "document";
      if (target?.nodeType === Node.TEXT_NODE) return ownerForTarget(target.parentElement);
      if (target?.id === "wysiwyg") return "HTML.editorRoot";
      if (target?.closest?.("#wysiwyg")) return "HTML.editorDescendant";
      if (target?.closest?.("#app-stack-layers-host")) return "Layers.host";
      const tab = target?.closest?.(".nv-panel-tab-content");
      if (tab?.dataset?.nvPanelType) return "tab:" + tab.dataset.nvPanelType;
      const cell = target?.closest?.(".panel-cell");
      if (cell?.dataset?.panelId || cell?.dataset?.id) return "panel:" + (cell.dataset.panelId || cell.dataset.id);
      if (target?.id === "toolbar" || target?.closest?.("#toolbar")) return "toolbar";
      if (target?.id === "status-bar" || target?.closest?.("#status-bar")) return "status";
      return targetId(target);
    }

    function ownerScope(owner, fn) {
      const previous = store.currentOwnerOverride;
      store.currentOwnerOverride = owner || "";
      try { return fn(); }
      finally { store.currentOwnerOverride = previous; }
    }

    const addOriginal = EventTarget.prototype.addEventListener;
    const removeOriginal = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function patchedAddEventListener(type, listener, options) {
      if (!listener) return addOriginal.call(this, type, listener, options);
      const id = ++store.listenerSeq;
      const record = {
        id,
        target: this,
        targetId: targetId(this),
        owner: ownerForTarget(this),
        type: String(type || ""),
        capture: capture(options),
        passive: Boolean(options && typeof options === "object" && options.passive),
        once: Boolean(options && typeof options === "object" && options.once),
        name: listener.name || listener.handleEvent?.name || "anonymous",
        active: true,
        addedAt: now(),
        removedAt: 0,
        calls: 0,
      };
      const wrapped = function appStackWrappedListener(event) {
        if (store.active) {
          const key = record.owner + ":" + record.type;
          const started = now();
          record.calls += 1;
          bump(metrics.eventInvocations, key);
          try {
            return typeof listener === "function"
              ? listener.call(this, event)
              : listener.handleEvent.call(listener, event);
          } finally {
            addTiming(metrics.eventTimingMs, metrics.eventWorstMs, key, now() - started);
          }
        }
        return typeof listener === "function"
          ? listener.call(this, event)
          : listener.handleEvent.call(listener, event);
      };
      record.original = listener;
      record.wrapped = wrapped;
      store.listeners.push(record);
      return addOriginal.call(this, type, wrapped, options);
    };
    EventTarget.prototype.removeEventListener = function patchedRemoveEventListener(type, listener, options) {
      const cap = capture(options);
      const record = store.listeners.find((candidate) =>
        candidate.active &&
        candidate.target === this &&
        candidate.original === listener &&
        candidate.type === String(type || "") &&
        candidate.capture === cap
      );
      if (record) {
        record.active = false;
        record.removedAt = now();
        return removeOriginal.call(this, type, record.wrapped, options);
      }
      return removeOriginal.call(this, type, listener, options);
    };

    const dispatchOriginal = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function patchedDispatchEvent(event) {
      if (store.active && event?.type) {
        const type = String(event.type || "");
        if (type.startsWith("nodevision") || type.startsWith("nv-") || type === "activePanelChanged" || type === "toolbarAction") {
          bump(metrics.customDispatches, ownerForTarget(this) + ":" + type);
        }
      }
      return dispatchOriginal.call(this, event);
    };

    const MutationObserverOriginal = window.MutationObserver;
    window.MutationObserver = function PatchedMutationObserver(callback) {
      const id = ++store.observerSeq;
      const record = {
        id,
        owner: store.currentOwnerOverride || "unobserved",
        targetId: "",
        active: true,
        observeCalls: 0,
        disconnectCalls: 0,
        callbacks: 0,
        records: 0,
      };
      const observer = new MutationObserverOriginal((records, nativeObserver) => {
        if (store.active) {
          const key = record.owner + "@" + (record.targetId || "unknown");
          const started = now();
          record.callbacks += 1;
          record.records += Number(records?.length || 0);
          bump(metrics.mutationObserverCallbacks, key);
          bump(metrics.mutationRecords, key, Number(records?.length || 0));
          for (const mutation of records || []) bump(metrics.mutationRecordTypes, key + ":" + mutation.type);
          try { return callback(records, nativeObserver); }
          finally { addTiming(metrics.mutationObserverTimingMs, metrics.mutationObserverWorstMs, key, now() - started); }
        }
        return callback(records, nativeObserver);
      });
      const observeOriginal = observer.observe.bind(observer);
      observer.observe = (target, options) => {
        record.owner = store.currentOwnerOverride || ownerForTarget(target);
        record.targetId = targetId(target);
        record.options = {
          childList: Boolean(options?.childList),
          attributes: Boolean(options?.attributes),
          characterData: Boolean(options?.characterData),
          subtree: Boolean(options?.subtree),
          attributeFilter: Array.isArray(options?.attributeFilter) ? options.attributeFilter.slice() : null,
        };
        record.observeCalls += 1;
        record.active = true;
        return observeOriginal(target, options);
      };
      const disconnectOriginal = observer.disconnect.bind(observer);
      observer.disconnect = () => {
        record.active = false;
        record.disconnectCalls += 1;
        return disconnectOriginal();
      };
      store.observers.push(record);
      return observer;
    };
    window.MutationObserver.prototype = MutationObserverOriginal.prototype;

    const timeoutOriginal = window.setTimeout.bind(window);
    const clearTimeoutOriginal = window.clearTimeout.bind(window);
    window.setTimeout = (callback, timeout, ...args) => {
      const owner = store.currentOwnerOverride || "timer";
      const id = timeoutOriginal(() => {
        store.timers.delete(id);
        if (store.active) bump(metrics.timeoutFired, owner);
        return callback(...args);
      }, timeout);
      store.timers.set(id, { owner, timeout, createdAt: now() });
      if (store.active) bump(metrics.timeoutScheduled, owner);
      return id;
    };
    window.clearTimeout = (id) => {
      store.timers.delete(id);
      return clearTimeoutOriginal(id);
    };

    const rafOriginal = window.requestAnimationFrame.bind(window);
    const cancelRafOriginal = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      const owner = store.currentOwnerOverride || "raf";
      if (store.active) bump(metrics.rafScheduled, owner);
      const id = rafOriginal((timestamp) => {
        store.rafs.delete(id);
        if (store.active) bump(metrics.rafFired, owner);
        return callback(timestamp);
      });
      store.rafs.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      store.rafs.delete(id);
      return cancelRafOriginal(id);
    };

    function patchMeasuredMethod(proto, name, bucketName) {
      const original = proto?.[name];
      if (typeof original !== "function") return;
      proto[name] = function patchedMeasuredMethod() {
        const owner = ownerForTarget(this);
        if (!store.active) return original.apply(this, arguments);
        const started = now();
        try { return original.apply(this, arguments); }
        finally {
          const elapsed = now() - started;
          const operationKey = bucketName + ":" + owner;
          bump(metrics[bucketName], owner, elapsed);
          bump(metrics.domOperationCalls, operationKey);
          bump(metrics.domOperationMs, operationKey, elapsed);
          if (layoutOperationBuckets.has(bucketName)) {
            bump(metrics.layoutOperationCalls, operationKey);
            bump(metrics.layoutOperationMs, operationKey, elapsed);
          }
        }
      };
    }
    patchMeasuredMethod(Document.prototype, "querySelectorAll", "querySelectorAll");
    patchMeasuredMethod(Element.prototype, "querySelectorAll", "querySelectorAll");
    patchMeasuredMethod(Element.prototype, "getBoundingClientRect", "getBoundingClientRect");
    patchMeasuredMethod(Element.prototype, "getClientRects", "getClientRects");
    patchMeasuredMethod(Element.prototype, "scrollIntoView", "scrollIntoView");
    patchMeasuredMethod(HTMLElement.prototype, "focus", "focusCalls");
    patchMeasuredMethod(Document.prototype, "createTreeWalker", "createTreeWalker");

    const gcsOriginal = window.getComputedStyle.bind(window);
    window.getComputedStyle = function patchedGetComputedStyle(el) {
      const owner = ownerForTarget(el);
      if (!store.active) return gcsOriginal(...arguments);
      const started = now();
      try { return gcsOriginal(...arguments); }
      finally {
        const elapsed = now() - started;
        const operationKey = "getComputedStyle:" + owner;
        bump(metrics.getComputedStyle, owner, elapsed);
        bump(metrics.domOperationCalls, operationKey);
        bump(metrics.domOperationMs, operationKey, elapsed);
        bump(metrics.layoutOperationCalls, operationKey);
        bump(metrics.layoutOperationMs, operationKey, elapsed);
      }
    };

    function patchGetter(ownerStart, name, bucketName) {
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
          const label = ownerForTarget(this);
          if (!store.active) return descriptor.get.call(this);
          const started = now();
          try { return descriptor.get.call(this); }
          finally {
            const elapsed = now() - started;
            const operationKey = bucketName + ":" + label;
            bump(metrics[bucketName], label, elapsed);
            bump(metrics.domOperationCalls, operationKey);
            bump(metrics.domOperationMs, operationKey, elapsed);
            if (layoutOperationBuckets.has(bucketName)) {
              bump(metrics.layoutOperationCalls, operationKey);
              bump(metrics.layoutOperationMs, operationKey, elapsed);
            }
          }
        },
        set: descriptor.set ? function(value) { return descriptor.set.call(this, value); } : undefined,
      });
    }
    patchGetter(HTMLElement.prototype, "innerText", "innerTextReads");
    patchGetter(Node.prototype, "textContent", "textContentReads");
    patchGetter(Element.prototype, "innerHTML", "innerHTMLReads");
    patchGetter(HTMLElement.prototype, "offsetWidth", "offsetWidthReads");
    patchGetter(HTMLElement.prototype, "offsetHeight", "offsetHeightReads");
    patchGetter(Element.prototype, "clientWidth", "clientWidthReads");
    patchGetter(Element.prototype, "clientHeight", "clientHeightReads");
    patchGetter(Element.prototype, "scrollWidth", "scrollWidthReads");
    patchGetter(Element.prototype, "scrollHeight", "scrollHeightReads");

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (store.active) store.longTasks.push({ name: entry.name || "", duration: round(entry.duration), startTime: round(entry.startTime) });
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {}

    function resetMetricBuckets() {
      for (const bucket of Object.values(metrics)) {
        for (const key of Object.keys(bucket)) delete bucket[key];
      }
      store.longTasks = [];
      store.layerHostMutationRecords = 0;
      store.counters = {};
      store.timings = {};
      if (window.__nvPerformanceDiagnosticsStore) {
        window.__nvPerformanceDiagnosticsStore.entries = [];
        window.__nvPerformanceDiagnosticsStore.counters = {};
      }
    }

    function activeListeners() {
      return store.listeners.filter((record) => record.active);
    }

    function activeObservers() {
      return store.observers.filter((record) => record.active);
    }

    function listenerSummary() {
      const active = activeListeners();
      const byOwnerType = {};
      const byOwnerEventTarget = {};
      const duplicateGroups = {};
      for (const record of active) {
        bump(byOwnerType, record.owner + ":" + record.type);
        bump(byOwnerEventTarget, [record.owner, record.type, targetCategory(record.target, record.targetId)].join("|"));
        const duplicateKey = [
          record.owner,
          record.targetId,
          record.type,
          record.capture ? "capture" : "bubble",
          record.name,
        ].join("|");
        bump(duplicateGroups, duplicateKey);
      }
      const duplicates = Object.entries(duplicateGroups)
        .filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([key, count]) => ({ key, count }));
      return {
        activeCount: active.length,
        totalAdded: store.listeners.length,
        totalRemoved: store.listeners.filter((record) => !record.active).length,
        byOwnerType,
        byOwnerEventTarget,
        duplicates,
      };
    }

    function observerSummary() {
      const active = activeObservers();
      const byOwnerTarget = {};
      const duplicateGroups = {};
      for (const record of active) {
        const key = record.owner + "@" + record.targetId;
        bump(byOwnerTarget, key);
        bump(duplicateGroups, key + ":" + JSON.stringify(record.options || {}));
      }
      const duplicates = Object.entries(duplicateGroups)
        .filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([key, count]) => ({ key, count }));
      return {
        activeCount: active.length,
        totalCreated: store.observers.length,
        totalDisconnected: store.observers.filter((record) => !record.active || record.disconnectCalls > 0).length,
        byOwnerTarget,
        duplicates,
      };
    }

    function graphStateSnapshot() {
      const cy = window.cy || null;
      const container = document.getElementById("cy");
      const hasFcose = typeof window.cytoscape === "function" && Boolean(window.cytoscape("layout", "fcose"));
      const hasExpandCollapse = typeof window.cytoscape === "function" && Boolean(window.cytoscape.prototype?.expandCollapse);
      const nodeCount = cy?.nodes ? cy.nodes().length : 0;
      const edgeCount = cy?.edges ? cy.edges().length : 0;
      return {
        cytoscapeAvailable: typeof window.cytoscape === "function",
        fcoseAvailable: hasFcose,
        expandCollapseAvailable: hasExpandCollapse,
        cyExists: Boolean(cy),
        containerExists: Boolean(container),
        containerWidth: Math.round(container?.getBoundingClientRect?.().width || 0),
        containerHeight: Math.round(container?.getBoundingClientRect?.().height || 0),
        nodeCount,
        edgeCount,
        elementCount: nodeCount + edgeCount,
        rendered: Boolean(cy && container && nodeCount > 0),
      };
    }

    window.__nvAppStackTypingMetrics = {
      ownerScope,
      reset() { resetMetricBuckets(); },
      start() { resetMetricBuckets(); store.active = true; },
      stop() { store.active = false; },
      bumpCounter(key, amount = 1) { bump(store.counters, key, amount); },
      addTiming(key, ms) { bump(store.timings, key, ms); },
      snapshot() {
        const providers = typeof window.NodevisionLiveFileContent?.listProviders === "function"
          ? window.NodevisionLiveFileContent.listProviders()
          : [];
        return {
          metrics: JSON.parse(JSON.stringify(metrics)),
          explicitCounters: { ...store.counters },
          explicitTimingMs: { ...store.timings },
          longTasks: store.longTasks.slice(),
          listenerSummary: listenerSummary(),
          observerSummary: observerSummary(),
          activeTimers: store.timers.size,
          activeRafs: store.rafs.size,
          liveProviders: providers,
          panelLifecycle: window.NodevisionPanelContentLifecycle?.stats?.() || null,
          layerHostMutationRecords: store.layerHostMutationRecords,
          performanceDiagnostics: window.NodevisionPerformanceDiagnostics?.snapshot?.() || window.__nvPerformanceDiagnosticsStore || null,
          graphState: graphStateSnapshot(),
          panelCounts: {
            cells: document.querySelectorAll(".panel-cell").length,
            tabContents: document.querySelectorAll(".nv-panel-tab-content").length,
            activeTabContents: document.querySelectorAll(".nv-panel-tab-content:not([hidden])").length,
            hiddenTabContents: document.querySelectorAll(".nv-panel-tab-content[hidden]").length,
          },
        };
      },
    };
  }

  function metricApi() {
    return window.__nvAppStackTypingMetrics;
  }

  function htmlBodyFromDocument(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    return doc.body?.innerHTML || "";
  }

  async function settleLayout(extraMs = 80) {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (extraMs > 0) await new Promise((resolve) => setTimeout(resolve, extraMs));
  }

  function cleanupAppStackHarness() {
    window.__nvAppStackTypingProbeCleanup?.();
    window.__nvAppStackGraphicalLifecycle?.destroy?.();
    window.__nvAppStackGraphicalLifecycle = null;
    window.__nvAppStackLayerCleanup?.();
    window.__nvAppStackLayerCleanup = null;
    window.__nvAppStackLayerObserver?.disconnect?.();
    window.__nvAppStackLayerObserver = null;
    if (window.__nvAppStackWorkspaceCleanup) {
      try { window.__nvAppStackWorkspaceCleanup(); } catch {}
      window.__nvAppStackWorkspaceCleanup = null;
    }
    document.body.innerHTML = "";
    document.querySelectorAll("[data-nv-app-stack-benchmark-style]").forEach((el) => el.remove());
    document.getElementById("nv-html-layout-style")?.remove();
    window.HTMLLayersContext = null;
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

  function installTypingProbe(root) {
    window.__nvAppStackTypingProbeCleanup?.();
    const state = {
      mode: "",
      measuredText: "",
      samples: [],
      mutationSummary: { total: 0, characterData: 0, childList: 0, attributes: 0, addedNodes: 0, removedNodes: 0 },
    };
    const onBeforeInput = (event) => {
      if (!state.mode) return;
      state.samples.push({ phase: "beforeinput", data: event.data || "", inputType: event.inputType || "", at: performance.now() });
    };
    const onInput = (event) => {
      if (!state.mode) return;
      const sample = {
        phase: "input",
        data: event.data || "",
        inputType: event.inputType || "",
        at: performance.now(),
        firstRafMs: null,
        secondRafMs: null,
      };
      state.samples.push(sample);
      requestAnimationFrame(() => {
        sample.firstRafMs = Math.round((performance.now() - sample.at) * 10) / 10;
        requestAnimationFrame(() => {
          sample.secondRafMs = Math.round((performance.now() - sample.at) * 10) / 10;
        });
      });
    };
    const observer = new MutationObserver((records) => {
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
    window.__nvAppStackTypingState = state;
    window.__nvAppStackTypingProbeCleanup = () => {
      root.removeEventListener("beforeinput", onBeforeInput, true);
      root.removeEventListener("input", onInput, true);
      observer.disconnect();
    };
  }

  function startMeasuredText(mode, text) {
    const state = window.__nvAppStackTypingState;
    state.mode = String(mode || "");
    state.measuredText = String(text || "");
    state.samples = [];
    state.mutationSummary = { total: 0, characterData: 0, childList: 0, attributes: 0, addedNodes: 0, removedNodes: 0 };
    metricApi().start();
  }

  async function stopMeasuredText() {
    const state = window.__nvAppStackTypingState;
    state.mode = "";
    metricApi().stop();
    await settleLayout(140);
  }

  function ensureBasicAppState(filePath = "") {
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.currentMode = "GraphicalEditing";
    window.NodevisionState.activePanelType = "GraphicalEditor";
    window.NodevisionState.selectedFile = filePath;
    window.NodevisionState.selectedFileIsDirectory = false;
    window.NodevisionState.activeEditorFilePath = filePath;
    window.selectedFilePath = filePath;
    window.currentActiveFilePath = filePath;
    window.filePath = filePath;
  }

  function createShell(columns = "1fr 300px") {
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    const shell = document.createElement("div");
    shell.id = "app-stack-shell";
    shell.style.cssText = "display:grid;grid-template-columns:" + columns + ";gap:8px;width:1280px;height:900px;padding:8px;box-sizing:border-box;background:#f5f5f5";
    document.body.appendChild(shell);
    return shell;
  }

  function makePanelCell(id, panelClass = "InfoPanel") {
    const cell = document.createElement("div");
    cell.className = "panel-cell";
    cell.dataset.id = id;
    cell.dataset.panelId = id;
    cell.dataset.panelClass = panelClass;
    cell.style.cssText = "min-width:0;min-height:0;display:flex;flex-direction:column;overflow:auto;border:1px solid #bbb;background:#fff";
    return cell;
  }

  async function waitForGraphManagerReady(timeoutMs = 8000) {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      const state = metricApi().snapshot().graphState;
      if (state.cyExists && state.rendered && state.containerWidth > 0 && state.containerHeight > 0) return state;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return metricApi().snapshot().graphState;
  }

  async function mountGraphManagerIntoCell(cell) {
    if (!cell) return { attached: false, valid: false, reason: "missing-cell" };
    const loader = await import("/panels/workspaceParts/workspacePanelLoader.mjs?v=" + Date.now());
    await metricApi().ownerScope("GraphManager.panelSetup", async () => {
      await loader.loadPanelIntoSpecificCell(cell, "GraphManager", {
        panelClass: "InfoPanel",
        currentDirectory: "__nv_html_app_stack_typing",
        allowDuplicateTab: true,
      });
    });
    await settleLayout(900);
    const state = await waitForGraphManagerReady();
    return {
      attached: true,
      valid: Boolean(state.cytoscapeAvailable && state.fcoseAvailable && state.cyExists && state.rendered && state.nodeCount > 0),
      verification: state,
    };
  }

  async function mountLayersIntoCell(cell, visibility = "visible") {
    if (visibility === "detached") return { attached: false, visibility };
    if (!cell) return { attached: false, visibility, error: "missing-cell" };
    if (visibility === "empty") {
      cell.innerHTML = "";
      await settleLayout(160);
      return { attached: false, visibility, empty: true };
    }
    if (visibility === "hidden") {
      cell.hidden = true;
      cell.style.display = "none";
    }
    const loader = await import("/panels/workspaceParts/workspacePanelLoader.mjs?v=" + Date.now());
    return await metricApi().ownerScope("Layers.panelSetup", async () => {
      await loader.loadPanelIntoSpecificCell(cell, "SVGLayersPanel", {
        panelClass: "InfoPanel",
        preferredContext: "html-edit",
        allowDuplicateTab: true,
      });
      const host = cell.querySelector(".nv-panel-tab-content") || cell;
      const layerObserver = new MutationObserver((records) => {
        metricApi().bumpCounter("layers.hostMutationObserver.callbacks");
        metricApi().bumpCounter("layers.hostMutationObserver.records", Number(records?.length || 0));
        metricApi().bumpCounter("layers.hostMutationRecords", Number(records?.length || 0));
      });
      layerObserver.observe(host, { subtree: true, childList: true, characterData: true, attributes: true });
      window.__nvAppStackLayerObserver = layerObserver;
      if (visibility === "hidden") {
        cell.hidden = true;
        cell.style.display = "none";
      }
      await settleLayout(160);
      return {
        attached: true,
        visibility,
        layersTextLength: String(host.textContent || "").length,
        layerRows: host.querySelectorAll("button,input,[data-layer-row],.nv-layer-row").length,
      };
    });
  }

  async function mountBare({ html, config = {} }) {
    cleanupAppStackHarness();
    const shell = createShell("1fr");
    let hostParent = shell;
    if (config.editorScaffold) {
      const editorCell = makePanelCell("BareEditorScaffold", "EditorPanel");
      editorCell.classList.add("active-panel");
      shell.appendChild(editorCell);
      const wrapper = document.createElement("div");
      wrapper.id = "editor-root";
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.height = "100%";
      wrapper.style.minHeight = "0";
      wrapper.style.width = "100%";
      editorCell.appendChild(wrapper);
      hostParent = wrapper;
    }
    if (config.nodevisionCss) {
      shell.className = "panel-cell active-panel nv-graphical-editor-host";
      ["MainStyles", "LayoutStyles", "ToolbarStyles", "StatusBarStyles", "style"].forEach((name) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/Stylesheets/" + name + ".css";
        link.dataset.nvAppStackBenchmarkStyle = "true";
        document.head.appendChild(link);
      });
    }
    const style = document.createElement("style");
    style.dataset.nvAppStackBenchmarkStyle = "true";
    const rootStyle = config.editorScaffold
      ? "#wysiwyg{width:100%;box-sizing:border-box;overflow:auto;padding:12px;font-family:Arial,sans-serif;line-height:1.55;overflow-wrap:anywhere;word-break:break-word;background:#fff;flex:1 1 0;min-height:0;outline:none}"
      : "#wysiwyg{height:884px;width:100%;box-sizing:border-box;overflow:auto;padding:12px;font-family:Arial,sans-serif;line-height:1.55;overflow-wrap:anywhere;word-break:break-word;border:1px solid #aaa;background:#fff}";
    style.textContent = [
      rootStyle,
      "#wysiwyg:focus{outline:1px solid #777}",
      "#wysiwyg>section,#wysiwyg>article,#wysiwyg>main,#wysiwyg>aside,#wysiwyg>div{content-visibility:auto;contain-intrinsic-size:auto 96px}",
      "#wysiwyg>:focus-within{content-visibility:visible;contain-intrinsic-size:auto}"
    ].join("\\n");
    document.head.appendChild(style);
    const host = document.createElement("div");
    host.id = "wysiwyg";
    host.contentEditable = "true";
    host.spellcheck = false;
    host.innerHTML = htmlBodyFromDocument(html);
    hostParent.appendChild(host);
    installTypingProbe(host);
    await settleLayout(160);
    return { mounted: true, environment: config.editorScaffold ? "bare-editor-scaffold" : (config.nodevisionCss ? "bare-nodevision-css" : "bare"), layers: "detached" };
  }

  function cleanupHtmlDirectMode(container, cleanup, mode) {
    const clean = (name) => {
      const fn = container?.[name];
      if (typeof fn === "function") {
        try { fn(); } catch {}
        container[name] = null;
      }
    };
    if (mode === "all") {
      cleanup?.();
      return ["all"];
    }
    const cleaned = [];
    const cleanGroup = (names) => {
      names.forEach((name) => { clean(name); cleaned.push(name); });
    };
    if (mode === "diagnostics") cleanGroup(["__cleanupHTMLTypingDiagnostics"]);
    if (mode === "selection") cleanGroup(["__cleanupHTMLCaretTracking", "__cleanupHTMLTableToolbar", "__cleanupHTMLTextWrapping", "__cleanupHTMLAttention", "__cleanupHTMLActiveContext"]);
    if (mode === "textWrapping") cleanGroup(["__cleanupHTMLTextWrapping"]);
    if (mode === "observers") cleanGroup(["__cleanupHTMLImageTextTools", "__cleanupHTMLCircuits", "__cleanupHTMLTableDividerResizing", "__cleanupHTMLTableDragSelection"]);
    return cleaned;
  }

  async function mountHtmlDirect({ filePath, config = {} }) {
    cleanupAppStackHarness();
    ensureBasicAppState(filePath);
    const shell = createShell("1fr");
    const editorCell = makePanelCell("HTMLDirectEditor", "EditorPanel");
    editorCell.classList.add("active-panel");
    shell.appendChild(editorCell);
    window.activeCell = editorCell;
    window.activePanel = "GraphicalEditor";
    window.activePanelClass = "EditorPanel";
    const editor = await import("/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs?v=" + Date.now());
    const cleanup = await metricApi().ownerScope("HTMLeditor.renderEditor", () =>
      editor.renderEditor(filePath, editorCell)
    );
    await settleLayout(220);
    const cleanupMode = config.cleanupMode || "none";
    const cleaned = cleanupHtmlDirectMode(editorCell, cleanup, cleanupMode);
    await settleLayout(160);
    const wysiwyg = document.getElementById("wysiwyg");
    if (!wysiwyg) throw new Error("Direct HTML editor did not mount a #wysiwyg root.");
    installTypingProbe(wysiwyg);
    window.__nvAppStackGraphicalLifecycle = { destroy: () => cleanup?.() };
    return { mounted: true, environment: "html-direct", cleanupMode, cleaned };
  }

  async function mountGraphical({ filePath, layers = "detached", graphManager = false }) {
    cleanupAppStackHarness();
    ensureBasicAppState(filePath);
    const shell = createShell(graphManager
      ? (layers === "detached" ? "1fr 330px" : "1fr 300px 330px")
      : (layers === "detached" ? "1fr" : "1fr 300px"));
    const editorCell = makePanelCell("GraphicalEditor", "EditorPanel");
    editorCell.classList.add("active-panel");
    shell.appendChild(editorCell);
    const layersCell = makePanelCell("SVGLayersPanel", "InfoPanel");
    if (layers !== "detached") shell.appendChild(layersCell);
    const graphCell = makePanelCell("GraphManager", "InfoPanel");
    if (graphManager) shell.appendChild(graphCell);
    window.activeCell = editorCell;
    window.activePanel = "GraphicalEditor";
    window.activePanelClass = "EditorPanel";
    const editor = await import("/PanelInstances/EditorPanels/GraphicalEditor.mjs?v=" + Date.now());
    window.__nvAppStackGraphicalLifecycle = await metricApi().ownerScope("GraphicalEditor.setupPanel", () =>
      editor.setupPanel(editorCell, { filePath })
    );
    await settleLayout(160);
    const wysiwyg = document.getElementById("wysiwyg");
    if (!wysiwyg) throw new Error("Graphical HTML editor did not mount a #wysiwyg root.");
    const layerMount = await mountLayersIntoCell(layersCell, layers);
    const graphMount = graphManager ? await mountGraphManagerIntoCell(graphCell) : null;
    installTypingProbe(wysiwyg);
    return { mounted: true, environment: "graphical", layers, layerMount, graphMount };
  }

  function workspaceLayout(filePath, stressTabs) {
    const unrelated = "__nv_html_app_stack_typing/clean.html";
    const extraTabs = [];
    for (let index = 0; index < Number(stressTabs || 0); index += 1) {
      extraTabs.push({
        panelType: index % 2 === 0 ? "FileView" : "GraphicalEditor",
        panelClass: index % 2 === 0 ? "ViewPanel" : "EditorPanel",
        displayName: "Inactive " + (index + 1),
        tabId: "inactive-" + index,
        panelVars: { filePath: unrelated, panelClass: index % 2 === 0 ? "ViewPanel" : "EditorPanel" },
      });
    }
    return {
      direction: "row",
      children: [
        {
          direction: "column",
          flex: "0 0 240px",
          children: [
            { type: "cell", id: "FileManager", panelType: "FileManager", panelClass: "InfoPanel", flex: "1 1 0", panelVars: { currentDirectory: "__nv_html_app_stack_typing" } },
            { type: "cell", id: "GraphManager", panelType: "GraphManager", panelClass: "InfoPanel", flex: "1 1 0", panelVars: { currentDirectory: "__nv_html_app_stack_typing" } },
          ],
        },
        {
          type: "cell",
          id: "GraphicalEditor",
          panelType: "GraphicalEditor",
          panelClass: "EditorPanel",
          flex: "1 1 auto",
          tabs: [
            { panelType: "GraphicalEditor", panelClass: "EditorPanel", displayName: "Edited HTML", tabId: "edited-html", panelVars: { filePath, panelClass: "EditorPanel" } },
            ...extraTabs,
          ],
          activeTabId: "edited-html",
        },
        {
          direction: "column",
          flex: "0 0 330px",
          children: [
            { type: "cell", id: "SVGLayersPanel", panelType: "SVGLayersPanel", panelClass: "InfoPanel", flex: "1 1 0", panelVars: { preferredContext: "html-edit" } },
            {
              type: "cell",
              id: "FileView",
              panelType: "FileView",
              panelClass: "ViewPanel",
              flex: "1 1 0",
              tabs: [
                { panelType: "FileView", panelClass: "ViewPanel", displayName: "Live file view", tabId: "file-view-live", panelVars: { filePath, panelClass: "ViewPanel" } },
                { panelType: "FileView", panelClass: "ViewPanel", displayName: "Unrelated view", tabId: "file-view-other", panelVars: { filePath: unrelated, panelClass: "ViewPanel" } },
              ],
              activeTabId: "file-view-live",
            },
          ],
        },
      ],
    };
  }

  async function mountWorkspace({ filePath, layers = "visible", stressTabs = 0 }) {
    cleanupAppStackHarness();
    ensureBasicAppState(filePath);
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    const workspace = document.createElement("div");
    workspace.id = "workspace";
    workspace.style.cssText = "width:1280px;height:900px;display:flex;min-width:0;min-height:0;overflow:hidden;padding:8px;box-sizing:border-box;background:#f5f5f5";
    document.body.appendChild(workspace);
    const layout = workspaceLayout(filePath, stressTabs);
    const layoutMod = await import("/panels/workspaceParts/workspaceLayoutRender.mjs?v=" + Date.now());
    const loader = await import("/panels/workspaceParts/workspacePanelLoader.mjs?v=" + Date.now());
    await metricApi().ownerScope("workspace.renderLayout", () => layoutMod.renderLayout(layout, workspace));
    await settleLayout(400);
    const editorCell = Array.from(document.querySelectorAll(".panel-cell")).find((cell) => cell.dataset.panelId === "GraphicalEditor" || cell.dataset.id === "GraphicalEditor");
    if (editorCell?.__nvPanelTabs) {
      const tab = editorCell.__nvPanelTabs.tabs.find((candidate) => candidate.tabId === "edited-html") || editorCell.__nvPanelTabs.tabs[0];
      if (tab) {
        const tabs = await import("/panels/panelTabs.mjs?v=" + Date.now());
        tabs.activatePanelTab(editorCell, tab.tabId, { announce: false });
      }
    }
    window.activeCell = editorCell;
    window.activePanel = "GraphicalEditor";
    window.activePanelClass = "EditorPanel";
    const layersCell = Array.from(document.querySelectorAll(".panel-cell")).find((cell) => cell.dataset.panelId === "SVGLayersPanel" || cell.dataset.id === "SVGLayersPanel");
    if (layers === "hidden" && layersCell) {
      layersCell.hidden = true;
      layersCell.style.display = "none";
    } else if (layers === "detached" && layersCell) {
      loader.cleanupPanelCells(layersCell);
      layersCell.innerHTML = "";
      layersCell.hidden = true;
      layersCell.style.display = "none";
    } else if (layersCell && !layersCell.querySelector(".nv-panel-tab-content")) {
      await mountLayersIntoCell(layersCell, layers);
    }
    await settleLayout(400);
    const graphCell = Array.from(document.querySelectorAll(".panel-cell")).find((cell) => cell.dataset.panelId === "GraphManager" || cell.dataset.id === "GraphManager");
    const graphMount = graphCell ? { attached: true, valid: false, verification: await waitForGraphManagerReady(8000) } : null;
    if (graphMount) graphMount.valid = Boolean(graphMount.verification?.cytoscapeAvailable && graphMount.verification?.fcoseAvailable && graphMount.verification?.cyExists && graphMount.verification?.rendered && graphMount.verification?.nodeCount > 0);
    const wysiwyg = document.getElementById("wysiwyg");
    if (!wysiwyg) throw new Error("Workspace did not mount a #wysiwyg root.");
    installTypingProbe(wysiwyg);
    window.__nvAppStackWorkspaceCleanup = () => loader.cleanupPanelCells(workspace);
    return {
      mounted: true,
      environment: "workspace",
      layers,
      stressTabs,
      graphMount,
      panelCounts: metricApi().snapshot().panelCounts,
    };
  }

  window.__nvAppStackMount = async ({ config, filePath, html }) => {
    const kind = config?.kind || "bare";
    if (kind === "bare") return await mountBare({ html, config });
    if (kind === "html-direct") return await mountHtmlDirect({ filePath, config });
    if (kind === "workspace") return await mountWorkspace({
      filePath,
      layers: config.layers || "visible",
      stressTabs: config.stressTabs || 0,
    });
    return await mountGraphical({ filePath, layers: config.layers || "detached", graphManager: config.graphManager === true });
  };

  window.__nvAppStackSelectBeginning = async () => {
    const root = document.getElementById("wysiwyg");
    if (!root) throw new Error("No editable root.");
    const blocks = textBlocks(root);
    const target = blocks[0] || root;
    target.scrollIntoView({ block: "center", inline: "nearest" });
    await settleLayout(120);
    root.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(rangeAtEndOfElement(target));
    target.dataset.nvAppStackTypingSelected = "true";
    window.__nvAppStackTypingTarget = target;
    window.__nvAppStackTypingBeforeText = target.textContent || "";
    await settleLayout(120);
    return {
      targetTagName: target.tagName,
      targetTextLength: Number((target.textContent || "").length),
      targetCount: blocks.length,
      rootScrollHeight: Math.round(root.scrollHeight),
      rootChildCount: root.children.length,
    };
  };

  window.__nvAppStackStartMeasuredText = startMeasuredText;
  window.__nvAppStackStopMeasuredText = stopMeasuredText;

  window.__nvAppStackVerifyInsertion = () => {
    const target = window.__nvAppStackTypingTarget;
    const state = window.__nvAppStackTypingState;
    const before = String(window.__nvAppStackTypingBeforeText || "");
    const measured = String(state?.measuredText || "");
    const current = String(target?.textContent || "");
    return {
      ok: Boolean(target && current.endsWith(measured) && current.startsWith(before)),
      beforeLength: before.length,
      currentLength: current.length,
      expectedSuffix: measured,
      suffix: current.slice(Math.max(0, current.length - measured.length - 8)),
    };
  };

  window.__nvAppStackCollectFrames = async (durationMs = 1200) => {
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

  window.__nvAppStackPassSnapshot = () => {
    const state = window.__nvAppStackTypingState || {};
    const samples = (state.samples || []).filter((sample) => sample.phase === "input");
    const beforeInputs = (state.samples || []).filter((sample) => sample.phase === "beforeinput");
    const first = samples.map((sample) => Number(sample.firstRafMs || 0)).filter((value) => value > 0).sort((a, b) => a - b);
    const second = samples.map((sample) => Number(sample.secondRafMs || 0)).filter((value) => value > 0).sort((a, b) => a - b);
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
      beforeInputCount: beforeInputs.length,
      inputToFirstAnimationFrame: sampleStats(first),
      inputToSecondAnimationFrame: sampleStats(second),
      mutationSummary: state.mutationSummary || {},
      instrumented: metricApi().snapshot(),
      nodevisionTypingCounters: window.__nvHtmlTypingLatency?.counters || {},
      nodevisionTypingSampleCount: Number((window.__nvHtmlTypingLatency?.samples || []).filter((sample) => sample.phase === "input").length),
    };
  };

  window.__nvAppStackLifecycleSwitchFile = async (filePath) => {
    const editor = await import("/PanelInstances/EditorPanels/GraphicalEditor.mjs?v=" + Date.now());
    const host = document.querySelector("[data-nv-graphical-editor-root='true'],#graphical-editor");
    ensureBasicAppState(filePath);
    await metricApi().ownerScope("GraphicalEditor.updateGraphicalEditor", () =>
      editor.updateGraphicalEditor(filePath, { force: true, host })
    );
    await settleLayout(180);
    const wysiwyg = document.getElementById("wysiwyg");
    if (!wysiwyg) throw new Error("Switch did not leave an editable root mounted.");
    installTypingProbe(wysiwyg);
    return metricApi().snapshot();
  };

  window.__nvAppStackLifecycleTabChurn = async ({ filePath, iterations = 1 }) => {
    const loader = await import("/panels/workspaceParts/workspacePanelLoader.mjs?v=" + Date.now());
    const tabs = await import("/panels/panelTabs.mjs?v=" + Date.now());
    const cell = Array.from(document.querySelectorAll(".panel-cell")).find((candidate) => candidate.dataset.panelId === "GraphicalEditor" || candidate.dataset.id === "GraphicalEditor");
    if (!cell) return { skipped: true, reason: "no-editor-cell" };
    const originalTabId = cell.__nvPanelTabs?.activeTabId || "";
    for (let index = 0; index < iterations; index += 1) {
      const tab = await loader.loadPanelIntoSpecificCell(cell, "GraphicalEditor", {
        filePath,
        panelClass: "EditorPanel",
        allowDuplicateTab: true,
      });
      if (originalTabId) tabs.activatePanelTab(cell, originalTabId, { announce: false });
      if (tab?.tabId) tabs.closePanelTab(cell, tab.tabId, { force: true });
    }
    await settleLayout(180);
    return metricApi().snapshot();
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
    if (/app-stack typing|Failed|Error|Graphical|Layers|FileView|GraphManager/i.test(String(message || ""))) {
      console.log("[renderer]", message);
    }
  });
  return win;
}

async function prepareWindow(win, runtimeUrl) {
  writeHarness();
  await win.loadURL(runtimeUrl + "/__html-app-stack-typing-harness.html");
  await win.webContents.executeJavaScript(
    `fetch("/api/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "admin" }) }).then(r => r.json())`,
    true
  );
  await win.loadURL(runtimeUrl + "/__html-app-stack-typing-harness.html");
  await waitFor(win, "document.readyState === 'complete'");
  await win.webContents.executeJavaScript(rendererSetup, true);
}

async function mountConfig(win, fixture, config) {
  return await win.webContents.executeJavaScript(
    `window.__nvAppStackMount(${JSON.stringify({ config, filePath: fixture.relativePath, html: fixture.html })})`,
    true
  );
}

async function sendNativeText(win, text, delayMs) {
  for (const character of String(text || "")) {
    win.webContents.sendInputEvent({ type: "char", keyCode: character });
    if (delayMs > 0) await delay(delayMs);
  }
}

async function runPass(win, fixture, config, mode, repetition) {
  console.log(`[app-stack typing] ${fixture.id} ${config.id} ${mode.id} pass ${repetition + 1}/${REPETITIONS}`);
  const mount = await mountConfig(win, fixture, config);
  const selection = await win.webContents.executeJavaScript("window.__nvAppStackSelectBeginning()", true);

  await win.webContents.executeJavaScript(
    `window.__nvAppStackStartMeasuredText(${JSON.stringify(mode.id)}, ${JSON.stringify(mode.text)})`,
    true
  );
  const duration = Math.max(FRAME_DURATION_MS, mode.text.length * 24 + 500);
  const framesPromise = win.webContents.executeJavaScript(`window.__nvAppStackCollectFrames(${JSON.stringify(duration)})`, true);
  await sendNativeText(win, mode.text, mode.delayMs);
  await win.webContents.executeJavaScript("window.__nvAppStackStopMeasuredText()", true);
  const frames = await framesPromise;
  const verification = await win.webContents.executeJavaScript("window.__nvAppStackVerifyInsertion()", true);
  if (!verification.ok) {
    throw new Error(`${fixture.id} ${config.id} ${mode.id} insertion verification failed`);
  }
  const snapshot = await win.webContents.executeJavaScript("window.__nvAppStackPassSnapshot()", true);
  if (snapshot.nativeInputCount !== mode.text.length) {
    throw new Error(`${fixture.id} ${config.id} ${mode.id} expected ${mode.text.length} native inputs, saw ${snapshot.nativeInputCount}`);
  }
  return {
    fixtureId: fixture.id,
    fixtureLabel: fixture.label,
    fixtureMetrics: fixture.metrics,
    configId: config.id,
    configLabel: config.label,
    config,
    mode: mode.id,
    typedCharacters: mode.text.length,
    repetition: repetition + 1,
    mount,
    selection,
    frames,
    verification,
    ...snapshot,
  };
}

async function runLifecycleSuite(win, fixtures) {
  const fragmented = fixtures.find((fixture) => fixture.id === "fragmented") || fixtures[0];
  const clean = fixtures.find((fixture) => fixture.id === "clean") || fixtures[0];
  const checkpoints = [];
  console.log("[app-stack typing] lifecycle full-workspace switch checkpoints");
  await mountConfig(win, fragmented, CONFIGS.find((config) => config.id === "full-workspace"));
  let performed = 0;
  for (const checkpoint of LIFECYCLE_CHECKPOINTS) {
    while (performed < checkpoint) {
      performed += 1;
      const next = performed % 2 === 0 ? fragmented : clean;
      await win.webContents.executeJavaScript(
        `window.__nvAppStackLifecycleSwitchFile(${JSON.stringify(next.relativePath)})`,
        true
      );
    }
    const selection = await win.webContents.executeJavaScript("window.__nvAppStackSelectBeginning()", true);
    await win.webContents.executeJavaScript(
      `window.__nvAppStackStartMeasuredText("lifecycle-rapid", ${JSON.stringify(TEXTS.rapid)})`,
      true
    );
    const framesPromise = win.webContents.executeJavaScript(`window.__nvAppStackCollectFrames(${JSON.stringify(FRAME_DURATION_MS)})`, true);
    await sendNativeText(win, TEXTS.rapid, 0);
    await win.webContents.executeJavaScript("window.__nvAppStackStopMeasuredText()", true);
    const frames = await framesPromise;
    const verification = await win.webContents.executeJavaScript("window.__nvAppStackVerifyInsertion()", true);
    const snapshot = await win.webContents.executeJavaScript("window.__nvAppStackPassSnapshot()", true);
    checkpoints.push({
      kind: "file-switch",
      checkpoint,
      switchesPerformed: performed,
      fixtureId: performed % 2 === 0 ? fragmented.id : clean.id,
      typedCharacters: TEXTS.rapid.length,
      selection,
      frames,
      verification,
      ...snapshot,
    });
  }

  const tabChurn = [];
  if (!RUN_TAB_CHURN) return { checkpoints, tabChurn };
  const churnCounts = [0, 5, 20];
  await mountConfig(win, fragmented, CONFIGS.find((config) => config.id === "multi-panel-stress"));
  let churned = 0;
  for (const checkpoint of churnCounts) {
    while (churned < checkpoint) {
      const step = Math.min(5, checkpoint - churned);
      await win.webContents.executeJavaScript(
        `window.__nvAppStackLifecycleTabChurn(${JSON.stringify({ filePath: clean.relativePath, iterations: step })})`,
        true
      );
      churned += step;
    }
    tabChurn.push({
      kind: "tab-churn",
      checkpoint,
      churned,
      snapshot: await win.webContents.executeJavaScript("window.__nvAppStackTypingMetrics.snapshot()", true),
    });
  }
  return { checkpoints, tabChurn };
}

function groupKey(pass, fields) {
  return fields.map((field) => pass[field]).join("|");
}

function perChar(value, chars) {
  return round(Number(value || 0) / Math.max(1, Number(chars || 1)), 3);
}

function aggregatePasses(passes) {
  const groups = new Map();
  for (const pass of passes) {
    const key = groupKey(pass, ["fixtureId", "configId", "mode"]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(pass);
  }
  return Array.from(groups.values()).map((items) => {
    const first = items[0];
    const eventInvocations = {};
    const mutationCallbacks = {};
    const mutationRecords = {};
    const customDispatches = {};
    const domScanMs = {};
    const domOperationCalls = {};
    const layoutOperationCalls = {};
    const layoutOperationMs = {};
    for (const item of items) {
      const instrumented = item.instrumented || {};
      for (const [key, value] of Object.entries(instrumented.metrics?.eventInvocations || {})) eventInvocations[key] = Number(eventInvocations[key] || 0) + Number(value || 0);
      for (const [key, value] of Object.entries(instrumented.metrics?.mutationObserverCallbacks || {})) mutationCallbacks[key] = Number(mutationCallbacks[key] || 0) + Number(value || 0);
      for (const [key, value] of Object.entries(instrumented.metrics?.mutationRecords || {})) mutationRecords[key] = Number(mutationRecords[key] || 0) + Number(value || 0);
      for (const [key, value] of Object.entries(instrumented.metrics?.customDispatches || {})) customDispatches[key] = Number(customDispatches[key] || 0) + Number(value || 0);
      for (const bucketName of ["querySelectorAll", "getComputedStyle", "getBoundingClientRect", "getClientRects", "scrollIntoView", "focusCalls", "createTreeWalker", "innerTextReads", "textContentReads", "innerHTMLReads", "offsetWidthReads", "offsetHeightReads", "clientWidthReads", "clientHeightReads", "scrollWidthReads", "scrollHeightReads"]) {
        for (const [key, value] of Object.entries(instrumented.metrics?.[bucketName] || {})) {
          domScanMs[bucketName + ":" + key] = Number(domScanMs[bucketName + ":" + key] || 0) + Number(value || 0);
        }
      }
      for (const [key, value] of Object.entries(instrumented.metrics?.domOperationCalls || {})) domOperationCalls[key] = Number(domOperationCalls[key] || 0) + Number(value || 0);
      for (const [key, value] of Object.entries(instrumented.metrics?.layoutOperationCalls || {})) layoutOperationCalls[key] = Number(layoutOperationCalls[key] || 0) + Number(value || 0);
      for (const [key, value] of Object.entries(instrumented.metrics?.layoutOperationMs || {})) layoutOperationMs[key] = Number(layoutOperationMs[key] || 0) + Number(value || 0);
    }
    const typedCharacters = items.reduce((sum, item) => sum + Number(item.typedCharacters || 0), 0);
    return {
      fixtureId: first.fixtureId,
      configId: first.configId,
      mode: first.mode,
      repetitions: items.length,
      typedCharacters: first.typedCharacters,
      fixtureMetrics: first.fixtureMetrics,
      inputToSecondAnimationFrame: stats(items.map((item) => item.inputToSecondAnimationFrame.mean)),
      inputToSecondAnimationFrameP95: stats(items.map((item) => item.inputToSecondAnimationFrame.p95)),
      fps: stats(items.map((item) => item.frames.fps)),
      worstFrameMs: stats(items.map((item) => item.frames.worstFrameMs)),
      droppedFrames: stats(items.map((item) => item.frames.droppedFrames)),
      longTasks: stats(items.map((item) => (item.instrumented?.longTasks || []).length)),
      longTaskMs: stats(items.map((item) => (item.instrumented?.longTasks || []).reduce((sum, task) => sum + Number(task.duration || 0), 0))),
      activeListeners: stats(items.map((item) => item.instrumented?.listenerSummary?.activeCount || 0)),
      activeObservers: stats(items.map((item) => item.instrumented?.observerSummary?.activeCount || 0)),
      liveProviders: stats(items.map((item) => (item.instrumented?.liveProviders || []).length)),
      activeTimers: stats(items.map((item) => item.instrumented?.activeTimers || 0)),
      panelCount: stats(items.map((item) => item.instrumented?.panelCounts?.cells || 0)),
      hiddenTabs: stats(items.map((item) => item.instrumented?.panelCounts?.hiddenTabContents || 0)),
      topEventInvocations: topEntries(eventInvocations),
      topEventInvocationsPerChar: topEntries(Object.fromEntries(Object.entries(eventInvocations).map(([key, value]) => [key, perChar(value, typedCharacters)]))),
      topMutationCallbacks: topEntries(mutationCallbacks),
      topMutationRecords: topEntries(mutationRecords),
      topCustomDispatches: topEntries(customDispatches),
      topDomScanMs: topEntries(domScanMs),
      topDomOperationCalls: topEntries(domOperationCalls),
      topDomOperationCallsPerChar: topEntries(Object.fromEntries(Object.entries(domOperationCalls).map(([key, value]) => [key, perChar(value, typedCharacters)]))),
      topLayoutOperationCalls: topEntries(layoutOperationCalls),
      topLayoutOperationCallsPerChar: topEntries(Object.fromEntries(Object.entries(layoutOperationCalls).map(([key, value]) => [key, perChar(value, typedCharacters)]))),
      topLayoutOperationMs: topEntries(layoutOperationMs),
      totalEventInvocationsPerChar: perChar(sumObjectValues(eventInvocations), typedCharacters),
      totalMutationCallbacksPerChar: perChar(sumObjectValues(mutationCallbacks), typedCharacters),
      totalMutationRecordsPerChar: perChar(sumObjectValues(mutationRecords), typedCharacters),
      duplicateListeners: first.instrumented?.listenerSummary?.duplicates || [],
      duplicateObservers: first.instrumented?.observerSummary?.duplicates || [],
    };
  });
}

function matrixRows(aggregates) {
  const rows = [];
  for (const config of CONFIGS) {
    const clean = aggregates.find((row) => row.configId === config.id && row.fixtureId === "clean" && row.mode === "rapid");
    const fragmented = aggregates.find((row) => row.configId === config.id && row.fixtureId === "fragmented" && row.mode === "rapid");
    rows.push({
      configId: config.id,
      label: config.label,
      cleanFps: clean?.fps?.mean || 0,
      fragmentedFps: fragmented?.fps?.mean || 0,
      cleanSecondRafP95: clean?.inputToSecondAnimationFrameP95?.mean || 0,
      fragmentedSecondRafP95: fragmented?.inputToSecondAnimationFrameP95?.mean || 0,
      cleanLongTaskMs: clean?.longTaskMs?.mean || 0,
      fragmentedLongTaskMs: fragmented?.longTaskMs?.mean || 0,
      fragmentedOverCleanSecondRaf: clean?.inputToSecondAnimationFrame.mean
        ? round(fragmented.inputToSecondAnimationFrame.mean / clean.inputToSecondAnimationFrame.mean, 2)
        : 0,
    });
  }
  return rows;
}

function ratioBetween(aggregates, fixtureId, mode, numeratorConfigId, denominatorConfigId) {
  const numerator = aggregates.find((row) => row.fixtureId === fixtureId && row.mode === mode && row.configId === numeratorConfigId);
  const denominator = aggregates.find((row) => row.fixtureId === fixtureId && row.mode === mode && row.configId === denominatorConfigId);
  if (!numerator?.inputToSecondAnimationFrame?.mean || !denominator?.inputToSecondAnimationFrame?.mean) return 0;
  return round(numerator.inputToSecondAnimationFrame.mean / denominator.inputToSecondAnimationFrame.mean, 2);
}

function summarizeDiagnosis(aggregates, lifecycle) {
  const fragmentedGraphicalOverBare = ratioBetween(aggregates, "fragmented", "rapid", "graphical-only", "bare-contenteditable");
  const fragmentedEmptySideOverDetached = ratioBetween(aggregates, "fragmented", "rapid", "graphical-empty-side-panel", "graphical-only");
  const fragmentedLayersVisibleOverDetached = ratioBetween(aggregates, "fragmented", "rapid", "graphical-layers-visible", "graphical-only");
  const fragmentedLayersHiddenOverDetached = ratioBetween(aggregates, "fragmented", "rapid", "graphical-layers-hidden", "graphical-only");
  const fragmentedWorkspaceOverGraphical = ratioBetween(aggregates, "fragmented", "rapid", "full-workspace", "graphical-only");
  const fragmentedStressOverWorkspace = ratioBetween(aggregates, "fragmented", "rapid", "multi-panel-stress", "full-workspace");
  const lifecycleRows = lifecycle?.checkpoints || [];
  const baseline = lifecycleRows.find((row) => row.checkpoint === 0);
  const final = lifecycleRows[lifecycleRows.length - 1];
  const lifecycleLatencyRatio = baseline?.inputToSecondAnimationFrame?.mean && final?.inputToSecondAnimationFrame?.mean
    ? round(final.inputToSecondAnimationFrame.mean / baseline.inputToSecondAnimationFrame.mean, 2)
    : 0;
  const baselineListeners = baseline?.instrumented?.listenerSummary?.activeCount || 0;
  const finalListeners = final?.instrumented?.listenerSummary?.activeCount || 0;
  const baselineObservers = baseline?.instrumented?.observerSummary?.activeCount || 0;
  const finalObservers = final?.instrumented?.observerSummary?.activeCount || 0;
  const recommendation = fragmentedLayersHiddenOverDetached > 1.2
    ? "First optimize HTML Layers visibility/lifecycle so hidden or inactive Layers instances do not render or retain observers."
    : fragmentedLayersVisibleOverDetached > 1.2
      ? "First optimize HTML Layers incremental render behavior, especially avoiding full layer collection for ordinary text edits."
      : fragmentedWorkspaceOverGraphical > 1.2
        ? "First isolate workspace and neighboring panel reactions, starting with FileView live content and tab lifecycle subscribers."
        : "The dominant measured cost is still intrinsic editor/browser DOM cost; continue with DOM-fragment normalization experiments.";
  return {
    fragmentedGraphicalOverBare,
    fragmentedEmptySideOverDetached,
    fragmentedLayersVisibleOverDetached,
    fragmentedLayersHiddenOverDetached,
    fragmentedWorkspaceOverGraphical,
    fragmentedStressOverWorkspace,
    lifecycleLatencyRatio,
    listenerGrowthAfterLifecycle: finalListeners - baselineListeners,
    observerGrowthAfterLifecycle: finalObservers - baselineObservers,
    recommendation,
  };
}

function lifecycleSummary(lifecycle) {
  return (lifecycle?.checkpoints || []).map((row) => ({
    checkpoint: row.checkpoint,
    secondRafMean: row.inputToSecondAnimationFrame.mean,
    secondRafP95: row.inputToSecondAnimationFrame.p95,
    fps: row.frames.fps,
    activeListeners: row.instrumented?.listenerSummary?.activeCount || 0,
    activeObservers: row.instrumented?.observerSummary?.activeCount || 0,
    liveProviders: (row.instrumented?.liveProviders || []).length,
    activeTimers: row.instrumented?.activeTimers || 0,
    hiddenTabs: row.instrumented?.panelCounts?.hiddenTabContents || 0,
    duplicateListeners: row.instrumented?.listenerSummary?.duplicates?.slice(0, 5) || [],
    duplicateObservers: row.instrumented?.observerSummary?.duplicates?.slice(0, 5) || [],
  }));
}

function briefList(items = [], limit = 5, suffix = "") {
  return items.slice(0, limit).map((item) => item.key + "=" + item.value + suffix).join("; ") || "none";
}

function makeMarkdownReport(report) {
  const matrix = report.matrix
    .map((row) => `| ${row.label} | ${row.cleanFps} | ${row.fragmentedFps} | ${row.cleanSecondRafP95} | ${row.fragmentedSecondRafP95} | ${row.fragmentedOverCleanSecondRaf}x |`)
    .join("\n");
  const fanout = report.aggregates
    .filter((row) => row.fixtureId === "fragmented" && row.mode === "rapid")
    .map((row) => `| ${row.configId} | ${row.totalEventInvocationsPerChar} | ${row.totalMutationCallbacksPerChar} | ${row.totalMutationRecordsPerChar} | ${briefList(row.topLayoutOperationCallsPerChar, 3)} | ${row.activeListeners.mean} | ${row.activeObservers.mean} | ${row.liveProviders.mean} | ${row.inputToSecondAnimationFrameP95.mean} |`)
    .join("\n");
  const lifecycle = report.lifecycleSummary
    .map((row) => `| ${row.checkpoint} | ${row.secondRafMean} | ${row.secondRafP95} | ${row.fps} | ${row.activeListeners} | ${row.activeObservers} | ${row.liveProviders} | ${row.activeTimers} |`)
    .join("\n");
  const top = report.aggregates
    .filter((row) => row.fixtureId === "fragmented" && row.mode === "rapid")
    .map((row) => {
      const events = briefList(row.topEventInvocationsPerChar, 5);
      const mutations = briefList(row.topMutationRecords, 5);
      const scans = briefList(row.topDomScanMs, 5, "ms");
      const layoutCalls = briefList(row.topLayoutOperationCallsPerChar, 5);
      const layoutMs = briefList(row.topLayoutOperationMs, 5, "ms");
      return `### ${row.configId}\n\n- Top event calls per char: ${events}\n- Top mutation records: ${mutations}\n- Top layout/geometry calls per char: ${layoutCalls}
- Top layout/geometry time: ${layoutMs}
- Top DOM scan time: ${scans}`;
    })
    .join("\n\n");
  return [
    "# HTML App-Stack Typing Benchmark",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "All documents are deterministic synthetic fixtures generated by this benchmark. No real working document content is read.",
    "",
    "## Rapid Typing Matrix",
    "",
    "| Environment | Clean FPS | Fragmented FPS | Clean p95 2nd rAF ms | Fragmented p95 2nd rAF ms | Fragmented/Clean mean 2nd rAF |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    matrix,
    "",
    "## Fragmented Rapid Fanout",
    "",
    "| Environment | Event calls/char | MO callbacks/char | MO records/char | Layout calls/char | Active listeners | Active observers | Live providers | p95 2nd rAF ms |",
    "| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |",
    fanout,
    "",
    "## Lifecycle Switch Checkpoints",
    "",
    "| File switches | Mean 2nd rAF ms | p95 2nd rAF ms | FPS | Active listeners | Active observers | Live providers | Active timers |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    lifecycle,
    "",
    "## Diagnosis Ratios",
    "",
    `- Fragmented graphical-only over bare: ${report.diagnosis.fragmentedGraphicalOverBare}x`,
    `- Fragmented empty side panel over detached: ${report.diagnosis.fragmentedEmptySideOverDetached}x`,
    `- Fragmented Layers visible over detached: ${report.diagnosis.fragmentedLayersVisibleOverDetached}x`,
    `- Fragmented Layers hidden over detached: ${report.diagnosis.fragmentedLayersHiddenOverDetached}x`,
    `- Fragmented full workspace over graphical-only: ${report.diagnosis.fragmentedWorkspaceOverGraphical}x`,
    `- Fragmented multi-panel stress over full workspace: ${report.diagnosis.fragmentedStressOverWorkspace}x`,
    `- Lifecycle final/baseline latency: ${report.diagnosis.lifecycleLatencyRatio}x`,
    `- Listener growth after lifecycle: ${report.diagnosis.listenerGrowthAfterLifecycle}`,
    `- Observer growth after lifecycle: ${report.diagnosis.observerGrowthAfterLifecycle}`,
    "",
    "## Per-Subsystem Hot Spots",
    "",
    top,
    "",
    "## Highest-Value Next Optimization",
    "",
    report.diagnosis.recommendation,
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
  const fixtureFilter = envFilter("NODEVISION_HTML_APP_STACK_TYPING_FIXTURES");
  const configFilter = envFilter("NODEVISION_HTML_APP_STACK_TYPING_CONFIGS");
  const modeFilter = envFilter("NODEVISION_HTML_APP_STACK_TYPING_MODES");
  const selectedFixtures = fixtures.filter((fixture) => matchesFilter(fixture, fixtureFilter));
  const selectedConfigs = CONFIGS.filter((config) => matchesFilter(config, configFilter));
  const selectedModes = MODES.filter((mode) => matchesFilter(mode, modeFilter));
  let lifecycle = { checkpoints: [], tabChurn: [] };

  try {
    await prepareWindow(win, runtime.url);
    for (const fixture of selectedFixtures) {
      for (const config of selectedConfigs) {
        for (const mode of selectedModes) {
          for (let repetition = 0; repetition < REPETITIONS; repetition += 1) {
            passes.push(await runPass(win, fixture, config, mode, repetition));
          }
        }
      }
    }
    if (process.env.NODEVISION_HTML_APP_STACK_TYPING_SKIP_LIFECYCLE !== "1") {
      lifecycle = await runLifecycleSuite(win, fixtures);
    }
  } finally {
    try { win.close(); } catch {}
    await runtimeController.stop().catch(() => {});
  }

  const aggregates = aggregatePasses(passes);
  const report = {
    generatedAt: new Date().toISOString(),
    note: "Synthetic benchmark only. Fixtures are generated under Notebook/__nv_html_app_stack_typing during the run and then removed.",
    configuration: {
      repetitions: REPETITIONS,
      configs: CONFIGS.map(({ id, label, kind, layers, stressTabs, nodevisionCss, editorScaffold, cleanupMode, graphManager }) => ({ id, label, kind, layers, stressTabs, nodevisionCss, editorScaffold, cleanupMode, graphManager })),
      modes: MODES.map(({ id, label, delayMs, text }) => ({ id, label, delayMs, typedCharacters: text.length })),
      lifecycleCheckpoints: LIFECYCLE_CHECKPOINTS,
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
    syntheticGraph: syntheticGraphMetrics(),
    passes,
    aggregates,
    matrix: matrixRows(aggregates),
    lifecycle,
    lifecycleSummary: lifecycleSummary(lifecycle),
    diagnosis: summarizeDiagnosis(aggregates, lifecycle),
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
      lifecycleCheckpoints: report.lifecycleSummary.length,
      diagnosis: report.diagnosis,
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
