// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLTypingLatencyDiagnostics.mjs
// Opt-in diagnostics and mutation classification for HTML WYSIWYG typing latency.

import { isPerformanceDiagnosticsEnabled, recordPerformanceDiagnostic } from "/PerformanceDiagnostics.mjs";

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function classifyHtmlMutationRecords(records = []) {
  const summary = {
    total: 0,
    characterData: 0,
    childList: 0,
    attributes: 0,
    addedNodes: 0,
    removedNodes: 0,
    textOnly: false,
    structural: false,
  };

  for (const record of records || []) {
    if (!record) continue;
    summary.total += 1;
    if (record.type === "characterData") {
      summary.characterData += 1;
    } else if (record.type === "childList") {
      summary.childList += 1;
      summary.addedNodes += Number(record.addedNodes?.length || 0);
      summary.removedNodes += Number(record.removedNodes?.length || 0);
    } else if (record.type === "attributes") {
      summary.attributes += 1;
    }
  }

  summary.textOnly = summary.total > 0 && summary.characterData === summary.total;
  summary.structural = summary.childList > 0 || summary.attributes > 0;
  return summary;
}

export function isHtmlTypingDiagnosticsEnabled() {
  const root = typeof window !== "undefined" ? window : globalThis;
  return root.__nvHtmlTypingDiagnostics === true || isPerformanceDiagnosticsEnabled();
}

export function getHtmlTypingDiagnosticsStore() {
  const root = typeof window !== "undefined" ? window : globalThis;
  if (!root.__nvHtmlTypingLatency) {
    root.__nvHtmlTypingLatency = {
      samples: [],
      mutationBatches: [],
      counters: {},
    };
  }
  return root.__nvHtmlTypingLatency;
}

function increment(store, key, amount = 1) {
  store.counters[key] = Number(store.counters[key] || 0) + Number(amount || 0);
}

export function recordHtmlTypingOperation(name, detail = {}) {
  if (!isHtmlTypingDiagnosticsEnabled()) return null;
  const store = getHtmlTypingDiagnosticsStore();
  increment(store, name);
  return recordPerformanceDiagnostic("html typing " + name, detail);
}

export function installHtmlTypingLatencyProbe(wysiwyg, { filePath = "" } = {}) {
  if (!wysiwyg || !isHtmlTypingDiagnosticsEnabled()) return () => {};
  let lastInput = null;
  let pendingMutations = [];

  const recordSample = (phase, event) => {
    const startedAt = nowMs();
    const sample = {
      phase,
      inputType: event?.inputType || "",
      key: event?.key || "",
      data: event?.data || "",
      filePath,
      startedAt,
      syncMs: 0,
      firstRafMs: null,
      secondRafMs: null,
      mutations: null,
    };
    const store = getHtmlTypingDiagnosticsStore();
    lastInput = sample;
    store.samples.push(sample);
    if (store.samples.length > 200) store.samples.splice(0, store.samples.length - 200);

    requestAnimationFrame(() => {
      sample.firstRafMs = Math.round((nowMs() - startedAt) * 10) / 10;
      requestAnimationFrame(() => {
        sample.secondRafMs = Math.round((nowMs() - startedAt) * 10) / 10;
        sample.mutations = classifyHtmlMutationRecords(pendingMutations);
        pendingMutations = [];
        recordPerformanceDiagnostic("html typing input-to-paint", {
          filePath,
          phase,
          inputType: sample.inputType,
          firstRafMs: sample.firstRafMs,
          secondRafMs: sample.secondRafMs,
          mutations: sample.mutations,
        });
      });
    });
    sample.syncMs = Math.round((nowMs() - startedAt) * 10) / 10;
  };

  const beforeInput = (event) => recordSample("beforeinput", event);
  const input = (event) => recordSample("input", event);
  const observer = new MutationObserver((records) => {
    const store = getHtmlTypingDiagnosticsStore();
    pendingMutations.push(...records);
    const summary = classifyHtmlMutationRecords(records);
    store.mutationBatches.push(summary);
    if (store.mutationBatches.length > 200) store.mutationBatches.splice(0, store.mutationBatches.length - 200);
    if (lastInput) lastInput.lastMutationBatch = summary;
  });

  wysiwyg.addEventListener("beforeinput", beforeInput, true);
  wysiwyg.addEventListener("input", input, true);
  observer.observe(wysiwyg, {
    characterData: true,
    childList: true,
    attributes: true,
    subtree: true,
  });

  return () => {
    observer.disconnect();
    wysiwyg.removeEventListener("beforeinput", beforeInput, true);
    wysiwyg.removeEventListener("input", input, true);
  };
}
