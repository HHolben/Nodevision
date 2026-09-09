// Nodevision/ApplicationSystem/public/PerformanceDiagnostics.mjs
// Lightweight opt-in browser performance diagnostics for development use.

const STORAGE_KEY = "nodevision.performanceDiagnostics";
const STORE_KEY = "__nvPerformanceDiagnosticsStore";

function hasWindow() {
  return typeof window !== "undefined";
}

function diagnosticStore() {
  const root = hasWindow() ? window : globalThis;
  if (!root[STORE_KEY]) {
    root[STORE_KEY] = {
      enabled: false,
      entries: [],
      counters: {},
    };
  }
  return root[STORE_KEY];
}

export function isPerformanceDiagnosticsEnabled() {
  const root = hasWindow() ? window : globalThis;
  if (root.__nvPerformanceDiagnostics === true) return true;
  if (root.NodevisionState?.performanceDiagnostics === true) return true;
  if (hasWindow()) {
    try {
      const params = new URLSearchParams(window.location?.search || "");
      if (params.get("nvPerf") === "1" || params.get("nodevisionPerf") === "1") return true;
    } catch {}
    try {
      const value = window.localStorage?.getItem?.(STORAGE_KEY);
      if (/^(1|true|yes|on)$/i.test(String(value || ""))) return true;
    } catch {}
  }
  return false;
}

export function setPerformanceDiagnosticsEnabled(enabled) {
  const root = hasWindow() ? window : globalThis;
  root.__nvPerformanceDiagnostics = Boolean(enabled);
  diagnosticStore().enabled = Boolean(enabled);
  if (hasWindow()) {
    try {
      window.localStorage?.setItem?.(STORAGE_KEY, enabled ? "1" : "0");
    } catch {}
  }
}

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function compactDetail(detail = {}) {
  if (!detail || typeof detail !== "object") return {};
  return Object.fromEntries(Object.entries(detail).filter(([, value]) => value !== undefined));
}

export function recordPerformanceDiagnostic(name, detail = {}) {
  if (!isPerformanceDiagnosticsEnabled()) return null;
  const entry = {
    name: String(name || "operation"),
    timestamp: new Date().toISOString(),
    ...compactDetail(detail),
  };
  const store = diagnosticStore();
  store.enabled = true;
  store.entries.push(entry);
  if (store.entries.length > 300) store.entries.splice(0, store.entries.length - 300);
  try {
    console.info("[Nodevision Performance] " + entry.name, entry);
  } catch {}
  return entry;
}

export function incrementPerformanceCounter(name, amount = 1) {
  if (!isPerformanceDiagnosticsEnabled()) return 0;
  const store = diagnosticStore();
  const key = String(name || "counter");
  store.counters[key] = Number(store.counters[key] || 0) + Number(amount || 0);
  return store.counters[key];
}

export function createPerformanceOperation(name, detail = {}) {
  const enabled = isPerformanceDiagnosticsEnabled();
  const startedAt = enabled ? nowMs() : 0;
  const marks = {};
  const counters = {};

  return {
    enabled,
    count(key, amount = 1) {
      if (!enabled) return 0;
      const cleanKey = String(key || "count");
      counters[cleanKey] = Number(counters[cleanKey] || 0) + Number(amount || 0);
      return counters[cleanKey];
    },
    add(key, value) {
      if (!enabled) return 0;
      const cleanKey = String(key || "value");
      counters[cleanKey] = Number(counters[cleanKey] || 0) + Number(value || 0);
      return counters[cleanKey];
    },
    mark(key, extra = {}) {
      if (!enabled) return null;
      const elapsedMs = nowMs() - startedAt;
      marks[String(key || "mark")] = { elapsedMs, ...compactDetail(extra) };
      return elapsedMs;
    },
    end(extra = {}) {
      if (!enabled) return null;
      return recordPerformanceDiagnostic(name, {
        ...compactDetail(detail),
        durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
        counters: { ...counters },
        marks: { ...marks },
        ...compactDetail(extra),
      });
    },
  };
}

export function getPerformanceDiagnosticsSnapshot() {
  const store = diagnosticStore();
  return {
    enabled: isPerformanceDiagnosticsEnabled(),
    entries: [...store.entries],
    counters: { ...store.counters },
  };
}

if (hasWindow()) {
  window.NodevisionPerformanceDiagnostics = {
    enable: () => setPerformanceDiagnosticsEnabled(true),
    disable: () => setPerformanceDiagnosticsEnabled(false),
    snapshot: getPerformanceDiagnosticsSnapshot,
    record: recordPerformanceDiagnostic,
  };
}
