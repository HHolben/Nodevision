// Nodevision/ApplicationSystem/tests/htmlDomBloat/rendererMetricsPatch.cjs
// This module exports the renderer-side performance instrumentation patch used by the DOM bloat benchmark to count expensive browser APIs during synthetic edits.

const rendererMetricsPatch = String.raw`
(() => {
  window.__nvHtmlTypingDiagnostics = true;
  window.NodevisionPerformanceDiagnostics?.enable?.();
  if (window.__nvDomBloatMetricPatch) return;
  const metrics = {
    getComputedStyleCount: 0,
    getComputedStyleMs: 0,
    qsaCount: 0,
    qsaMs: 0,
    qsaSelectors: {},
    innerTextCount: 0,
    innerTextMs: 0,
    innerHTMLReadCount: 0,
    innerHTMLReadMs: 0,
    outerHTMLReadCount: 0,
    outerHTMLReadMs: 0,
    treeWalkerCount: 0,
    treeWalkerMs: 0,
    boundingClientRectCount: 0,
    boundingClientRectMs: 0,
    fetchCount: 0,
    rafScheduled: 0,
    rafCallbacks: 0,
    longTasks: 0,
    longTaskMs: 0,
    inputDispatchCount: 0,
    inputDispatchTotalMs: 0,
    inputDispatchMaxMs: 0,
    mutationObserverCallbackCount: 0,
    mutationObserverRecordCount: 0,
    mutationObserverCallbackMs: 0,
    mutationRecordCharacterData: 0,
    mutationRecordChildList: 0,
    mutationRecordAttributes: 0,
  };
  const round = (value) => Math.round(Number(value || 0) * 10) / 10;
  const patch = { metrics };

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
      const key = String(selector || "").slice(0, 140);
      metrics.qsaSelectors[key] = (metrics.qsaSelectors[key] || 0) + 1;
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
          if (msKey) metrics[msKey] = round(metrics[msKey] + performance.now() - started);
        }
      },
      set: descriptor.set ? function(value) { return descriptor.set.call(this, value); } : undefined,
    });
  }
  patchGetter(HTMLElement.prototype, "innerText", "innerTextCount", "innerTextMs");
  patchGetter(Element.prototype, "innerHTML", "innerHTMLReadCount", "innerHTMLReadMs");
  patchGetter(Element.prototype, "outerHTML", "outerHTMLReadCount", "outerHTMLReadMs");

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

  const fetchOriginal = window.fetch?.bind(window);
  if (fetchOriginal) {
    window.fetch = function patchedFetch() {
      metrics.fetchCount += 1;
      return fetchOriginal(...arguments);
    };
  }

  const rafOriginal = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => {
    metrics.rafScheduled += 1;
    return rafOriginal((timestamp) => {
      metrics.rafCallbacks += 1;
      return callback(timestamp);
    });
  };

  const MutationObserverOriginal = window.MutationObserver;
  if (MutationObserverOriginal && !window.__nvDomBloatMutationObserverPatched) {
    window.MutationObserver = function PatchedMutationObserver(callback) {
      return new MutationObserverOriginal((records, observer) => {
        const started = performance.now();
        metrics.mutationObserverCallbackCount += 1;
        metrics.mutationObserverRecordCount += Number(records?.length || 0);
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
    window.__nvDomBloatMutationObserverPatched = true;
  }

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
    for (const key of Object.keys(metrics)) metrics[key] = key === "qsaSelectors" ? {} : 0;
  };
  patch.snapshot = () => JSON.parse(JSON.stringify(metrics));
  window.__nvDomBloatMetricPatch = patch;
})();
`;

module.exports = { rendererMetricsPatch };
