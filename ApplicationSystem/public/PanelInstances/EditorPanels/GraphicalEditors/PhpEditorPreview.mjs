// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PhpEditorPreview.mjs
// This module renders simulated PHP previews or selects a configured server preview.
import { escapeHTML } from './PhpEditorPresentation.mjs';
import { normalizePath, buildNotebookBaseHref } from './PhpEditorFiles.mjs';
import { buildGeneratedPhp } from './PhpEditorState.mjs';

export function buildPreviewHtml(state) {
  const escapedCode = escapeHTML(state.code);
  const escapedGenerated = escapeHTML(state.generatedPhp);
  const baseHref = buildNotebookBaseHref(state.filePath);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  ${baseHref ? `<base href="${baseHref}">` : ""}
  <title>Nodevision PHP Preview</title>
  <style>
    body { font-family: monospace; margin: 0; background: #f4f5f8; color: #1a1d22; }
    .bar { padding: 8px 10px; border-bottom: 1px solid #d2d6de; background: #fff; }
    .wrap { display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:10px; }
    pre { margin:0; white-space:pre-wrap; background:#12161d; color:#dce9ff; padding:8px; min-height:190px; border-radius:6px; }
    .panel { border:1px solid #d4d8df; border-radius:8px; background:#fff; overflow:hidden; }
    h3 { margin:0; padding:8px; font:12px monospace; border-bottom:1px solid #e5e8ed; }
  </style>
</head>
<body>
  <div class="bar">Nodevision PHP Preview (simulated render)</div>
  <div class="wrap">
    <div class="panel"><h3>User PHP</h3><pre>${escapedCode}</pre></div>
    <div class="panel"><h3>Generated Runtime PHP</h3><pre>${escapedGenerated}</pre></div>
  </div>
</body>
</html>`;
}

export function createPreviewRenderer(state, iframe, modeBadge) {
  return function renderPreview(force = false) {
    if (!force && state.code === state.lastRenderedCode) return;
    state.lastRenderedCode = state.code;

    if (state.serverBase) {
      iframe.src = `${state.serverBase.replace(/\/+$/, "")}/${normalizePath(state.filePath)}`;
      modeBadge.textContent = "Live Preview: server render";
      return;
    }

    buildGeneratedPhp(state);
    iframe.srcdoc = buildPreviewHtml(state);
    modeBadge.textContent = "Live Preview: simulated render";
  };
}
