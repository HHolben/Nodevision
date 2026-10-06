// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewSVG.mjs
// This file defines browser-side View SVG logic for the Nodevision UI. It renders interface components and handles user interactions.

import { createElementLayers } from "../../EditorPanels/GraphicalEditors/ElementLayers.mjs";
import { svgContextPath } from "../../Common/Layers/svgLayersContext.mjs";

import { installContentPresentationZoom } from '/panels/contentPresentationZoom.mjs';
import { installPanelZoomIframe } from '/panels/panelZoomIframe.mjs';

export const wantsIframe = true;

function cleanBase(base = "/Notebook") {
  return String(base || "/Notebook").replace(/\/+$/, "") || "/Notebook";
}

/**
 * Renders an SVG file inside the view panel.
 * @param {string} filename - Path to the file relative to /Notebook
 * @param {HTMLElement} viewPanel - The panel container element
 * @param {HTMLIFrameElement} iframe - The shared FileView iframe
 * @param {string} serverBase - The server base path for the active Notebook route
 */
export async function renderFile(filename, viewPanel, iframe, serverBase = "/Notebook") {
  console.log(`[ViewSVG] renderFile -> ${filename}`);
  if (!viewPanel) throw new Error("ViewSVG: viewPanel container is required.");
  viewPanel.dataset.nvZoomInlineFit = "stretch-on-zoom-out";

  if (!iframe) {
    iframe = document.createElement("iframe");
  }

  if (!viewPanel.contains(iframe)) {
    viewPanel.innerHTML = "";
    viewPanel.appendChild(iframe);
  }

  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "1px solid #ccc";
  iframe.style.background = "white";
  iframe.style.display = "block";

  let context = null, disposed = false;
  function loaded() {
    if (disposed) return;
    context?.layers?.dispose();
    iframe.__nvSvgZoomCleanup?.();
    let root;
    try { root = iframe.contentDocument?.documentElement; } catch { return; }
    if (root?.localName !== "svg") return;
    const unregister = installContentPresentationZoom(iframe, iframe);
    const bridge = installPanelZoomIframe(iframe);
    iframe.__nvSvgZoomCleanup = () => { unregister(); bridge(); };
    context = { kind: "svg-view", filePath: filename, svgRoot: root, readOnly: true };
    context.layers = createElementLayers(root, null, { readOnly: true, getContext: () => context });
    viewPanel.__nvSvgViewLayersContext = context;
    if (!window.SVGViewLayersContext || svgContextPath(window.NodevisionState?.activeFileViewPath) === svgContextPath(filename)) window.SVGViewLayersContext = context;
    window.dispatchEvent(new CustomEvent("nv-svg-layers-provider-changed"));
  }
  const activate = event => {
    const activeHost = window.__nvActivePanelElement || event.detail?.cell;
    if (event.detail?.panel === "FileView" && context && activeHost?.contains(viewPanel)) {
      window.SVGViewLayersContext = context;
      queueMicrotask(() => window.dispatchEvent(new CustomEvent("nv-svg-layers-provider-changed")));
    }
  };
  window.addEventListener("activePanelChanged", activate);
  iframe.addEventListener("load", loaded);
  viewPanel._dispose = () => {
    window.removeEventListener("activePanelChanged", activate);
    delete viewPanel.__nvSvgViewLayersContext;
    disposed = true; iframe.__nvSvgZoomCleanup?.(); iframe.removeEventListener("load", loaded); context?.layers?.dispose();
    if (window.SVGViewLayersContext === context) window.SVGViewLayersContext = null;
    window.dispatchEvent(new CustomEvent("nv-svg-layers-provider-changed"));
  };
  iframe.src = cleanBase(serverBase) + "/" + String(filename || "").replace(/^\/+/, "");
}

// Optional global exposure
window.ViewSVG = { renderFile };
