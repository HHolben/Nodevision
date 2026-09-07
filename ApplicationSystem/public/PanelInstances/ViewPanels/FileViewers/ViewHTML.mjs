// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewHTML.mjs
// This file defines browser-side View HTML logic for the Nodevision UI. It renders interface components and handles user interactions.
import { createHtmlLayersContext } from "/PanelInstances/Common/Layers/htmlLayersContext.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

export const wantsIframe = true;

const HTML_VIEW_ZOOM_FIT_MODE = "anchor-top-left";
const HTML_VIEW_KEYBOARD_ZOOM_FACTOR = 1.1;

function clamp(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function htmlWheelZoomFactor(event) {
  const deltaY = Number.isFinite(Number(event?.deltaY)) ? Number(event.deltaY) : 0;
  return Math.exp(-clamp(deltaY, -600, 600, 0) * 0.0015);
}

function zoomShortcutAction(event) {
  if (!(event?.ctrlKey || event?.metaKey) || event.altKey) return null;
  const key = String(event.key || "").toLowerCase();
  const code = String(event.code || "");
  if (key === "+" || key === "=" || code === "NumpadAdd") return "in";
  if (key === "-" || key === "_" || code === "NumpadSubtract") return "out";
  if (key === "0" || code === "Digit0" || code === "Numpad0") return "reset";
  return null;
}

function htmlViewerPanel(viewPanel) {
  return viewPanel?.closest?.(".panel") ||
    viewPanel?.closest?.(".nv-panel-tab-content") ||
    viewPanel?.closest?.(".panel-cell") ||
    viewPanel ||
    null;
}

function applyHtmlViewerZoom(viewPanel, factor) {
  const tools = window.NodevisionPanelViewportTools;
  const panel = htmlViewerPanel(viewPanel);
  const activePanel = tools?.getActivePanelElement?.();
  if (!tools?.setPanelViewportState || !tools?.getPanelViewportState || !panel || !activePanel) return false;
  const current = Number(tools.getPanelViewportState?.(panel)?.zoom) || 1;
  const next = clamp(current * factor, 0.1, 8, current);
  tools.setPanelViewportState?.({ zoom: next, panX: 0, panY: 0 }, panel);
  return true;
}

function resetHtmlViewerZoom(viewPanel) {
  const tools = window.NodevisionPanelViewportTools;
  const panel = htmlViewerPanel(viewPanel);
  const activePanel = tools?.getActivePanelElement?.();
  if (!tools?.resetPanelViewport || !tools?.getActivePanelElement || !panel || !activePanel) return false;
  tools.resetPanelViewport?.(panel);
  return true;
}

function stopZoomShortcut(event) {
  event.preventDefault?.();
  event.stopPropagation?.();
  event.stopImmediatePropagation?.();
}

function installHtmlViewerZoomHandlers(iframe, viewPanel, iframeDoc) {
  if (!iframe || !iframeDoc) return;
  iframe.__nvHtmlViewerZoomCleanup?.();

  const onWheel = (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    if (!applyHtmlViewerZoom(viewPanel, htmlWheelZoomFactor(event))) return;
    stopZoomShortcut(event);
  };

  const onKeyDown = (event) => {
    const action = zoomShortcutAction(event);
    if (!action) return;
    if (action === "reset") {
      if (!resetHtmlViewerZoom(viewPanel)) return;
      stopZoomShortcut(event);
      return;
    }
    if (!applyHtmlViewerZoom(viewPanel, action === "in" ? HTML_VIEW_KEYBOARD_ZOOM_FACTOR : 1 / HTML_VIEW_KEYBOARD_ZOOM_FACTOR)) return;
    stopZoomShortcut(event);
  };

  iframeDoc.addEventListener("wheel", onWheel, { capture: true, passive: false });
  iframeDoc.addEventListener("keydown", onKeyDown, true);
  iframe.__nvHtmlViewerZoomCleanup = () => {
    iframeDoc.removeEventListener("wheel", onWheel, { capture: true });
    iframeDoc.removeEventListener("keydown", onKeyDown, true);
    iframe.__nvHtmlViewerZoomCleanup = null;
  };
}


function escapeAttr(value = "") {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("\"", "&quot;");
}

function notebookDirectoryBase(path = "", serverBase = "/Notebook") {
  let cleanBase = String(serverBase || "/Notebook");
  while (cleanBase.endsWith("/")) cleanBase = cleanBase.slice(0, -1);
  const parts = String(path || "").replace(/\\/g, "/").split("/");
  parts.pop();
  const encodedDir = parts.filter(Boolean).map(encodeURIComponent).join("/");
  return cleanBase + "/" + encodedDir + (encodedDir ? "/" : "");
}

function withLiveBaseElement(html = "", path = "", serverBase = "/Notebook") {
  const base = "<base href=\"" + escapeAttr(notebookDirectoryBase(path, serverBase)) + "\">";
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b([^>]*)>/i, function(match, attrs) { return "<head" + attrs + ">" + base; });
  }
  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/<html\b([^>]*)>/i, function(match, attrs) { return "<html" + attrs + "><head>" + base + "</head>"; });
  }
  return "<!doctype html><html><head>" + base + "</head><body>" + html + "</body></html>";
}

export async function renderFile(path, viewPanel, iframe, serverBase, options = {}) {
  viewPanel.dataset.nvZoomInlineFit = HTML_VIEW_ZOOM_FIT_MODE;

  // Ensure the iframe is attached *inside* the panel
  if (!viewPanel.contains(iframe)) {
    viewPanel.innerHTML = ""; // clear previous content
    viewPanel.appendChild(iframe);
  }

  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.style.display = "block";

  // Reset previous layer context when switching files
  window.HTMLViewLayersContext = null;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = "HTMLviewing";
  window.NodevisionState.selectedFile = path;
  window.NodevisionState.activeFileViewPath = path;
  window.currentActiveFilePath = path;
  window.filePath = path;
  updateToolbarState({ currentMode: "HTMLviewing", selectedFile: path, activeFileViewPath: path });

  // Set up error and load handlers
  iframe.onerror = () => {
    iframe.srcdoc = `<p style="color:red;">Error loading ${path}</p>`;
  };

  iframe.onload = () => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      installHtmlViewerZoomHandlers(iframe, viewPanel, iframeDoc);
      const styleEl = iframeDoc.createElement("style");
      styleEl.dataset.nvHtmlViewerFrame = "true";
      styleEl.textContent = `
        html, body {
          margin: 0;
          padding: 0;
          min-width: 100%;
          min-height: 100%;
          background: white;
        }
      `;
      iframeDoc.head?.appendChild(styleEl);

      // Expose a layer context for the Layers panel (view mode)
      const body = iframeDoc.body;
      if (body) {
        window.HTMLViewLayersContext = createHtmlLayersContext(body, { title: "HTML Layers (View)" });
      }
    } catch (err) {
      console.warn("⚠️ Could not inject scaling style:", err);
    }
  };

  if (typeof options?.liveContent?.content === "string") {
    iframe.removeAttribute("src");
    iframe.srcdoc = withLiveBaseElement(options.liveContent.content, path, serverBase);
    return;
  }

  iframe.removeAttribute("srcdoc");
  iframe.src = String(serverBase || "/Notebook").replace(/\/+$/, "") + "/" + path;
}
