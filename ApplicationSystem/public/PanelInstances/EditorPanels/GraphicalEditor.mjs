// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditor.mjs
// This file defines browser-side Graphical Editor logic for the Nodevision UI. It resolves editor modules from ModuleMap.csv, manages editor lifecycle cleanup, and keeps shared toolbar and attention state aligned with the active file.

import { clearEditorContext, setBusyOperation, setEditorContext } from "../../EditorAttentionState.mjs";
import "/EditorSwitchGuard.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { setWordCountVisibility } from "/StatusBar.mjs";
import {
  registerLiveFileContentProvider,
  touchLiveFileContentProvider,
} from "/LiveFileContent.mjs";
import { loadModuleMap as loadSharedModuleMap } from "/PanelInstances/ModuleMapLoader.mjs";

let lastEditedPath = null;
let graphicalEditorHostRef = null;
let currentGraphicalEditorCleanup = null;
let currentGraphicalLiveCleanup = null;
let graphicalLiveProviderSequence = 0;
const FALLBACK_EDITOR_BY_EXT = {
  png: "PNGeditor.mjs",
  ico: "PNGeditor.mjs",
};

/* ---------------------------------------------------------
 * ModuleMap loader (mirrors FileView.mjs behavior)
 * --------------------------------------------------------- */
async function loadModuleMap() {
  try {
    return await loadSharedModuleMap();
  } catch (err) {
    console.error("❌ Error loading ModuleMap.csv:", err);
    return {};
  }
}

/* ---------------------------------------------------------
 * Editor resolution
 * --------------------------------------------------------- */
function resolveExtension(filePath) {
  const raw = String(filePath || "").trim();
  if (!raw) return "";

  const readExtensionFromPathLike = (pathLike = "") => {
    const clean = String(pathLike || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/[?#].*$/, "");
    if (!clean) return "";

    const lower = clean.toLowerCase().replace(/%2e/gi, ".");
    if (lower.endsWith(".alto.xml")) return "alto";
    if (lower.endsWith(".musicxml.xml")) return "musicxml";
    if (lower.endsWith(".tar.gz")) return "tar.gz";
    if (lower.endsWith(".nvcircuit.json")) return "nvcircuit.json";
    if (lower.endsWith(".td.json")) return "td.json";
    if (lower.endsWith(".terrain.json")) return "terrain.json";

    const lastSegment = lower.split("/").pop() || lower;
    if (lastSegment.includes(".")) {
      const token = (lastSegment.split(".").pop() || "").trim().toLowerCase();
      const sanitized = token.replace(/[^a-z0-9_+-]/g, "");
      if (sanitized) return sanitized;
    }

    // Last-resort compatibility path: if path wrappers obscure the final segment,
    // still honor explicit ".ico" occurrences so icon files mount the raster editor.
    if (/\.ico(?=$|[^a-z0-9_+-])/i.test(lower)) return "ico";
    return "";
  };

  const candidates = [];
  const pushCandidate = (value) => {
    if (!value) return;
    const text = String(value).trim();
    if (!text) return;
    candidates.push(text);
    try {
      const decoded = decodeURIComponent(text);
      if (decoded && decoded !== text) candidates.push(decoded);
    } catch {
      // Keep undecoded candidate only.
    }
  };

  pushCandidate(raw);

  try {
    const parsed = new URL(raw, window.location.origin);
    pushCandidate(parsed.pathname || "");
    ["path", "file", "filename", "filepath", "selectedFilePath"].forEach((key) =>
      pushCandidate(parsed.searchParams.get(key) || "")
    );
    for (const value of parsed.searchParams.values()) {
      pushCandidate(value);
    }
  } catch {
    const [withoutHash] = raw.split("#");
    const [pathPart, queryPart = ""] = withoutHash.split("?");
    pushCandidate(pathPart);
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      ["path", "file", "filename", "filepath", "selectedFilePath"].forEach((key) =>
        pushCandidate(params.get(key) || "")
      );
      for (const value of params.values()) {
        pushCandidate(value);
      }
    }
  }

  for (const candidate of [...new Set(candidates)]) {
    const ext = readExtensionFromPathLike(candidate);
    if (ext) return ext;
  }

  return "";
}

async function resolveEditorModule(filePath) {
  const basePath = "/PanelInstances/EditorPanels/GraphicalEditors";
  const ext = resolveExtension(filePath);
  const rawLower = String(filePath || "").toLowerCase().replace(/%2e/gi, ".");
  const isIcoPath =
    ext === "ico" ||
    /\.ico(?=$|[^a-z0-9_+-])/i.test(rawLower);
  const normalizedExt = isIcoPath ? "ico" : ext;
  const moduleMap = await loadModuleMap();

  const moduleMapEmpty = !moduleMap || Object.keys(moduleMap).length === 0;
  const entry = moduleMap[normalizedExt] || moduleMap[""] || {};
  const forcedEditorFile = isIcoPath ? "PNGeditor.mjs" : null;
  const editorFile =
    forcedEditorFile ||
    entry?.editor ||
    (moduleMapEmpty ? FALLBACK_EDITOR_BY_EXT[normalizedExt] : null) ||
    "EditorFallback.mjs";

  // Safety check
  if (!/^[\w.-]+\.mjs$/.test(editorFile)) {
    console.warn("⚠️ Invalid editor module name:", editorFile);
    return { modulePath: `${basePath}/EditorFallback.mjs`, family: entry?.family || null, ext: normalizedExt };
  }

  return { modulePath: `${basePath}/${editorFile}`, family: entry?.family || null, ext: normalizedExt };
}

function shouldShowWordCount({ family = null, ext = "" } = {}) {
  const lowerExt = String(ext || "").toLowerCase();
  if (family === "Publication") return true;
  // Equation family includes LaTeX-style files where word count is helpful.
  if (family === "Equation") return true;
  return new Set(["html", "htm", "md", "markdown", "tex", "latex"]).has(lowerExt);
}

function liveContentMimeTypeForPath(filePath = "") {
  const ext = resolveExtension(filePath);
  if (ext === "html" || ext === "htm") return "text/html";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "md" || ext === "markdown") return "text/markdown";
  if (ext === "csv") return "text/csv";
  if (ext === "tsv") return "text/tab-separated-values";
  if (ext === "json" || ext.endsWith(".json")) return "application/json";
  return "text/plain";
}

function readGraphicalLiveContent(filePath, editorDiv) {
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

function isGraphicalEditorHostAppAttribute(name = "") {
  const attr = String(name || "").toLowerCase();
  return attr === "id" ||
    attr === "class" ||
    attr === "style" ||
    attr === "hidden" ||
    attr === "role" ||
    attr === "tabindex" ||
    attr.startsWith("aria-") ||
    attr === "data-current-file-path" ||
    attr.startsWith("data-nv-");
}

export function graphicalLiveMutationRecordsContainDocumentChange(records = [], editorDiv = null) {
  return Array.from(records || []).some((record) => {
    if (!record) return false;
    if (record.type !== "attributes") return true;
    if (record.target === editorDiv && isGraphicalEditorHostAppAttribute(record.attributeName)) return false;
    return true;
  });
}

function registerGraphicalEditorLiveProvider(filePath, editorDiv) {
  if (typeof currentGraphicalLiveCleanup === "function") {
    currentGraphicalLiveCleanup();
    currentGraphicalLiveCleanup = null;
  }
  if (!filePath || !editorDiv) return null;

  if (!editorDiv.dataset.nvLiveProviderId) {
    graphicalLiveProviderSequence += 1;
    editorDiv.dataset.nvLiveProviderId = "graphical-editor-" + String(graphicalLiveProviderSequence);
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
    getContent: () => readGraphicalLiveContent(filePath, editorDiv),
  });

  let timer = 0;
  const touch = (reason = "content") => {
    touchLiveFileContentProvider(providerId, {
      filePath,
      mimeType: liveContentMimeTypeForPath(filePath),
      reason,
    });
  };
  const schedule = (reason = "content") => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => touch(reason), 80);
  };
  const events = ["input", "change", "keyup", "paste", "cut", "pointerup", "focusin", "pointerdown"];
  const handlers = new Map(events.map((eventName) => [eventName, () => schedule(eventName)]));
  handlers.forEach((handler, eventName) => editorDiv.addEventListener(eventName, handler, true));
  const observer = typeof MutationObserver !== "undefined"
    ? new MutationObserver((records) => {
        if (graphicalLiveMutationRecordsContainDocumentChange(records, editorDiv)) schedule("mutation");
      })
    : null;
  observer?.observe?.(editorDiv, { subtree: true, childList: true, characterData: true, attributes: true });
  touch("registered");

  currentGraphicalLiveCleanup = () => {
    window.clearTimeout(timer);
    handlers.forEach((handler, eventName) => editorDiv.removeEventListener(eventName, handler, true));
    observer?.disconnect?.();
    cleanupProvider();
  };
  return currentGraphicalLiveCleanup;
}

function cleanupEditorHost(editorDiv) {
  if (typeof currentGraphicalLiveCleanup === "function") {
    currentGraphicalLiveCleanup();
    currentGraphicalLiveCleanup = null;
  }
  if (!editorDiv) return;
  const cleanup = editorDiv.__nvActiveEditorCleanup;
  if (typeof cleanup === "function") {
    try {
      cleanup();
    } catch (err) {
      console.warn("Graphical editor cleanup hook failed:", err);
    }
  }
  editorDiv.__nvActiveEditorCleanup = null;
  if (currentGraphicalEditorCleanup === cleanup) currentGraphicalEditorCleanup = null;
  clearEditorContext(window.currentActiveFilePath || window.filePath || null);
}

function claimGraphicalEditorHost(host) {
  if (!host) return null;
  document.querySelectorAll("#graphical-editor").forEach((node) => {
    if (node !== host) {
      node.dataset.nvInactiveElementId = "graphical-editor";
      node.removeAttribute("id");
    }
  });
  host.id = "graphical-editor";
  host.dataset.nvGraphicalEditorRoot = "true";
  graphicalEditorHostRef = host;
  return host;
}

function activeGraphicalEditorHost() {
  const activeContent = document.querySelector(".panel-cell.active-panel .nv-panel-tab-content:not([hidden])");
  return activeContent?.querySelector?.("[data-nv-graphical-editor-root=\"true\"], #graphical-editor") || null;
}

function getGraphicalEditorHost(host = null) {
  const explicit = host?.matches?.("[data-nv-graphical-editor-root=\"true\"], #graphical-editor")
    ? host
    : host?.querySelector?.("[data-nv-graphical-editor-root=\"true\"], #graphical-editor");
  if (explicit) return claimGraphicalEditorHost(explicit);

  const activeHost = activeGraphicalEditorHost();
  if (activeHost) return claimGraphicalEditorHost(activeHost);

  if (graphicalEditorHostRef && document.body.contains(graphicalEditorHostRef) && (!window.__nvPanelTabContentIsActive || window.__nvPanelTabContentIsActive(graphicalEditorHostRef))) {
    return claimGraphicalEditorHost(graphicalEditorHostRef);
  }

  const byId = document.getElementById("graphical-editor");
  if (byId && (!window.__nvPanelTabContentIsActive || window.__nvPanelTabContentIsActive(byId))) return claimGraphicalEditorHost(byId);
  return null;
}

function activateGraphicalEditorHost(host) {
  const editorDiv = getGraphicalEditorHost(host);
  if (!editorDiv) return false;
  const filePath = editorDiv.dataset.nvGraphicalEditorPath ||
    editorDiv.dataset.currentFilePath ||
    editorDiv.closest(".nv-panel-tab-content")?.dataset?.currentFilePath ||
    lastEditedPath ||
    "";
  const owningCell = editorDiv.closest?.(".panel-cell") || null;
  if (owningCell) {
    window.activeCell = owningCell;
    window.activePanel = "GraphicalEditor";
    window.activePanelClass = "EditorPanel";
    owningCell.dataset.id = "GraphicalEditor";
    owningCell.dataset.panelId = "GraphicalEditor";
    owningCell.dataset.panelClass = "EditorPanel";
  }
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = "GraphicalEditor";
  window.NodevisionState.currentMode = "GraphicalEditing";
  window.NodevisionState.activeActionHandler = null;
  if (filePath) {
    if (owningCell) owningCell.dataset.currentFilePath = filePath;
    window.currentActiveFilePath = filePath;
    window.filePath = filePath;
    window.NodevisionState.selectedFile = filePath;
    window.NodevisionState.selectedFileIsDirectory = false;
    window.NodevisionState.activeEditorFilePath = filePath;
  }
  updateToolbarState({
    currentMode: "GraphicalEditing",
    selectedFile: filePath || null,
    activeEditorFilePath: filePath || null,
    activeActionHandler: null,
  });
  const svgContext = editorDiv.__nvSvgEditorContext || owningCell?.__nvSvgEditorContext || null;
  if (svgContext?.kind === "svg" && typeof svgContext.activate === "function" && svgContext.activate()) {
    // SVG files need their precise toolbar mode; the generic GraphicalEditing mode hides SVG Draw/Insert items.
  } else {
    const htmlContext = editorDiv.__nvHtmlEditorContext || owningCell?.__nvHtmlEditorContext || null;
    if (htmlContext?.kind === "html" && typeof htmlContext.activate === "function") {
      htmlContext.activate();
    }
  }
  window.highlightActiveCell?.(owningCell);
  if (owningCell) {
    window.dispatchEvent(new CustomEvent("activePanelChanged", {
      detail: { panel: "GraphicalEditor", cell: owningCell, panelClass: "EditorPanel" },
    }));
  }
  return true;
}

function enableGraphicalEditorActivation(editorDiv) {
  if (!editorDiv || editorDiv.dataset.nvGraphicalEditorActivationBound === "true") return;
  editorDiv.dataset.nvGraphicalEditorActivationBound = "true";
  const activate = () => {
    if (window.__nvPanelTabContentIsActive && !window.__nvPanelTabContentIsActive(editorDiv)) return;
    activateGraphicalEditorHost(editorDiv);
  };
  editorDiv.addEventListener("pointerdown", activate, { capture: true });
  editorDiv.addEventListener("mousedown", activate, { capture: true });
  editorDiv.addEventListener("click", activate, { capture: true });
  editorDiv.addEventListener("focusin", activate, { capture: true });
}

/* ---------------------------------------------------------
 * Panel setup
 * --------------------------------------------------------- */
export async function setupPanel(cell, instanceVars = {}) {
  const container = document.createElement("div");
  container.className = "nv-graphical-editor-host";
  container.dataset.nvGraphicalEditorRoot = "true";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  cell.appendChild(container);
  claimGraphicalEditorHost(container);
  enableGraphicalEditorActivation(container);

  // Reactive watcher for selectedFilePath
  if (!window._graphicalEditorProxyInstalled) {
    let internalPath = window.selectedFilePath || null;

    Object.defineProperty(window, "selectedFilePath", {
      get() {
        return internalPath;
      },
      set(value) {
        if (value !== internalPath) {
          const applyChange = () => {
            internalPath = value;
            const editorHost = getGraphicalEditorHost();
            if (editorHost && (!window.__nvPanelTabContentIsActive || window.__nvPanelTabContentIsActive(editorHost))) {
              updateGraphicalEditor(value, { host: editorHost });
            }

            const viewPanel = document.getElementById("element-view");
            if (viewPanel && typeof window.updateViewPanel === "function" && (!window.__nvPanelTabContentIsActive || window.__nvPanelTabContentIsActive(viewPanel))) {
              window.updateViewPanel(value).catch((err) => {
                console.error("❌ GraphicalEditor -> FileView sync failed:", err);
              });
            }
          };
          if (typeof window.__nvGuardFileSwitch === "function") {
            window.__nvGuardFileSwitch(value, applyChange);
          } else {
            applyChange();
          }
        }
      },
      configurable: true,
    });

    window._graphicalEditorProxyInstalled = true;
    console.log("✅ GraphicalEditor reactive watcher installed.");
  }

  // Initial render
  const initialPath = instanceVars.filePath || window.selectedFilePath;
  await updateGraphicalEditor(initialPath, { force: true, host: container });
  activateGraphicalEditorHost(container);

  return () => {
    cleanupEditorHost(container);
    cleanupGraphicalEditorAttention(lastEditedPath || window.currentActiveFilePath || null);
  };
}

/* ---------------------------------------------------------
 * Editor update
 * --------------------------------------------------------- */
export async function updateGraphicalEditor(
  filePath,
  { force = false, host = null } = {}
) {
  const editorDiv = getGraphicalEditorHost(host);
  if (!editorDiv) {
    console.error("Graphical editor element not found.");
    return;
  }

  if (!filePath) {
    cleanupGraphicalEditorAttention(lastEditedPath || window.currentActiveFilePath || null);
    setWordCountVisibility(false);
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.activePanelType = "GraphicalEditor";
    window.NodevisionState.currentMode = "GraphicalEditing";
    window.NodevisionState.activeActionHandler = null;
    window.NodevisionState.selectedFile = null;
    window.NodevisionState.activeEditorFilePath = null;
    updateToolbarState({
      currentMode: "GraphicalEditing",
      activeActionHandler: null,
    });
    window.currentActiveFilePath = null;
    window.filePath = null;

    const { renderEditor } = await import(
      "/PanelInstances/EditorPanels/GraphicalEditors/EditorFallback.mjs"
    );
    cleanupEditorHost(editorDiv);
    editorDiv.innerHTML = "";
    renderEditor("(no file selected)", editorDiv);
    return;
  }

  if (!force && filePath === lastEditedPath) {
    console.log("🔁 Editor already active for:", filePath);
    return;
  }

  lastEditedPath = filePath;
  cleanupEditorHost(editorDiv);
  editorDiv.dataset.currentFilePath = filePath;
  editorDiv.dataset.nvGraphicalEditorPath = filePath;
  editorDiv.closest(".nv-panel-tab-content")?.setAttribute("data-current-file-path", filePath);
  editorDiv.closest(".panel-cell")?.setAttribute("data-current-file-path", filePath);
  editorDiv.innerHTML = "";

  // Keep global "active file" state aligned with the file shown in the graphical editor.
  window.currentActiveFilePath = filePath;
  window.filePath = filePath;
  window.selectedFilePath = filePath;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = "GraphicalEditor";
  window.NodevisionState.currentMode = "GraphicalEditing";
  window.NodevisionState.activeActionHandler = null;
  window.NodevisionState.selectedFile = filePath;
  window.NodevisionState.selectedFileIsDirectory = false;
  window.NodevisionState.activeEditorFilePath = filePath;
  updateToolbarState({
    currentMode: "GraphicalEditing",
    activeActionHandler: null,
  });

  console.log("🧭 Loading graphical editor for:", filePath);

  try {
    setBusyOperation({ id: "editor-loading", label: "Loading editor", detail: filePath, cancellable: false });
    const resolution = await resolveEditorModule(filePath);
    const { modulePath, family, ext } = resolution;
    const attentionFamily = (family || ext || "graphical").toLowerCase();
    setEditorContext({
      filePath,
      fileFamily: attentionFamily,
      fileFamilyLabel: family || ext?.toUpperCase?.() || "Graphical",
      editorMode: `${ext || attentionFamily}-graphical`,
      editorModeLabel: family ? `${family} Editing` : `${(ext || "Graphical").toUpperCase()} Editing`,
    });
    setWordCountVisibility(shouldShowWordCount({ family, ext }));
    const editorFile = modulePath.split("/").pop();
    window.__nodevisionGraphicalEditorLastError = null;
    window.__nodevisionGraphicalEditorLastAttempt = {
      filePath,
      extension: ext,
      editorFile,
      modulePath,
      timestamp: Date.now(),
    };

    if (!window.__nvModuleCacheBust) {
      window.__nvModuleCacheBust = Date.now();
    }
    const editorImportPath = `${modulePath}${modulePath.includes("?") ? "&" : "?"}v=${window.__nvModuleCacheBust}`;
    const editor = await import(editorImportPath);

    if (typeof editor.renderEditor === "function") {
      const cleanup = await editor.renderEditor(filePath, editorDiv);
      if (typeof cleanup === "function") {
        currentGraphicalEditorCleanup = cleanup;
        editorDiv.__nvActiveEditorCleanup = cleanup;
      } else if (cleanup && typeof cleanup.destroy === "function") {
        currentGraphicalEditorCleanup = () => cleanup.destroy();
        editorDiv.__nvActiveEditorCleanup = currentGraphicalEditorCleanup;
      }
      registerGraphicalEditorLiveProvider(filePath, editorDiv);
      setBusyOperation(null);
      console.log("✅ Editor rendered:", modulePath);
    } else {
      throw new Error("renderEditor() not found");
    }
  } catch (err) {
    setBusyOperation(null);
    setWordCountVisibility(false);
    console.error("❌ Failed to load editor:", err);
    const attempt = window.__nodevisionGraphicalEditorLastAttempt || {};
    window.__nodevisionGraphicalEditorLastError = {
      ...attempt,
      message: err?.message || String(err),
      stack: err?.stack || null,
      timestamp: Date.now(),
    };

    const { renderEditor } = await import(
      "/PanelInstances/EditorPanels/GraphicalEditors/EditorFallback.mjs"
    );
    cleanupEditorHost(editorDiv);
    renderEditor(filePath, editorDiv, { error: window.__nodevisionGraphicalEditorLastError });
  }
}

// Expose globally
window.updateGraphicalEditor = updateGraphicalEditor;
window.__nvActivateGraphicalEditorHost = activateGraphicalEditorHost;


function cleanupGraphicalEditorAttention(filePath) {
  try {
    currentGraphicalEditorCleanup?.();
  } catch (error) {
    console.warn("Graphical editor cleanup failed", error);
  }
  currentGraphicalEditorCleanup = null;
  clearEditorContext(filePath || window.currentActiveFilePath || window.filePath || null);
}
