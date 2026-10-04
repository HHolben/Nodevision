// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditorParts/ReadGraphicalLiveContent.mjs
// This module implements read Graphical Live Content behavior for the GraphicalEditor feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { resolveExtension, GraphicalEditorModuleState, liveContentMimeTypeForPath } from "./LoadModuleMap.mjs";
import { registerHtmlLiveContent } from "../GraphicalEditors/HTMLeditorComponents/HtmlLiveContent.mjs";
import { registerLiveFileContentProvider, touchLiveFileContentProvider } from "/LiveFileContent.mjs";
import { incrementPerformanceCounter } from "/PerformanceDiagnostics.mjs";
import { clearEditorContext } from "../../../EditorAttentionState.mjs";

// Read Graphical Live Content operations.
export function readGraphicalLiveContent(filePath, editorDiv) {
  if (editorDiv?.__nvHtmlEditorContext) return editorDiv.__nvHtmlEditorContext.getHTML();
  const ext = resolveExtension(filePath);
  const markdownPreferred = new Set(["md", "markdown", "txt", "tex", "latex", "scad", "usd", "usda", "mtl", "obj", "ics", "php", "json", "xml"]);
  if (ext === "svg") {
    const svgContext = editorDiv?.__nvSvgEditorContext || window.SVGEditorContext || null;
    if (typeof svgContext?.getEditorHTML === "function") return svgContext.getEditorHTML();
    if (svgContext?.svgRoot) return new XMLSerializer().serializeToString(svgContext.svgRoot);
  }
  if (markdownPreferred.has(ext) && typeof window.getEditorMarkdown === "function") return window.getEditorMarkdown();
  if (typeof window.getEditorHTML === "function") return window.getEditorHTML();
  if (typeof window.getEditorMarkdown === "function") return window.getEditorMarkdown();
  const textarea = editorDiv?.querySelector?.("textarea");
  if (textarea) return textarea.value;
  return undefined;
}

export function isGraphicalEditorHostAppAttribute(name = "") {
  const attr = String(name || "").toLowerCase();
  return attr === "id" || attr === "class" || attr === "style" || attr === "hidden" || attr === "role" || attr === "tabindex" || attr.startsWith("aria-") || attr === "data-current-file-path" || attr.startsWith("data-nv-");
}

export function graphicalLiveMutationRecordsContainDocumentChange(records = [], editorDiv = null) {
  return Array.from(records || []).some(record => {
    if (!record) return false;
    if (record.type !== "attributes") return true;
    if (record.target === editorDiv && isGraphicalEditorHostAppAttribute(record.attributeName)) return false;
    return true;
  });
}

export function registerGraphicalEditorLiveProvider(filePath, editorDiv) {
  if (editorDiv?.__nvHtmlEditorContext) return registerHtmlLiveContent(editorDiv, editorDiv.__nvHtmlEditorContext);
  if (typeof GraphicalEditorModuleState.currentGraphicalLiveCleanup === "function") {
    GraphicalEditorModuleState.currentGraphicalLiveCleanup();
    GraphicalEditorModuleState.currentGraphicalLiveCleanup = null;
  }
  if (!filePath || !editorDiv) return null;
  if (!editorDiv.dataset.nvLiveProviderId) {
    GraphicalEditorModuleState.graphicalLiveProviderSequence += 1;
    editorDiv.dataset.nvLiveProviderId = "graphical-editor-" + String(GraphicalEditorModuleState.graphicalLiveProviderSequence);
  }
  const providerId = "nodevision-" + editorDiv.dataset.nvLiveProviderId;
  const cleanupProvider = registerLiveFileContentProvider({
    id: providerId,
    filePath,
    editorKind: "graphical",
    panelKind: "GraphicalEditor",
    sourceLabel: "Graphical Editor",
    mimeType: liveContentMimeTypeForPath(filePath),
    dirty: () => Boolean(editorDiv?.__nvSvgEditorContext?.isDirty?.() ?? window.NodevisionState?.fileIsDirty),
    getContent: () => readGraphicalLiveContent(filePath, editorDiv)
  });
  let timer = 0;
  const touch = (reason = "content") => {
    touchLiveFileContentProvider(providerId, {
      filePath,
      mimeType: liveContentMimeTypeForPath(filePath),
      reason
    });
  };
  const schedule = (reason = "content") => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => touch(reason), 80);
  };
  const events = ["input", "change", "keyup", "paste", "cut", "pointerup", "focusin", "pointerdown"];
  const handlers = new Map(events.map(eventName => [eventName, () => schedule(eventName)]));
  handlers.forEach((handler, eventName) => editorDiv.addEventListener(eventName, handler, true));
  incrementPerformanceCounter("GraphicalEditor.liveProviderRegistered");
  incrementPerformanceCounter("GraphicalEditor.liveListenersAdded", events.length);
  const observer = typeof MutationObserver !== "undefined" ? new MutationObserver(records => {
    if (graphicalLiveMutationRecordsContainDocumentChange(records, editorDiv)) schedule("mutation");
  }) : null;
  observer?.observe?.(editorDiv, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true
  });
  if (observer) incrementPerformanceCounter("GraphicalEditor.liveObserversAdded");
  touch("registered");
  GraphicalEditorModuleState.currentGraphicalLiveCleanup = () => {
    window.clearTimeout(timer);
    handlers.forEach((handler, eventName) => editorDiv.removeEventListener(eventName, handler, true));
    observer?.disconnect?.();
    cleanupProvider();
    incrementPerformanceCounter("GraphicalEditor.liveListenersRemoved", events.length);
    if (observer) incrementPerformanceCounter("GraphicalEditor.liveObserversDisconnected");
    incrementPerformanceCounter("GraphicalEditor.liveProviderRemoved");
    if (editorDiv.__nvGraphicalLiveCleanup === GraphicalEditorModuleState.currentGraphicalLiveCleanup) editorDiv.__nvGraphicalLiveCleanup = null;
  };
  editorDiv.__nvGraphicalLiveCleanup = GraphicalEditorModuleState.currentGraphicalLiveCleanup;
  return GraphicalEditorModuleState.currentGraphicalLiveCleanup;
}

export function cleanupEditorHost(editorDiv) {
  if (!editorDiv) return;
  const liveCleanup = editorDiv.__nvGraphicalLiveCleanup;
  if (typeof liveCleanup === "function") {
    liveCleanup();
    if (GraphicalEditorModuleState.currentGraphicalLiveCleanup === liveCleanup) GraphicalEditorModuleState.currentGraphicalLiveCleanup = null;
  }
  const cleanup = editorDiv.__nvActiveEditorCleanup;
  if (typeof cleanup === "function") {
    try {
      cleanup();
    } catch (err) {
      console.warn("Graphical editor cleanup hook failed:", err);
    }
  }
  editorDiv.__nvActiveEditorCleanup = null;
  if (GraphicalEditorModuleState.currentGraphicalEditorCleanup === cleanup) GraphicalEditorModuleState.currentGraphicalEditorCleanup = null;
  clearEditorContext(window.currentActiveFilePath || window.filePath || null);
}

export function claimGraphicalEditorHost(host) {
  if (!host) return null;
  document.querySelectorAll("#graphical-editor").forEach(node => {
    if (node !== host) {
      node.dataset.nvInactiveElementId = "graphical-editor";
      node.removeAttribute("id");
    }
  });
  host.id = "graphical-editor";
  host.dataset.nvGraphicalEditorRoot = "true";
  GraphicalEditorModuleState.graphicalEditorHostRef = host;
  return host;
}

export function activeGraphicalEditorHost() {
  const activeContent = document.querySelector(".panel-cell.active-panel .nv-panel-tab-content:not([hidden])");
  return activeContent?.querySelector?.("[data-nv-graphical-editor-root=\"true\"], #graphical-editor") || null;
}
