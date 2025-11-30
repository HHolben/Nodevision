// Nodevision/public/PanelInstances/ViewPanels/FileView.mjs
// Reactively displays files in the view panel using the appropriate viewer.

let lastRenderedPath = null;

export async function setupPanel(panel, instanceVars = {}) {
  // Create container for view content
  const viewDiv = document.createElement("div");
  viewDiv.id = "element-view";
  viewDiv.style.width = "100%";
  viewDiv.style.height = "100%";
  viewDiv.style.overflow = "auto";
  panel.appendChild(viewDiv);

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
          updateViewPanel(value);
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
      const cell = document.querySelector(`[data-id="FileView"]`);
      if (cell) {
        window.activeCell = cell;
        window.activePanel = "FileView";
        document.querySelectorAll(".panel-cell").forEach((c) => (c.style.outline = ""));
        cell.style.outline = "2px solid #0078d7";
        console.log("Active panel via postMessage:", window.activePanel);
      }
    }
  });

  // Initial render if filePath provided
  if (instanceVars.filePath) {
    window.selectedFilePath = instanceVars.filePath;
    lastRenderedPath = null; // 🔹 reset so update will run
    updateViewPanel(instanceVars.filePath);
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

  // Prevent redundant rerenders unless forced
  if (!force && filename === lastRenderedPath) {
    console.log("🔁 File already displayed:", filename);
    return;
  }
  lastRenderedPath = filename;

  console.log("🧭 Updating view panel for file:", filename);
  viewPanel.innerHTML = "";

  // Determine server base depending on file type
  const ext = filename.split(".").pop().toLowerCase();
  const isPHP = ext === "php";
  const serverBase = isPHP ? "http://localhost:8080" : "http://localhost:3000/Notebook";

  await renderFile(filename, viewPanel, serverBase);
}

async function renderFile(filename, viewPanel, serverBase) {
  console.log(`📄 renderFile() called for: ${filename}`);

  // Viewer module map
  const basePath = "/PanelInstances/ViewPanels/FileViewers";
  const moduleMap = {
    bmp:  "ViewImage.mjs",
    csv:  "ViewCSV.mjs",
    gif:  "ViewImage.mjs",
    html: "ViewHTML.mjs",
    htm:  "ViewHTML.mjs",
    ipynb: "ViewIPYN.mjs",
    jpg:  "ViewImage.mjs",
    jpeg: "ViewImage.mjs",
    mid:  "ViewMidi.mjs",
    midi: "ViewMidi.mjs",
    pdf:  "ViewPDF.mjs",
    pgn:  "ViewPGN.mjs",
    php: "ViewPHP.mjs",
    png:  "ViewPNG.mjs",
    scad: "ViewSCAD.mjs",
    stl:  "ViewSTL.mjs",
    svg:  "ViewSVG.mjs",
    webp: "ViewImage.mjs",
  };

  const viewerFile = moduleMap[filename.split(".").pop().toLowerCase()] || "ViewText.mjs";
  const modulePath = `${basePath}/${viewerFile}`;
  console.log(`🔍 Loading viewer module: ${modulePath}`);

  try {
    const viewer = await import(modulePath);

    // Let viewer specify if it wants an iframe
    const wantsIframe = viewer.wantsIframe === true;
    let iframe = null;

    if (wantsIframe) {
      iframe = document.createElement("iframe");
      Object.assign(iframe.style, {
        width: "100%",
        height: "100%",
        border: "none"
      });
      viewPanel.appendChild(iframe);
    }

    // Clean up PHP path for server
    let cleanPath = filename;
    if (viewerFile === "ViewPHP.mjs" && cleanPath.startsWith("Notebook/")) {
      cleanPath = cleanPath.slice("Notebook/".length);
    }

    // Call viewer
    await viewer.renderFile(cleanPath, viewPanel, iframe, serverBase);
    console.log(`✅ Rendered with ${viewerFile}`);

  } catch (err) {
    console.error(`❌ Failed to import ${modulePath}:`, err);
    viewPanel.innerHTML = `<em>Error loading viewer for ${filename}</em>`;
  }
}

// Expose globally
window.updateViewPanel = updateViewPanel;
window.renderFile = renderFile;
