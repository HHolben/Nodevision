// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/RenderFile.mjs
// This module implements render File behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createPerformanceOperation, incrementPerformanceCounter } from "/PerformanceDiagnostics.mjs";
import { loadModuleMap, resolveExtension, stableModuleImportUrl, setFileViewStatus } from "./GetViewPanelElement.mjs";
import { loadedViewerModuleUrls } from "./CancelScheduledSelectedFileViewRender.mjs";
import { installIframeActivation } from "./InstallIframeActivation.mjs";
import { attachIframeActivation } from "./InstallFileViewFocusHandler.mjs";
import { createNotebookFile, refreshNavigatorsForDirectory, setSelectedFilePathFromFileView } from "./NotebookFileExists.mjs";
import { updateViewPanel } from "./UpdateViewPanel.mjs";

// Render File operations.
export async function renderFile(filename, viewPanel, serverBase, options = {}) {
  console.log("📄 renderFile() called for: " + filename);
  const perf = createPerformanceOperation("FileView render", {
    path: filename
  });
  let iframe = null;
  try {
    // 1. Get the module map from the CSV file
    console.log("📦 Loading module map...");
    const moduleMap = await loadModuleMap();
    console.log("📦 Module map loaded, keys:", Object.keys(moduleMap).slice(0, 10));
    perf.mark("module-map", {
      entries: Object.keys(moduleMap).length
    });
    const basePath = "/PanelInstances/ViewPanels/FileViewers";

    // 2. Determine file extension and lookup viewer
    const ext = resolveExtension(filename);

    // Use ViewText.mjs as fallback if no extension or mapping exists
    const viewerInfo = moduleMap[ext] || moduleMap[""] || {
      viewer: "ViewText.mjs"
    };
    let viewerFile = viewerInfo.viewer;
    if (!viewerFile) {
      console.warn(`⚠️ No viewer module defined for extension: ${ext}. Defaulting to ViewText.mjs.`);
      viewerFile = "ViewText.mjs";
    }
    const modulePath = basePath + "/" + viewerFile;
    const moduleUrl = stableModuleImportUrl(modulePath, "v");
    const moduleAlreadyLoaded = loadedViewerModuleUrls.has(moduleUrl);
    incrementPerformanceCounter("FileView.viewerImportAttempts");
    if (!moduleAlreadyLoaded) incrementPerformanceCounter("FileView.viewerModuleFirstLoads");
    perf.count("viewerImportAttempts");
    perf.count(moduleAlreadyLoaded ? "viewerModuleCacheHits" : "viewerModuleFirstLoads");
    console.log("🔍 Loading viewer module: " + moduleUrl);
    const viewer = await import(moduleUrl);
    loadedViewerModuleUrls.add(moduleUrl);
    perf.mark("viewer-import", {
      viewerFile,
      moduleAlreadyLoaded
    });

    // Let viewer specify if it wants an iframe
    const wantsIframe = viewer.wantsIframe === true;
    if (wantsIframe) {
      iframe = document.createElement("iframe");
      Object.assign(iframe.style, {
        width: "100%",
        height: "100%",
        border: "none"
      });
      iframe.src = "about:blank";
      viewPanel.appendChild(iframe);
      installIframeActivation(iframe, viewPanel);
    }
    const normalizeNotebookPath = value => {
      let cleaned = String(value || "").replace(/\\/g, "/").trim();
      cleaned = cleaned.replace(/^\/+/, "");
      if (cleaned.toLowerCase().startsWith("notebook/")) {
        cleaned = cleaned.slice("Notebook/".length);
      }
      return cleaned;
    };

    // Normalize paths so viewers consistently receive Notebook-relative paths.
    // (Some panels emit "Notebook/..." or "/Notebook/..."-prefixed values.)
    let cleanPath = normalizeNotebookPath(filename);
    // Check viewerFile instead of ext for robustness against future changes.
    // PHP uses a separate proxy/root, but still expects Notebook-relative paths.
    if (viewerFile === "ViewPHP.mjs") {
      cleanPath = normalizeNotebookPath(cleanPath);
    }

    // Call viewer
    const renderResult = await viewer.renderFile(cleanPath, viewPanel, iframe, serverBase, options);
    perf.mark("viewer-render", {
      viewerFile
    });
    if (renderResult === false) {
      console.warn("⚠️ Viewer reported render failure: " + viewerFile);
      perf.end({
        ext,
        viewerFile,
        success: false,
        reportedFailure: true
      });
      return false;
    }
    console.log("✅ Rendered with " + viewerFile);
    perf.end({
      ext,
      viewerFile,
      success: true
    });
    return true;
  } catch (err) {
    console.error(`❌ renderFile failed for ${filename}:`, err);
    viewPanel.innerHTML = "<em>Error loading viewer for " + filename + ": " + err.message + "</em>";
    perf.end({
      success: false,
      error: err?.message || String(err)
    });
    return false;
  } finally {
    attachIframeActivation(viewPanel, viewPanel);
    installIframeActivation(iframe, viewPanel);
  }
}

// Expose globally

export function createProceedHandler(owner) {
  return async () => {
    owner.button.disabled = true;
    owner.button.textContent = "Creating...";
    try {
      await createNotebookFile(owner.indexPath);
      await refreshNavigatorsForDirectory(owner.cleanDirectory);
      if (owner.selectCreatedFile) {
        setSelectedFilePathFromFileView(owner.indexPath, false);
        await updateViewPanel(owner.indexPath, {
          force: true
        });
      } else {
        await updateViewPanel(owner.cleanDirectory, {
          force: true
        });
      }
    } catch (err) {
      console.error("[FileView] Failed to create index.html:", err);
      owner.button.disabled = false;
      owner.button.textContent = "Create index.html";
      setFileViewStatus("File Viewer", "Create failed: " + (err?.message || err));
    }
  };
}
