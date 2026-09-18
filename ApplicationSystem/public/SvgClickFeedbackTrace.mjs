// Nodevision/ApplicationSystem/public/SvgClickFeedbackTrace.mjs
// Opt-in diagnostics for tracing real SVG click-to-feedback latency without exporting SVG document content.

const STORAGE_KEY = "nodevision.svgClickFeedbackTrace";
const QUERY_KEY = "svg-click-feedback-trace";
const MAX_TRACES = 12;
const MAX_MARKS = 2400;
const MAX_LONG_TASKS = 240;
const MAX_GAPS = 240;
const TRACE_TIMEOUT_MS = 8000;
const LOOP_SAMPLE_MS = 50;
const LOOP_GAP_THRESHOLD_MS = 120;

let initialized = false;
let enabled = false;
let armed = false;
let traces = [];
let activeTrace = null;
let nextTraceId = 1;
let longTaskObserver = null;
let eventLoopTimer = 0;
let lastLoopSampleAt = 0;
let firstRafPending = false;
let secondRafPending = false;

function getGlobal() {
  if (typeof window !== "undefined") return window;
  if (typeof globalThis !== "undefined") return globalThis;
  return {};
}

function now() {
  const global = getGlobal();
  return global.performance?.now?.() ?? Date.now();
}

function currentLocation() {
  const global = getGlobal();
  try { return global.location || null; } catch { return null; }
}

function readStorageFlag() {
  const global = getGlobal();
  try {
    const value = global.localStorage?.getItem?.(STORAGE_KEY);
    return value === "1" || value === "true" || value === QUERY_KEY;
  } catch {
    return false;
  }
}

function readQueryFlag() {
  const location = currentLocation();
  if (!location?.search) return false;
  try {
    const params = new URLSearchParams(location.search);
    return params.has(QUERY_KEY) || params.get("nv-diagnostic") === QUERY_KEY;
  } catch {
    return false;
  }
}

export function svgClickTraceShouldEnable() {
  const global = getGlobal();
  return Boolean(global.__nvSvgClickFeedbackTraceEnabled || readStorageFlag() || readQueryFlag());
}

function boundedPush(array, value, limit) {
  array.push(value);
  if (array.length > limit) array.splice(0, array.length - limit);
}

function sanitizePath(value) {
  if (!value || typeof value !== "string") return null;
  const cleaned = value.replace(/\\/g, "/").replace(/[?#].*$/, "");
  const parts = cleaned.split("/").filter(Boolean);
  if (!parts.length) return null;
  const file = parts[parts.length - 1] || "";
  const parent = parts.length > 1 ? parts[parts.length - 2] : "";
  return parent ? `.../${parent}/${file}` : file;
}

function classifyElement(target) {
  const tag = String(target?.tagName || target?.nodeName || "").toLowerCase() || null;
  const ownerSvg = target?.ownerSVGElement || (tag === "svg" ? target : null);
  const editorUi = target?.closest?.("[data-nv-editor-ui]")?.getAttribute?.("data-nv-editor-ui") || null;
  return {
    tag,
    isSvgElement: Boolean(target && typeof SVGElement !== "undefined" && target instanceof SVGElement),
    isSvgRoot: tag === "svg",
    editorUi: editorUi || null,
    withinSvg: Boolean(ownerSvg),
  };
}

function readPanelState() {
  const global = getGlobal();
  const doc = global.document;
  if (!doc?.querySelectorAll) return {};
  const visible = (selector) => Array.from(doc.querySelectorAll(selector)).filter((el) => {
    if (!el?.isConnected) return false;
    const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
    const style = typeof global.getComputedStyle === "function" ? global.getComputedStyle(el) : null;
    return (!style || (style.display !== "none" && style.visibility !== "hidden")) && (!rect || rect.width > 0 || rect.height > 0);
  }).length;
  return {
    propertiesPanels: visible("[data-panel-type='SVGProperties'], [data-panel='SVGProperties'], .svg-properties-panel"),
    layersPanels: visible("[data-panel-type='SVGLayers'], [data-panel='SVGLayers'], .svg-layers-panel"),
    toolbars: visible("#global-toolbar"),
    subToolbars: visible("#sub-toolbar"),
  };
}

function environmentSummary() {
  const global = getGlobal();
  const nav = global.navigator || {};
  return {
    userAgent: String(nav.userAgent || "").slice(0, 180),
    platform: nav.platform || null,
    language: nav.language || null,
    urlPath: currentLocation()?.pathname || null,
    devicePixelRatio: Number.isFinite(global.devicePixelRatio) ? global.devicePixelRatio : null,
  };
}

function sanitizeContext(context = {}) {
  return {
    activePanelType: context.activePanelType || getGlobal().NodevisionState?.activePanelType || null,
    activeEditorKind: context.activeEditorKind || context.fileFamily || getGlobal().NodevisionState?.fileFamily || null,
    file: sanitizePath(context.filePath || getGlobal().NodevisionState?.activeEditorFilePath || getGlobal().currentActiveFilePath || getGlobal().filePath),
    mode: context.mode || getGlobal().NodevisionState?.currentMode || null,
    tool: context.tool || getGlobal().NodevisionState?.activeTool || getGlobal().NodevisionState?.svgDrawTool || null,
    editorReady: Boolean(context.editorReady),
    deferredModeLayoutPending: Boolean(context.deferredModeLayoutPending),
    panels: { ...readPanelState(), ...(context.panels || {}) },
  };
}

function sanitizeDetail(detail = {}) {
  if (!detail || typeof detail !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(detail)) {
    if (key.toLowerCase().includes("path") || key.toLowerCase().includes("file")) out[key] = sanitizePath(String(value || ""));
    else if (value == null || typeof value === "boolean" || typeof value === "number") out[key] = value;
    else if (typeof value === "string") out[key] = value.slice(0, 160);
    else if (Array.isArray(value)) out[key] = value.slice(0, 20).map((item) => typeof item === "string" ? item.slice(0, 80) : item);
    else if (typeof value === "object") out[key] = JSON.parse(JSON.stringify(value, (_k, v) => typeof v === "string" ? v.slice(0, 160) : v));
  }
  return out;
}

function makeTrace(event, context = {}) {
  const startedAt = now();
  const trace = {
    id: `svg-click-${nextTraceId++}`,
    startedAt,
    completedAt: null,
    completeReason: null,
    event: {
      capturedAt: startedAt,
      timeStamp: Number(event?.timeStamp ?? 0),
      queueDelayMs: Number.isFinite(event?.timeStamp) ? Math.max(0, startedAt - event.timeStamp) : null,
      isTrusted: Boolean(event?.isTrusted),
      pointerType: event?.pointerType || null,
      button: Number.isFinite(event?.button) ? event.button : null,
      buttons: Number.isFinite(event?.buttons) ? event.buttons : null,
      altKey: Boolean(event?.altKey),
      ctrlKey: Boolean(event?.ctrlKey),
      metaKey: Boolean(event?.metaKey),
      shiftKey: Boolean(event?.shiftKey),
      target: classifyElement(event?.target),
    },
    context: sanitizeContext(context),
    environment: environmentSummary(),
    marks: [],
    longTasks: [],
    eventLoopGaps: [],
    counters: {
      attentionSubscriberInvocations: 0,
      toolbarUpdates: 0,
      dropdownRebuilds: 0,
      activeSubToolbarRefreshes: 0,
      layersRefreshes: 0,
      propertiesRefreshes: 0,
      mutationObserverCallbacks: 0,
      resizeObserverCallbacks: 0,
    },
    subscribers: {},
    timeoutHandle: 0,
  };
  trace.timeoutHandle = getGlobal().setTimeout?.(() => completeTrace("timeout"), TRACE_TIMEOUT_MS) || 0;
  return trace;
}

function recordMark(trace, label, detail = {}) {
  if (!trace || !label) return null;
  const time = now();
  const mark = { label, time, offsetMs: +(time - trace.startedAt).toFixed(3), detail: sanitizeDetail(detail) };
  boundedPush(trace.marks, mark, MAX_MARKS);
  if (label.includes("attention:listener:start")) trace.counters.attentionSubscriberInvocations += 1;
  if (label.includes("toolbar:updateToolbarState:start")) trace.counters.toolbarUpdates += 1;
  if (label.includes("rebuildPrebuiltDropdowns")) trace.counters.dropdownRebuilds += 1;
  if (label.includes("subtoolbar")) trace.counters.activeSubToolbarRefreshes += 1;
  if (label.includes("layers")) trace.counters.layersRefreshes += 1;
  if (label.includes("properties")) trace.counters.propertiesRefreshes += 1;
  if (label.includes("mutation-observer")) trace.counters.mutationObserverCallbacks += 1;
  if (label.includes("resize-observer")) trace.counters.resizeObserverCallbacks += 1;
  maybeScheduleFrameBoundary(label);
  return mark;
}

function startEventLoopSampler() {
  const global = getGlobal();
  if (eventLoopTimer || typeof global.setInterval !== "function") return;
  lastLoopSampleAt = now();
  eventLoopTimer = global.setInterval(() => {
    const current = now();
    const gap = current - lastLoopSampleAt - LOOP_SAMPLE_MS;
    lastLoopSampleAt = current;
    if (activeTrace && gap > LOOP_GAP_THRESHOLD_MS) {
      boundedPush(activeTrace.eventLoopGaps, { time: current, offsetMs: +(current - activeTrace.startedAt).toFixed(3), gapMs: +gap.toFixed(3) }, MAX_GAPS);
    }
  }, LOOP_SAMPLE_MS);
}

function stopEventLoopSampler() {
  const global = getGlobal();
  if (eventLoopTimer && typeof global.clearInterval === "function") global.clearInterval(eventLoopTimer);
  eventLoopTimer = 0;
}

function installLongTaskObserver() {
  const global = getGlobal();
  if (longTaskObserver || typeof global.PerformanceObserver !== "function") return;
  try {
    longTaskObserver = new global.PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!activeTrace) continue;
        boundedPush(activeTrace.longTasks, {
          name: entry.name || "longtask",
          startTime: entry.startTime,
          duration: entry.duration,
          offsetMs: +(entry.startTime - activeTrace.startedAt).toFixed(3),
          attribution: Array.from(entry.attribution || []).slice(0, 5).map((item) => ({
            name: item.name || null,
            entryType: item.entryType || null,
            containerType: item.containerType || null,
          })),
        }, MAX_LONG_TASKS);
      }
    });
    longTaskObserver.observe({ entryTypes: ["longtask"] });
  } catch {
    longTaskObserver = null;
  }
}

function maybeScheduleFrameBoundary(label) {
  if (!activeTrace) return;
  if (!/(selection.*overlay|transform.*handle|line.*marker|preview.*update|after-add-marker|after-update-preview)/i.test(label)) return;
  const global = getGlobal();
  if (firstRafPending || typeof global.requestAnimationFrame !== "function") return;
  firstRafPending = true;
  const traceId = activeTrace.id;
  global.requestAnimationFrame(() => {
    if (!activeTrace || activeTrace.id !== traceId) return;
    firstRafPending = false;
    recordMark(activeTrace, "frame:first-raf-after-feedback", {});
    if (secondRafPending) return;
    secondRafPending = true;
    global.requestAnimationFrame(() => {
      if (!activeTrace || activeTrace.id !== traceId) return;
      secondRafPending = false;
      recordMark(activeTrace, "frame:second-raf-after-feedback", {});
      completeTrace("second-raf-after-feedback");
    });
  });
}

export function initializeSvgClickFeedbackTrace() {
  if (initialized) return enabled;
  initialized = true;
  enabled = svgClickTraceShouldEnable();
  if (!enabled) return false;
  installLongTaskObserver();
  const global = getGlobal();
  global.NodevisionSvgClickFeedbackTrace = {
    armNext,
    clear,
    stop: () => { armed = false; completeTrace("stopped"); },
    summary,
    export: exportTraceReport,
    exportJson: () => JSON.stringify(exportTraceReport(), null, 2),
    copy: copyExport,
    download: downloadExport,
    isEnabled: () => enabled,
  };
  return true;
}

export function installSvgClickTraceOnSvgRoot(svgRoot, contextProvider = () => ({})) {
  if (!initializeSvgClickFeedbackTrace() || !svgRoot?.addEventListener) return () => {};
  const onCapture = (event) => {
    if (!armed || event?.type !== "pointerdown") return;
    const trace = makeTrace(event, contextProvider?.() || {});
    armed = false;
    activeTrace = trace;
    boundedPush(traces, trace, MAX_TRACES);
    startEventLoopSampler();
    recordMark(trace, "capture:pointerdown", { isTrusted: Boolean(event.isTrusted), pointerType: event.pointerType || null });
  };
  svgRoot.addEventListener("pointerdown", onCapture, { capture: true, passive: true });
  return () => svgRoot.removeEventListener("pointerdown", onCapture, { capture: true });
}

export function armNext(label = "next-svg-click") {
  initializeSvgClickFeedbackTrace();
  armed = true;
  if (activeTrace) completeTrace("rearmed");
  return { armed: true, label };
}

export function clear() {
  if (activeTrace) completeTrace("cleared");
  traces = [];
  activeTrace = null;
  firstRafPending = false;
  secondRafPending = false;
  stopEventLoopSampler();
  return true;
}

export function completeTrace(reason = "complete") {
  if (!activeTrace) return null;
  const trace = activeTrace;
  trace.completedAt = now();
  trace.completeReason = reason;
  if (trace.timeoutHandle) getGlobal().clearTimeout?.(trace.timeoutHandle);
  recordMark(trace, "trace:complete", { reason });
  activeTrace = null;
  firstRafPending = false;
  secondRafPending = false;
  stopEventLoopSampler();
  return trace;
}

export function svgClickTraceMark(label, detail = {}) {
  if (!enabled || !activeTrace) return null;
  return recordMark(activeTrace, label, detail);
}

export function svgClickTraceSubscriberStart(kind, detail = {}) {
  const mark = svgClickTraceMark(`${kind}:listener:start`, detail);
  return mark ? { traceId: activeTrace?.id || null, startedAt: mark.time, label: kind, detail } : null;
}

export function svgClickTraceSubscriberEnd(token, detail = {}) {
  if (!token || !enabled || !activeTrace || token.traceId !== activeTrace.id) return;
  const duration = now() - token.startedAt;
  const label = `${token.label}:listener:end`;
  svgClickTraceMark(label, { ...detail, durationMs: +duration.toFixed(3) });
  const key = detail.label || token.detail?.label || token.label;
  const current = activeTrace.subscribers[key] || { count: 0, totalDurationMs: 0, maxDurationMs: 0 };
  current.count += 1;
  current.totalDurationMs = +(current.totalDurationMs + duration).toFixed(3);
  current.maxDurationMs = +Math.max(current.maxDurationMs, duration).toFixed(3);
  activeTrace.subscribers[key] = current;
}

export function summary() {
  return traces.map((trace) => summarizeTrace(trace));
}

function summarizeTrace(trace) {
  const markTime = (pattern) => trace.marks.find((m) => pattern.test(m.label))?.offsetMs ?? null;
  const longestSubscriber = Object.entries(trace.subscribers || {}).sort((a, b) => b[1].maxDurationMs - a[1].maxDurationMs)[0] || null;
  const largestLongTask = [...trace.longTasks].sort((a, b) => b.duration - a.duration)[0] || null;
  return {
    id: trace.id,
    isTrusted: trace.event.isTrusted,
    file: trace.context.file,
    mode: trace.context.mode,
    tool: trace.context.tool,
    totalMs: trace.completedAt ? +(trace.completedAt - trace.startedAt).toFixed(3) : null,
    queueDelayMs: trace.event.queueDelayMs,
    handlerStartMs: markTime(/handler:start/),
    selectionOverlayMs: markTime(/selection.*overlay|selection.*visual/i),
    lineMarkerMs: markTime(/line.*marker|after-add-marker/i),
    firstRafMs: markTime(/first-raf/),
    attentionPublishMs: durationBetween(trace, /attention:publish:start/, /attention:publish:end/),
    toolbarMs: durationBetween(trace, /toolbar:updateToolbarState:start/, /toolbar:updateToolbarState:end/),
    subscriberInvocations: trace.counters.attentionSubscriberInvocations,
    longestSubscriber: longestSubscriber ? { label: longestSubscriber[0], ...longestSubscriber[1] } : null,
    largestLongTask,
    largestEventLoopGapMs: trace.eventLoopGaps.reduce((max, gap) => Math.max(max, gap.gapMs || 0), 0),
    completeReason: trace.completeReason,
  };
}

function durationBetween(trace, startPattern, endPattern) {
  const start = trace.marks.find((m) => startPattern.test(m.label));
  if (!start) return null;
  const end = trace.marks.find((m) => endPattern.test(m.label) && m.time >= start.time);
  return end ? +(end.time - start.time).toFixed(3) : null;
}

export function exportTraceReport() {
  return {
    diagnostic: QUERY_KEY,
    generatedAt: new Date().toISOString(),
    enabled,
    armed,
    traceCount: traces.length,
    summary: summary(),
    traces: traces.map((trace) => ({ ...trace, timeoutHandle: undefined })),
  };
}

async function copyExport() {
  const text = JSON.stringify(exportTraceReport(), null, 2);
  await getGlobal().navigator?.clipboard?.writeText?.(text);
  return text.length;
}

function downloadExport() {
  const global = getGlobal();
  const doc = global.document;
  if (!doc?.createElement || !global.URL?.createObjectURL) return false;
  const blob = new Blob([JSON.stringify(exportTraceReport(), null, 2)], { type: "application/json" });
  const url = global.URL.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = `nodevision-svg-click-feedback-trace-${Date.now()}.json`;
  doc.body?.appendChild?.(a);
  a.click();
  a.remove();
  global.URL.revokeObjectURL(url);
  return true;
}

export function _resetSvgClickFeedbackTraceForTests() {
  initialized = false;
  enabled = false;
  armed = false;
  traces = [];
  activeTrace = null;
  nextTraceId = 1;
  firstRafPending = false;
  secondRafPending = false;
  stopEventLoopSampler();
  try { longTaskObserver?.disconnect?.(); } catch {}
  longTaskObserver = null;
}
