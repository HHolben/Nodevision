// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PhpEditorUI.mjs
// This module assembles PHP editor panes and coordinates their preview, zoom, command and runtime lifecycles.
import { createStyleTagOnce, highlightPHP } from './PhpEditorPresentation.mjs';
import { installPhpEditorZoom } from './PhpEditorZoom.mjs';
import { mountDashboardWidgets } from './PhpEditorDashboard.mjs';
import { createPreviewRenderer } from './PhpEditorPreview.mjs';
import { installPhpEditorCommands } from './PhpEditorCommands.mjs';
import { startPhpEditorRuntime } from './PhpEditorRuntime.mjs';

export function setupEditorUI(state, container, options = {}) {
  createStyleTagOnce();
  const root = document.createElement("div");
  root.className = "nv-php-root";
  container.innerHTML = "";
  container.appendChild(root);

  const layout = document.createElement("div");
  layout.className = "nv-php-layout";
  root.appendChild(layout);

  const left = document.createElement("section");
  left.className = "nv-php-pane";
  layout.appendChild(left);

  const right = document.createElement("section");
  right.className = "nv-php-pane";
  layout.appendChild(right);

  const status = document.createElement("div");
  status.className = "nv-php-status";
  status.textContent = "Ready.";
  root.appendChild(status);

  const editorWrap = document.createElement("div");
  editorWrap.className = "nv-php-editor-wrap";
  left.appendChild(editorWrap);

  const highlight = document.createElement("pre");
  highlight.className = "nv-php-highlight";
  highlight.innerHTML = highlightPHP(state.code);
  editorWrap.appendChild(highlight);

  const input = document.createElement("textarea");
  input.className = "nv-php-input";
  input.spellcheck = false;
  input.value = state.code;
  editorWrap.appendChild(input);

  const rightGrid = document.createElement("div");
  rightGrid.className = "nv-php-right";
  right.appendChild(rightGrid);

  const previewWrap = document.createElement("div");
  previewWrap.className = "nv-php-preview-wrap";
  rightGrid.appendChild(previewWrap);
  const previewTitle = document.createElement("div");
  previewTitle.className = "nv-php-preview-title";
  previewWrap.appendChild(previewTitle);
  const previewIframe = document.createElement("iframe");
  previewIframe.className = "nv-php-preview";
  previewWrap.appendChild(previewIframe);
  const releaseZoom = installPhpEditorZoom(container, input, highlight, previewWrap, previewIframe);

  const dashWrap = document.createElement("div");
  dashWrap.className = "nv-php-dashboard-wrap";
  rightGrid.appendChild(dashWrap);
  const dashTitle = document.createElement("div");
  dashTitle.className = "nv-php-dashboard-title";
  dashTitle.textContent = "Runtime Dashboard";
  dashWrap.appendChild(dashTitle);
  const dashHost = document.createElement("div");
  dashHost.className = "nv-php-dashboard";
  dashWrap.appendChild(dashHost);

  const widgetRefs = mountDashboardWidgets(state, dashHost);
  const renderPreview = createPreviewRenderer(state, previewIframe, previewTitle);

  function syncInputScroll() {
    highlight.scrollTop = input.scrollTop;
    highlight.scrollLeft = input.scrollLeft;
  }

  input.addEventListener("scroll", syncInputScroll);
  input.addEventListener("input", () => {
    state.code = input.value;
    highlight.innerHTML = highlightPHP(state.code);
    syncInputScroll();
    renderPreview();
  });

  const runtimePanelState = { loggingRefresh: () => {} };
  const releaseCommands = installPhpEditorCommands(state, status, renderPreview, runtimePanelState);
  const releaseRuntime = startPhpEditorRuntime(state, widgetRefs, runtimePanelState, renderPreview, status);

  renderPreview(true);

  return {
    dispose() {
      releaseRuntime();
      releaseZoom();
      releaseCommands();
    }
  };
}
