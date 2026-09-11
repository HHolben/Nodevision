// Nodevision/ApplicationSystem/tests/phase3ResourceStress.preload.cjs
// E2E-only resource tracker injected before Nodevision browser code runs.

(() => {
  const state = {
    listeners: new Map(),
    listenerAdds: 0,
    listenerRemoves: 0,
    timers: new Map(),
    timerCreated: 0,
    timerCleared: 0,
    intervals: new Map(),
    intervalCreated: 0,
    intervalCleared: 0,
    rafs: new Map(),
    rafScheduled: 0,
    rafCompleted: 0,
    rafCanceled: 0,
    mutationObservers: new Set(),
    mutationObserversCreated: 0,
    mutationObserversDisconnected: 0,
    resizeObservers: new Set(),
    resizeObserversCreated: 0,
    resizeObserversDisconnected: 0,
    iframeBridgesCreated: 0,
    iframeBridgesCleaned: 0,
  };

  function targetLabel(target) {
    if (target === window) return "window";
    if (target === document) return "document";
    if (target === document.body) return "body";
    if (target?.documentElement === target) return "documentElement";
    return "element";
  }

  function listenerKey(target, type, options) {
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    return targetLabel(target) + ":" + String(type) + ":" + String(capture);
  }

  function increment(map, key, delta) {
    const next = Number(map.get(key) || 0) + delta;
    if (next <= 0) map.delete(key);
    else map.set(key, next);
  }

  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (this === window || this === document || this === document.body || this === document.documentElement) {
      increment(state.listeners, listenerKey(this, type, options), 1);
      state.listenerAdds += 1;
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    if (this === window || this === document || this === document.body || this === document.documentElement) {
      increment(state.listeners, listenerKey(this, type, options), -1);
      state.listenerRemoves += 1;
    }
    return originalRemoveEventListener.call(this, type, listener, options);
  };

  const originalSetTimeout = window.setTimeout.bind(window);
  const originalClearTimeout = window.clearTimeout.bind(window);
  window.setTimeout = (handler, timeout, ...args) => {
    let id;
    const wrapped = (...callbackArgs) => {
      state.timers.delete(id);
      return typeof handler === "function" ? handler(...callbackArgs) : Function(String(handler || ""))();
    };
    id = originalSetTimeout(wrapped, timeout, ...args);
    state.timers.set(id, Number(timeout || 0));
    state.timerCreated += 1;
    return id;
  };
  window.clearTimeout = (id) => {
    if (state.timers.delete(id)) state.timerCleared += 1;
    return originalClearTimeout(id);
  };

  const originalSetInterval = window.setInterval.bind(window);
  const originalClearInterval = window.clearInterval.bind(window);
  window.setInterval = (handler, timeout, ...args) => {
    const id = originalSetInterval(handler, timeout, ...args);
    state.intervals.set(id, Number(timeout || 0));
    state.intervalCreated += 1;
    return id;
  };
  window.clearInterval = (id) => {
    if (state.intervals.delete(id)) state.intervalCleared += 1;
    return originalClearInterval(id);
  };

  const originalRequestAnimationFrame = window.requestAnimationFrame?.bind(window);
  const originalCancelAnimationFrame = window.cancelAnimationFrame?.bind(window);
  if (originalRequestAnimationFrame && originalCancelAnimationFrame) {
    window.requestAnimationFrame = (callback) => {
      const id = originalRequestAnimationFrame((timestamp) => {
        state.rafs.delete(id);
        state.rafCompleted += 1;
        callback(timestamp);
      });
      state.rafs.set(id, true);
      state.rafScheduled += 1;
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      if (state.rafs.delete(id)) state.rafCanceled += 1;
      return originalCancelAnimationFrame(id);
    };
  }

  const OriginalMutationObserver = window.MutationObserver;
  if (OriginalMutationObserver) {
    window.MutationObserver = class TrackedMutationObserver extends OriginalMutationObserver {
      constructor(callback) {
        super(callback);
        state.mutationObserversCreated += 1;
      }
      observe(...args) {
        state.mutationObservers.add(this);
        return super.observe(...args);
      }
      disconnect() {
        if (state.mutationObservers.delete(this)) state.mutationObserversDisconnected += 1;
        return super.disconnect();
      }
    };
  }

  const OriginalResizeObserver = window.ResizeObserver;
  if (OriginalResizeObserver) {
    window.ResizeObserver = class TrackedResizeObserver extends OriginalResizeObserver {
      constructor(callback) {
        super(callback);
        state.resizeObserversCreated += 1;
      }
      observe(...args) {
        state.resizeObservers.add(this);
        return super.observe(...args);
      }
      disconnect() {
        if (state.resizeObservers.delete(this)) state.resizeObserversDisconnected += 1;
        return super.disconnect();
      }
    };
  }

  function installIframeBridgeTracker() {
    if (window.__nvIframeBridgeTrackerInstalled) return;
    window.__nvIframeBridgeTrackerInstalled = true;
    if (!OriginalMutationObserver) return;
    const observer = new OriginalMutationObserver(() => {
      document.querySelectorAll("iframe").forEach((iframe) => {
        if (iframe.__nvBridgeTrackerInstalled) return;
        iframe.__nvBridgeTrackerInstalled = true;
        let lastBridge = iframe.__nvFileViewActivationBridge || null;
        Object.defineProperty(iframe, "__nvFileViewActivationBridge", {
          configurable: true,
          get() { return lastBridge; },
          set(value) {
            if (value && value !== lastBridge) {
              const cleanup = value.cleanup;
              if (typeof cleanup === "function") {
                value.cleanup = (...args) => {
                  state.iframeBridgesCleaned += 1;
                  return cleanup.apply(value, args);
                };
              }
              state.iframeBridgesCreated += 1;
            }
            lastBridge = value;
          },
        });
      });
    });
    observer?.observe?.(document.documentElement || document, { childList: true, subtree: true });
  }

  document.addEventListener("DOMContentLoaded", installIframeBridgeTracker, { once: true });

  window.__nvPerformanceDiagnostics = true;
  try { window.localStorage?.setItem?.("nodevision.performanceDiagnostics", "1"); } catch {}

  window.__nvStressResourceSnapshot = async function(label = "snapshot") {
    const beforeRaf = state.rafCompleted;
    await new Promise((resolve) => originalSetTimeout(resolve, 250));
    const rafCallbacksPerSecond = (state.rafCompleted - beforeRaf) * 4;
    const monaco = window.monaco?.editor;
    const models = monaco?.getModels?.() || [];
    const editors = document.querySelectorAll?.(".monaco-editor") || [];
    const lifecycleStats = window.NodevisionPanelContentLifecycle?.stats?.() || null;
    const liveProviders = window.NodevisionLiveFileContent?.listProviders?.() || [];
    const perfCounters = window.NodevisionPerformanceDiagnostics?.snapshot?.().counters || {};
    return {
      label,
      monacoEditors: editors.length,
      monacoModels: models.length,
      globalListenersActive: [...state.listeners.values()].reduce((sum, value) => sum + value, 0),
      globalListenerAdds: state.listenerAdds,
      globalListenerRemoves: state.listenerRemoves,
      mutationObserversActive: state.mutationObservers.size,
      mutationObserversCreated: state.mutationObserversCreated,
      mutationObserversDisconnected: state.mutationObserversDisconnected,
      resizeObserversActive: state.resizeObservers.size,
      resizeObserversCreated: state.resizeObserversCreated,
      resizeObserversDisconnected: state.resizeObserversDisconnected,
      activeTimeouts: state.timers.size,
      timeoutCreated: state.timerCreated,
      timeoutCleared: state.timerCleared,
      activeIntervals: state.intervals.size,
      intervalCreated: state.intervalCreated,
      intervalCleared: state.intervalCleared,
      pendingRafs: state.rafs.size,
      rafScheduled: state.rafScheduled,
      rafCompleted: state.rafCompleted,
      rafCanceled: state.rafCanceled,
      rafCallbacksPerSecond,
      liveProviders: liveProviders.length,
      liveProviderIds: liveProviders.map((provider) => provider.id),
      iframeActivationBridges: document.querySelectorAll?.("iframe") ? [...document.querySelectorAll("iframe")].filter((iframe) => iframe.__nvFileViewActivationBridge).length : 0,
      iframeBridgesCreated: state.iframeBridgesCreated,
      iframeBridgesCleaned: state.iframeBridgesCleaned,
      lifecycleInstancesRegistered: lifecycleStats?.registered || 0,
      lifecycleActive: lifecycleStats?.active || 0,
      lifecycleInactive: lifecycleStats?.inactive || 0,
      lifecycleDestroyed: lifecycleStats?.destroyed || 0,
      openPanelTabs: [...document.querySelectorAll?.(".nv-panel-tab-content") || []].length,
      hiddenPanelTabs: [...document.querySelectorAll?.(".nv-panel-tab-content[hidden]") || []].length,
      perfCounters,
    };
  };
})();
