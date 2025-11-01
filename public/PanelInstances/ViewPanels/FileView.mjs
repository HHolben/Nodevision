// Nodevision/public/PanelInstances/ViewPanels/FileView.mjs
// Purpose: Panel that reacts to window.selectedFilePath and dynamically loads the proper viewer module.

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

  // Initial render if filePath provided
  if (instanceVars.filePath) {
    window.selectedFilePath = instanceVars.filePath;
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
  height: "100%",           // fill parent vertically
  border: "none",
  display: "block",
  flex: "1 1 auto",         // participate in flex layout
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
  viewPanel.appendChild(iframe); // reattach to ensure correct order
  iframe.src = "";

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
    pdf: "ViewPDF.mjs",
    png: "ViewImage.mjs",
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
