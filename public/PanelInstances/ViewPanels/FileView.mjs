// Nodevision/public/PanelInstances/ViewPanels/FileView.mjs
// This file reacts to window.selectedFilePath and dynamically loads the proper viewer module.

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
        console.log("Active panel via postMessage:", window.activePanel);
        document.querySelectorAll(".panel-cell").forEach((c) => (c.style.outline = ""));
        cell.style.outline = "2px solid #0078d7";
      }
    }
  });

  // Initial render if filePath provided
if (instanceVars.filePath) {
  window.selectedFilePath = instanceVars.filePath;
  lastRenderedPath = null;      // 🔹 reset so update will run
  updateViewPanel(instanceVars.filePath);
}

}

export async function updateViewPanel(element) {
  let viewPanel = document.getElementById("element-view");
  if (!viewPanel) {
    console.error("View panel element not found.");
    return;
  }

  // Create iframe for HTML or embedded rendering
  const iframe = document.createElement("iframe");
  iframe.id = "content-frame";
  Object.assign(iframe.style, {
    width: "100%",
    height: "100%",
    border: "none",
    display: "block",
    flex: "1 1 auto",
  });

  const filename = element || window.selectedFilePath;
  if (!filename) {
    viewPanel.innerHTML = "<em>No file selected.</em>";
    return;
  }

  if (filename === lastRenderedPath) {
    console.log("🔁 File already displayed:", filename);
    return;
  }
  lastRenderedPath = filename;

  console.log("🧭 Updating view panel for file:", filename);
  viewPanel.innerHTML = "";
  viewPanel.appendChild(iframe);
  iframe.src = "";

  // 🔹 Hook into iframe once it loads
  iframe.addEventListener("load", () => {
    try {
      // Inject lightweight click forwarding script if same-origin
      const script = `
        window.addEventListener("mousedown", () => {
          window.parent.postMessage({ type: "activatePanel", id: "FileView" }, "*");
        });
      `;
      const scriptTag = iframe.contentDocument.createElement("script");
      scriptTag.textContent = script;
      iframe.contentDocument.head.appendChild(scriptTag);
    } catch (err) {
      console.warn("⚠️ Could not inject click handler into iframe (possibly cross-origin):", err);
    }
  });

  const serverBase = "http://localhost:3000/Notebook";
  await renderFile(filename, viewPanel, iframe, serverBase);
}

async function renderFile(filename, viewPanel, iframe, serverBase) {
  console.log(`📄 renderFile() called for: ${filename}`);

  const ext = filename.split(".").pop().toLowerCase();
  const basePath = "/PanelInstances/ViewPanels/FileViewers";
  const moduleMap = {
    html: "ViewHTML.mjs",
    htm: "ViewHTML.mjs",
    csv: "ViewCSV.mjs",
    stl: "ViewSTL.mjs",
    svg: "ViewSVG.mjs",
    mid: "ViewMidi.mjs",
    midi: "ViewMidi.mjs",
    pdf: "ViewPDF.mjs",
    pgn: "ViewPGN.mjs",
    png: "ViewPNG.mjs",
    jpg: "ViewImage.mjs",
    jpeg: "ViewImage.mjs",
    gif: "ViewImage.mjs",
    webp: "ViewImage.mjs",
    bmp: "ViewImage.mjs",
    scad: "ViewSCAD.mjs",
  };

  const viewerModule = moduleMap[ext] || "ViewText.mjs"; // Default fallback
  const modulePath = `${basePath}/${viewerModule}`;
  console.log(`🔍 Loading viewer module: ${modulePath}`);

  try {
    const viewer = await import(modulePath);
    if (typeof viewer.renderFile === "function") {
      await viewer.renderFile(filename, viewPanel, iframe, serverBase);
      console.log(`✅ Rendered with ${viewerModule}`);
    } else {
      viewPanel.innerHTML = `<em>${viewerModule}</em> loaded, but no renderFile() found.`;
      console.warn(`⚠️ No renderFile() found in ${viewerModule}`);
    }
  } catch (err) {
    console.error(`❌ Failed to import ${modulePath}:`, err);
    viewPanel.innerHTML = `<em>Error loading viewer for ${filename}</em>`;
  }
}

// Expose globally
window.updateViewPanel = updateViewPanel;
window.renderFile = renderFile;
