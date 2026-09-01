// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewHTML.mjs
// This file defines browser-side View HTML logic for the Nodevision UI. It renders interface components and handles user interactions.
import { createHtmlLayersContext } from "/PanelInstances/Common/Layers/htmlLayersContext.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

export const wantsIframe = true;

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
      const styleEl = iframeDoc.createElement("style");
      styleEl.textContent = `
        html, body {
          transform: scale(0.8);
          transform-origin: 0 0;
          width: 125%;
          height: 125%;
          margin: 0;
          padding: 0;
          overflow: auto;
          background: white;
        }
      `;
      iframeDoc.head.appendChild(styleEl);

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
