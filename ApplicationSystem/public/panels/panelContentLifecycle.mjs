// Nodevision/ApplicationSystem/public/panels/panelContentLifecycle.mjs
// This module defines the small panel-content lifecycle contract used by tabbed Nodevision workspace content so preserved inactive tabs can become quiet and destroyed tabs can release owned resources.

import { incrementPerformanceCounter } from "../PerformanceDiagnostics.mjs";

const lifecycleRecords = new WeakMap();
const lifecycleStats = {
  registered: 0,
  active: 0,
  inactive: 0,
  destroyed: 0,
  activateCalls: 0,
  deactivateCalls: 0,
  destroyCalls: 0,
};

function noop() {}

function normalizeLifecycleHooks(hooks = {}) {
  const source = hooks && typeof hooks === "object" ? hooks : {};
  return {
    activate: typeof source.activate === "function" ? source.activate : noop,
    deactivate: typeof source.deactivate === "function" ? source.deactivate : noop,
    destroy: typeof source.destroy === "function" ? source.destroy : noop,
  };
}

function updateRecordState(record, nextState) {
  if (!record || record.state === "destroyed") return false;
  if (record.state === nextState) return false;
  if (record.state === "active") lifecycleStats.active -= 1;
  if (record.state === "inactive") lifecycleStats.inactive -= 1;
  record.state = nextState;
  if (nextState === "active") lifecycleStats.active += 1;
  if (nextState === "inactive") lifecycleStats.inactive += 1;
  return true;
}

export function registerPanelContentLifecycle(host, hooks = {}, metadata = {}) {
  if (!host) return null;
  const previous = lifecycleRecords.get(host);
  if (previous && previous.state !== "destroyed") {
    const shouldActivateUpdatedHook = previous.state === "active" &&
      previous.hooks.activate === noop &&
      typeof hooks?.activate === "function";
    previous.hooks = normalizeLifecycleHooks({ ...previous.hooks, ...(hooks || {}) });
    previous.metadata = { ...previous.metadata, ...(metadata || {}) };
    host.__nvPanelContentLifecycle = previous.api;
    if (shouldActivateUpdatedHook) {
      try {
        previous.hooks.activate({ host, lifecycle: previous.api, ...(metadata || {}), reason: "mounted-active" });
        host.__nvPanelContentMountedActiveHookDelivered = true;
      } catch (err) {
        console.warn("[PanelContentLifecycle] activate hook failed after registration:", err);
      }
    }
    return previous.api;
  }

  const record = {
    host,
    hooks: normalizeLifecycleHooks(hooks),
    metadata: { ...(metadata || {}) },
    state: "inactive",
    activateCount: 0,
    deactivateCount: 0,
    destroyCount: 0,
  };

  lifecycleRecords.set(host, record);
  lifecycleStats.registered += 1;
  lifecycleStats.inactive += 1;
  incrementPerformanceCounter("PanelContentLifecycle.registered");

  record.api = {
    activate: (detail = {}) => activatePanelContentLifecycle(host, detail),
    deactivate: (detail = {}) => deactivatePanelContentLifecycle(host, detail),
    destroy: (detail = {}) => destroyPanelContentLifecycle(host, detail),
    get state() { return record.state; },
    get counts() { return { activate: record.activateCount, deactivate: record.deactivateCount, destroy: record.destroyCount }; },
    get metadata() { return record.metadata; },
  };
  host.__nvPanelContentLifecycle = record.api;
  return record.api;
}

export function panelContentLifecycleFor(host) {
  return lifecycleRecords.get(host)?.api || host?.__nvPanelContentLifecycle || null;
}

export function activatePanelContentLifecycle(host, detail = {}) {
  const record = lifecycleRecords.get(host);
  if (!record || record.state === "destroyed") return false;
  if (!updateRecordState(record, "active")) return false;
  record.activateCount += 1;
  lifecycleStats.activateCalls += 1;
  incrementPerformanceCounter("PanelContentLifecycle.activateCalls");
  try {
    record.hooks.activate({ host, lifecycle: record.api, ...detail });
  } catch (err) {
    console.warn("[PanelContentLifecycle] activate hook failed:", err);
  }
  host?.dispatchEvent?.(new CustomEvent("nv-panel-content-activated", { bubbles: true, detail: { host, lifecycle: record.api, ...detail } }));
  return true;
}

export function deactivatePanelContentLifecycle(host, detail = {}) {
  const record = lifecycleRecords.get(host);
  if (!record || record.state === "destroyed") return false;
  if (!updateRecordState(record, "inactive")) return false;
  record.deactivateCount += 1;
  lifecycleStats.deactivateCalls += 1;
  incrementPerformanceCounter("PanelContentLifecycle.deactivateCalls");
  try {
    record.hooks.deactivate({ host, lifecycle: record.api, ...detail });
  } catch (err) {
    console.warn("[PanelContentLifecycle] deactivate hook failed:", err);
  }
  host?.dispatchEvent?.(new CustomEvent("nv-panel-content-deactivated", { bubbles: true, detail: { host, lifecycle: record.api, ...detail } }));
  return true;
}

export function destroyPanelContentLifecycle(host, detail = {}) {
  const record = lifecycleRecords.get(host);
  if (!record || record.state === "destroyed") return false;
  if (record.state === "active") lifecycleStats.active -= 1;
  if (record.state === "inactive") lifecycleStats.inactive -= 1;
  record.state = "destroyed";
  record.destroyCount += 1;
  lifecycleStats.destroyed += 1;
  lifecycleStats.destroyCalls += 1;
  incrementPerformanceCounter("PanelContentLifecycle.destroyCalls");
  try {
    record.hooks.destroy({ host, lifecycle: record.api, ...detail });
  } catch (err) {
    console.warn("[PanelContentLifecycle] destroy hook failed:", err);
  }
  host?.dispatchEvent?.(new CustomEvent("nv-panel-content-destroyed", { bubbles: true, detail: { host, lifecycle: record.api, ...detail } }));
  return true;
}

export function getPanelContentLifecycleStats() {
  return { ...lifecycleStats };
}

if (typeof window !== "undefined") {
  window.NodevisionPanelContentLifecycle = {
    register: registerPanelContentLifecycle,
    forHost: panelContentLifecycleFor,
    activate: activatePanelContentLifecycle,
    deactivate: deactivatePanelContentLifecycle,
    destroy: destroyPanelContentLifecycle,
    stats: getPanelContentLifecycleStats,
  };
}
