// Nodevision/ApplicationSystem/tests/htmlDomBloat/rendererEditorHarness.cjs
// This module exports renderer-side editor mounting and pass-finalization helpers for the DOM bloat benchmark while keeping Electron orchestration outside the browser string.

const { ATTACH_LAYERS } = require("./config.cjs");

const rendererEditorHarness = String.raw`
(() => {
  window.__nvDomBloatMountEditor = async ({ filePath, spellcheck = true, disableContentVisibility = false }) => {
    window.__nvHtmlTypingLegacyInputWork = false;
    window.__nvHtmlTypingLatency = { samples: [], mutationBatches: [], counters: {} };
    if (window.__nvPerformanceDiagnosticsStore) {
      window.__nvPerformanceDiagnosticsStore.entries = [];
      window.__nvPerformanceDiagnosticsStore.counters = {};
    }
    window.__nvDomBloatMetricPatch.reset();
    document.body.innerHTML = "";
    const shell = document.createElement("div");
    shell.id = "html-dom-bloat-shell";
    shell.style.cssText = "display:grid;grid-template-columns:1fr;height:820px;width:1180px";
    const editorHost = document.createElement("div");
    editorHost.id = "html-dom-bloat-editor-host";
    editorHost.style.cssText = "min-height:0;display:flex;overflow:hidden;border:1px solid #aaa";
    shell.append(editorHost);
    document.body.append(shell);
    const editor = await import("/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs?domBloat=" + Date.now());
    await editor.renderEditor(filePath, editorHost, { mode: "HTMLediting" });
    await new Promise((resolve) => setTimeout(resolve, 800));
    const wysiwyg = document.getElementById("wysiwyg");
    if (!wysiwyg) throw new Error("WYSIWYG did not mount");
    wysiwyg.setAttribute("spellcheck", spellcheck ? "true" : "false");
    if (disableContentVisibility) {
      const style = document.createElement("style");
      style.id = "nv-dom-bloat-disable-content-visibility";
      style.textContent = "#wysiwyg > * { content-visibility: visible !important; contain-intrinsic-size: auto !important; }";
      document.head.appendChild(style);
    }
    if (${JSON.stringify(ATTACH_LAYERS)}) {
      const layersHost = document.createElement("div");
      layersHost.id = "html-dom-bloat-layers-host";
      document.body.appendChild(layersHost);
      window.HTMLLayersContext?.attachHost?.(layersHost);
    }
    return true;
  };

  window.__nvDomBloatCollectFrames = async (durationMs = 1200) => {
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
            slowFrames: frames.filter((value) => value > 50).length,
            fps: Math.round((1000 / Math.max(avg, 1)) * 10) / 10,
          });
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };

  window.__nvDomBloatFinishPass = async () => {
    await new Promise((resolve) => setTimeout(resolve, 650));
    const samples = (window.__nvHtmlTypingLatency?.samples || []).filter((sample) => sample.phase === "input");
    const latency = samples.map((sample) => Number(sample.secondRafMs || sample.firstRafMs || 0)).filter((value) => value > 0).sort((a, b) => a - b);
    const avg = latency.length ? latency.reduce((sum, value) => sum + value, 0) / latency.length : 0;
    const p95 = latency.length ? latency[Math.min(latency.length - 1, Math.floor(latency.length * 0.95))] : 0;
    const worst = latency.length ? latency[latency.length - 1] : 0;
    const batches = window.__nvHtmlTypingLatency?.mutationBatches || [];
    const mutationBatchSummary = batches.reduce((summary, batch) => {
      summary.batches += 1;
      summary.totalRecords += Number(batch.total || 0);
      summary.characterData += Number(batch.characterData || 0);
      summary.childList += Number(batch.childList || 0);
      summary.attributes += Number(batch.attributes || 0);
      if (batch.textOnly) summary.textOnly += 1;
      if (batch.structural) summary.structural += 1;
      return summary;
    }, { batches: 0, totalRecords: 0, characterData: 0, childList: 0, attributes: 0, textOnly: 0, structural: 0 });
    const beforeSaveMetrics = window.__nvDomBloatMetricPatch.snapshot();
    const html = typeof window.getEditorHTML === "function" ? window.getEditorHTML() : "";
    const afterSaveMetrics = window.__nvDomBloatMetricPatch.snapshot();
    return {
      samples: samples.length,
      meanInputToPaintMs: Math.round(avg * 10) / 10,
      p95InputToPaintMs: Math.round(p95 * 10) / 10,
      worstInputToPaintMs: Math.round(worst * 10) / 10,
      mutationBatchSummary,
      counters: window.__nvHtmlTypingLatency?.counters || {},
      operationMetrics: beforeSaveMetrics,
      saveSerialization: {
        htmlLength: html.length,
        innerHTMLReads: afterSaveMetrics.innerHTMLReadCount - beforeSaveMetrics.innerHTMLReadCount,
        outerHTMLReads: afterSaveMetrics.outerHTMLReadCount - beforeSaveMetrics.outerHTMLReadCount,
        treeWalks: afterSaveMetrics.treeWalkerCount - beforeSaveMetrics.treeWalkerCount,
        fetches: afterSaveMetrics.fetchCount - beforeSaveMetrics.fetchCount,
      },
      savedHtml: html,
    };
  };

  window.__nvDomBloatCurrentEditorHtml = () => {
    const body = document.getElementById("wysiwyg")?.innerHTML || "";
    return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body>" + body + "</body></html>";
  };

  window.__nvDomBloatSetEditorHtml = async (html) => {
    if (typeof window.setEditorHTML !== "function") throw new Error("setEditorHTML unavailable");
    window.setEditorHTML(String(html || ""));
    await new Promise((resolve) => setTimeout(resolve, 260));
    return true;
  };
})();
`;

module.exports = { rendererEditorHarness };
