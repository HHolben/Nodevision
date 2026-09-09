// Nodevision/ApplicationSystem/server/performanceDiagnostics.mjs
// Lightweight opt-in server performance diagnostics for development use.

function diagnosticsEnabled() {
  return /^(1|true|yes|on)$/i.test(String(process.env.NODEVISION_PERF_DIAGNOSTICS || ""));
}

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function compactDetail(detail = {}) {
  if (!detail || typeof detail !== "object") return {};
  return Object.fromEntries(Object.entries(detail).filter(([, value]) => value !== undefined));
}

export function isServerPerformanceDiagnosticsEnabled() {
  return diagnosticsEnabled();
}

export function recordServerPerformanceDiagnostic(name, detail = {}) {
  if (!diagnosticsEnabled()) return null;
  const entry = {
    name: String(name || "operation"),
    timestamp: new Date().toISOString(),
    ...compactDetail(detail),
  };
  console.info("[Nodevision Performance] " + entry.name, entry);
  return entry;
}

export function createServerPerformanceOperation(name, detail = {}) {
  const enabled = diagnosticsEnabled();
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
      return recordServerPerformanceDiagnostic(name, {
        ...compactDetail(detail),
        durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
        counters: { ...counters },
        marks: { ...marks },
        ...compactDetail(extra),
      });
    },
  };
}
