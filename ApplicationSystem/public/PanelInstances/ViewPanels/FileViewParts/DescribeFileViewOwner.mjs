// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/DescribeFileViewOwner.mjs
// This module implements describe File View Owner behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { describeFileViewElement, fileViewIframeDebugEnabled, fileViewRootFromTarget, activateFileViewHost } from "./ActivateFileViewPanel.mjs";
import { fileViewRootPath } from "./GetViewPanelElement.mjs";

// Describe File View Owner operations.
export function describeFileViewOwner(root, iframe = null) {
  const cell = root?.closest?.(".panel-cell") || null;
  const tab = root?.closest?.(".nv-panel-tab-content") || null;
  return {
    root: describeFileViewElement(root),
    cell: describeFileViewElement(cell),
    tab: describeFileViewElement(tab),
    path: fileViewRootPath(root),
    iframe: iframe ? {
      src: iframe.getAttribute?.("src") || iframe.src || "",
      connected: Boolean(iframe.isConnected),
      readyState: (() => {
        try {
          return iframe.contentDocument?.readyState || "";
        } catch {
          return "inaccessible";
        }
      })(),
      activeElement: document.activeElement === iframe
    } : null
  };
}

export function debugFileViewIframe(label, details = {}) {
  if (!fileViewIframeDebugEnabled()) return;
  try {
    const payload = typeof details === "function" ? details() : details;
    console.debug?.("[FileView][iframe] " + label, payload);
  } catch (err) {
    console.debug?.("[FileView][iframe] " + label, {
      diagnosticError: err?.message || String(err)
    });
  }
}

export function describeIframeEvent(event) {
  return {
    type: event?.type || "",
    target: describeFileViewElement(event?.target),
    activeElement: describeFileViewElement(document.activeElement),
    clientX: Number.isFinite(event?.clientX) ? event.clientX : null,
    clientY: Number.isFinite(event?.clientY) ? event.clientY : null
  };
}

export function describeSvgDocumentHitTest(iframe, doc) {
  const svg = doc?.documentElement || null;
  const tag = String(svg?.tagName || svg?.nodeName || "").toLowerCase();
  if (tag !== "svg") return null;
  const rect = svg.getBoundingClientRect?.() || null;
  const centerX = rect ? Math.max(0, Math.min(rect.width - 1, rect.width / 2)) : 0;
  const centerY = rect ? Math.max(0, Math.min(rect.height - 1, rect.height / 2)) : 0;
  let computed = null;
  let hit = null;
  try {
    computed = doc.defaultView?.getComputedStyle?.(svg) || null;
  } catch {}
  try {
    hit = doc.elementFromPoint?.(centerX, centerY) || null;
  } catch {}
  return {
    iframe: describeFileViewElement(iframe),
    documentReadyState: doc.readyState || "",
    documentContentType: doc.contentType || "",
    svg: {
      width: svg.getAttribute?.("width") || "",
      height: svg.getAttribute?.("height") || "",
      viewBox: svg.getAttribute?.("viewBox") || "",
      rect: rect ? {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      } : null,
      pointerEvents: computed?.pointerEvents || "",
      display: computed?.display || "",
      visibility: computed?.visibility || "",
      elementFromCenter: describeFileViewElement(hit)
    }
  };
}

export function installIframeDebugEventDiagnostics(iframe, doc, root) {
  if (!fileViewIframeDebugEnabled() || !doc) return null;
  const cleanup = [];
  const attach = (target, targetName, events, options = {
    capture: true
  }) => {
    if (!target?.addEventListener) return;
    for (const type of events) {
      const handler = event => debugFileViewIframe("event:" + targetName + ":" + type, () => ({
        owner: describeFileViewOwner(root, iframe),
        event: describeIframeEvent(event),
        svgHitTest: describeSvgDocumentHitTest(iframe, doc)
      }));
      target.addEventListener(type, handler, options);
      cleanup.push(() => target.removeEventListener(type, handler, options));
    }
  };
  const events = ["pointerdown", "mousedown", "click", "focusin", "focus", "contextmenu"];
  attach(doc, "document", events);
  attach(doc.documentElement, "documentElement", events);
  try {
    attach(iframe.contentWindow, "window", events, true);
  } catch {}
  debugFileViewIframe("svg-hit-test", () => ({
    owner: describeFileViewOwner(root, iframe),
    svgHitTest: describeSvgDocumentHitTest(iframe, doc)
  }));
  return () => cleanup.forEach(fn => {
    try {
      fn();
    } catch {}
  });
}

export function installFileViewPointerTracking() {
  if (window.__nvFileViewPointerTrackingInstalled) return;
  const handler = event => {
    if (!event?.target) return;
    const root = fileViewRootFromTarget(event.target);
    if (root) activateFileViewHost(root);
  };
  document.addEventListener("pointerdown", handler, true);
  document.addEventListener("mousedown", handler, true);
  window.__nvFileViewPointerTrackingInstalled = true;
}
