// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileView.mjs
// This file defines browser-side File View logic for the Nodevision UI. It renders interface components and handles user interactions.

let lastRenderedPath = null;
let viewDivRef = null;


let moduleMapCache = null;

async function loadModuleMap() {
  // Only use cache if it has actual entries (not empty from failed load)
  if (moduleMapCache && Object.keys(moduleMapCache).length > 0) {
    return moduleMapCache;
  }

  try {
    // Use relative path - browser will resolve through current origin/proxy
    const csvUrl = "/PanelInstances/ModuleMap.csv";
    console.log("📦 Fetching ModuleMap from:", csvUrl);
    const res = await fetch(csvUrl, { cache: "no-store" });
    console.log("📦 ModuleMap fetch status:", res.status, res.statusText);
    if (!res.ok) {
      console.error("❌ Failed to load ModuleMap.csv, status:", res.status);
      // Don't cache failures - allow retry
      return {};
    }

    const text = await res.text();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    const header = lines.shift().split(",").map(h => h.trim());
    const idx = {
      ext: header.indexOf("Extension"),
      viewer: header.indexOf("ViewerModule"),
      editor: header.indexOf("GraphicalEditorModule"),
    };

    const map = {};

    for (const line of lines) {
      const cols = line.split(",").map(c => c.trim());
      const ext = cols[idx.ext] || "";
      map[ext.toLowerCase()] = {
        viewer: cols[idx.viewer] || null,
        editor: cols[idx.editor] || null,
      };
    }

    moduleMapCache = map;
    console.log("📦 moduleMap loaded:", map);
    return map;
  } catch (err) {
    console.error("❌ Error loading ModuleMap.csv:", err);
    moduleMapCache = {};
    return moduleMapCache;
  }
}

function resolveExtension(filename) {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".alto.xml")) return "alto";
  if (lower.endsWith(".musicxml.xml")) return "musicxml"; // future-proofing
  if (lower.endsWith(".tar.gz")) return "tar.gz";          // optional

  return lower.split(".").pop();
}

function activateFileViewPanel() {
  const cell = getFileViewCell();
  if (!cell) return;

  window.activeCell = cell;
  window.activePanel = "FileView";
  window.activePanelClass = cell.dataset.panelClass || "ViewPanel";
  if (window.NodevisionState) {
    window.NodevisionState.activePanelType = window.activePanelClass;
  }

  if (window.highlightActiveCell) {
    window.highlightActiveCell(cell);
  }

  window.dispatchEvent(new CustomEvent("activePanelChanged", {
    detail: { panel: "FileView", cell, panelClass: window.activePanelClass }
  }));
}

function enableViewActivation(viewDiv) {
  if (!viewDiv) return;
  const handler = () => activateFileViewPanel();
  viewDiv.addEventListener("pointerdown", handler, { capture: true });
  viewDiv.addEventListener("mousedown", handler, { capture: true });
}

function getFileViewCell() {
  if (viewDivRef) {
    const cell = viewDivRef.closest?.(".panel-cell");
    if (cell) {
      return cell;
    }
  }
  return document.querySelector(`[data-id="FileView"]`);
}

function installFileViewPointerTracking() {
  if (window.__nvFileViewPointerTrackingInstalled) return;

  const handler = (event) => {
    if (!event?.target) return;
    const cell = getFileViewCell();
    if (!cell || !cell.contains(event.target)) return;
    activateFileViewPanel();
  };

  document.addEventListener("pointerdown", handler, true);
  document.addEventListener("mousedown", handler, true);
  window.__nvFileViewPointerTrackingInstalled = true;
}

function installFileViewFocusHandler() {
  if (window.__nvFileViewFocusHandlerInstalled) return;

  const focusHandler = (event) => {
    const cell = getFileViewCell();
    if (!cell || !cell.contains(event?.target)) {
      return;
    }
    activateFileViewPanel();
  };

  document.addEventListener("focusin", focusHandler, true);
  window.__nvFileViewFocusHandlerInstalled = true;
}

function handleFileSavedForView(event) {
  try {
    const savedPath = event?.detail?.filePath;
    if (!savedPath) return;

    if (savedPath === lastRenderedPath) {
      console.log("📡 FileViewer live-refresh for:", savedPath);
      updateViewPanel(savedPath, { force: true }).catch((err) => {
        console.error("❌ Live-refresh updateViewPanel failed:", err);
      });
    }
  } catch (err) {
    console.error("❌ Live-refresh handler error:", err);
  }
}

function installFileViewLiveRefresh() {
  if (window.__nvFileViewLiveRefreshInstalled) return;
  window.addEventListener("nodevision-file-saved", handleFileSavedForView);
  window.__nvFileViewLiveRefreshInstalled = true;
}

function attachIframeActivation(node) {
  if (!node) return;
  if (node instanceof HTMLIFrameElement) {
    installIframeActivation(node);
  } else if (node.querySelectorAll) {
    node.querySelectorAll("iframe").forEach((iframe) => installIframeActivation(iframe));
  }
}

function observeViewIframes(viewDiv) {
  if (!viewDiv) return;
  if (viewDiv.__nvIframeObserver) return;

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        attachIframeActivation(node);
      }
    }
  });

  viewDiv.__nvIframeObserver = observer;
  observer.observe(viewDiv, { childList: true, subtree: true });
  attachIframeActivation(viewDiv);
}

function installIframeActivation(iframe) {
  if (!iframe) return;
  if (iframe.__nvFileViewActivationAttached) return;
  iframe.__nvFileViewActivationAttached = true;

  const handler = () => activateFileViewPanel();

  const tryAttachDocument = () => {
    try {
      const doc = iframe.contentDocument;
      if (!doc || doc.__nvFileViewActivationAttached) return;
      doc.__nvFileViewActivationAttached = true;
      doc.addEventListener("mousedown", handler, { capture: true });
      doc.addEventListener("pointerdown", handler, { capture: true });
    } catch (err) {
      // Accessing cross-origin documents will throw; ignore indicator.
    }
  };

  iframe.addEventListener("pointerdown", handler, { capture: true });
  iframe.addEventListener("focus", handler, true);
  iframe.addEventListener("load", () => {
    tryAttachDocument();
  });
  tryAttachDocument();
}


export async function setupPanel(panel, instanceVars = {}) {
  // Create container for view content
  const viewDiv = document.createElement("div");
  viewDiv.id = "element-view";
  viewDiv.style.width = "100%";
  viewDiv.style.height = "100%";
  viewDiv.style.overflow = "auto";
  viewDivRef = viewDiv;
  panel.appendChild(viewDiv);
  enableViewActivation(viewDiv);
  observeViewIframes(viewDiv);
  installFileViewPointerTracking();
  installFileViewFocusHandler();
  installFileViewLiveRefresh();

  // Reactive watcher for window.selectedFilePath
  if (!window._selectedFileProxyInstalled) {
    let internalPath = window.selectedFilePath || null;

    Object.defineProperty(window, "selectedFilePath", {
      get() {
        return internalPath;
      },
      set(value) {
        if (value !== internalPath) {
          console.log("📂 selectedFilePath changed:", value);
          internalPath = value;
          updateViewPanel(value).catch(err => {
            console.error("❌ updateViewPanel error:", err);
          });
        }
      },
      configurable: true,
    });

    window._selectedFileProxyInstalled = true;
    console.log("✅ Reactive selectedFilePath watcher installed.");
  }

  // Listen for iframe -> parent click messages
  window.addEventListener("message", (event) => {
    if (event.data?.type === "activatePanel" && event.data?.id === "FileView") {
      activateFileViewPanel();
      console.log("Active panel via postMessage:", window.activePanel);
    }
  });

  // Initial render if filePath provided
  if (instanceVars.filePath) {
    window.selectedFilePath = instanceVars.filePath;
    lastRenderedPath = null; // 🔹 reset so update will run
    updateViewPanel(instanceVars.filePath).catch(err => {
      console.error("❌ Initial updateViewPanel error:", err);
    });
  }
}

export async function updateViewPanel(element, { force = false } = {}) {
  const viewPanel = document.getElementById("element-view");
  if (!viewPanel) {
    console.error("View panel element not found.");
    return;
  }

  const filename = element || window.selectedFilePath;
  if (!filename) {
    viewPanel.innerHTML = "<em>No file selected.</em>";
    return;
  }

  // Skip rendering for directories (no extension or known directory names)
  const ext = resolveExtension(filename);
  const lowerFilename = filename.toLowerCase();
  if (!ext || lowerFilename === ext || !filename.includes('.')) {
    console.log("📁 Skipping directory view for:", filename);
    return;
  }

  // Prevent redundant rerenders unless forced
  if (!force && filename === lastRenderedPath) {
    console.log("🔁 File already displayed:", filename);
    return;
  }
  lastRenderedPath = filename;

  console.log("🧭 Updating view panel for file:", filename);
  viewPanel.innerHTML = "";

  // Determine server base depending on file type
  const isPHP = ext === "php";
  const origin = window.location.origin;
  const serverBase = isPHP ? `${origin}/php` : `${origin}/Notebook`;

  await renderFile(filename, viewPanel, serverBase);
}

async function renderFile(filename, viewPanel, serverBase) {
  console.log(`📄 renderFile() called for: ${filename}`);
  let iframe = null;

  try {
    // 1. Get the module map from the CSV file
    console.log("📦 Loading module map...");
    const moduleMap = await loadModuleMap();
    console.log("📦 Module map loaded, keys:", Object.keys(moduleMap).slice(0, 10));
    const basePath = "/PanelInstances/ViewPanels/FileViewers";

    // 2. Determine file extension and lookup viewer
    const ext = resolveExtension(filename);

    // Use ViewText.mjs as fallback if no extension or mapping exists
    const viewerInfo = moduleMap[ext] || moduleMap[""] || { viewer: "ViewText.mjs" };
    let viewerFile = viewerInfo.viewer;

    if (!viewerFile) {
      console.warn(`⚠️ No viewer module defined for extension: ${ext}. Defaulting to ViewText.mjs.`);
      viewerFile = "ViewText.mjs";
    }

    const modulePath = `${basePath}/${viewerFile}`;
    console.log(`🔍 Loading viewer module: ${modulePath}`);

    const viewer = await import(modulePath);

    // Let viewer specify if it wants an iframe
    const wantsIframe = viewer.wantsIframe === true;

    if (wantsIframe) {
      iframe = document.createElement("iframe");
      Object.assign(iframe.style, {
        width: "100%",
        height: "100%",
        border: "none"
      });
      viewPanel.appendChild(iframe);
      installIframeActivation(iframe);
    }

    // Clean up PHP path for server
    let cleanPath = filename;
    // Check viewerFile instead of ext for robustness against future changes
    if (viewerFile === "ViewPHP.mjs" && cleanPath.startsWith("Notebook/")) {
      cleanPath = cleanPath.slice("Notebook/".length);
    }

    // Call viewer
    await viewer.renderFile(cleanPath, viewPanel, iframe, serverBase);
    console.log(`✅ Rendered with ${viewerFile}`);

  } catch (err) {
    console.error(`❌ renderFile failed for ${filename}:`, err);
    viewPanel.innerHTML = `<em>Error loading viewer for ${filename}: ${err.message}</em>`;

  } finally {
    installIframeActivation(iframe);
  }
}

// Expose globally
window.updateViewPanel = updateViewPanel;
window.renderFile = renderFile;
