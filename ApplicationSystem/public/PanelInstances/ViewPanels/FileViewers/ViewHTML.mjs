// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewHTML.mjs
// This file defines browser-side View HTML logic for the Nodevision UI. It renders interface components and handles user interactions.
import { createHtmlLayersContext } from "/PanelInstances/Common/Layers/htmlLayersContext.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

export const wantsIframe = true;

import { installHtmlViewerZoom } from './HtmlViewerZoom.mjs';

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
  iframe.__nvHtmlViewerZoomCleanup?.();
  viewPanel._dispose = () => { iframe.__nvHtmlViewerZoomCleanup?.(); iframe.onload = null; iframe.onerror = null; };

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
  const selectedPath = options.selectionPath || path;
  const selectedIsDirectory = Boolean(options.selectionIsDirectory);
  window.NodevisionState.currentMode = "HTMLviewing";
  window.NodevisionState.selectedFile = selectedPath;
  window.NodevisionState.selectedFileIsDirectory = selectedIsDirectory;
  window.NodevisionState.activeFileViewPath = path;
  window.currentActiveFilePath = path;
  window.filePath = path;
  updateToolbarState({ currentMode: "HTMLviewing", selectedFile: selectedPath, activeFileViewPath: path });

  // Set up error and load handlers
  iframe.onerror = () => {
    iframe.srcdoc = `<p style="color:red;">Error loading ${path}</p>`;
  };

  iframe.onload = () => {
    iframe.__nvHtmlViewerZoomCleanup?.();
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
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
        const context = createHtmlLayersContext(body, { title: "HTML Layers (View)", readOnly: true });
        window.HTMLViewLayersContext = context;
        const unregister = installHtmlViewerZoom(viewPanel, iframe);
        const cleanup = () => {
          unregister();
          if (window.HTMLViewLayersContext === context) window.HTMLViewLayersContext = null;
          if (iframe.__nvHtmlViewerZoomCleanup === cleanup) iframe.__nvHtmlViewerZoomCleanup = null;
        };
        iframe.__nvHtmlViewerZoomCleanup = cleanup;
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
