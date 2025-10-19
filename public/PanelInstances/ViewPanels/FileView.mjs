// Nodevision/public/PanelInstances/ViewPanels/FileView.mjs
// Purpose: Panel for viewing files and automatically reacting to selectedFilePath changes

let lastRenderedPath = null;

export async function setupPanel(panel, instanceVars = {}) {
  // Create inner container for the view
  const viewDiv = document.createElement("div");
  viewDiv.id = "element-view";
  viewDiv.style.width = "100%";
  viewDiv.style.height = "100%";
  viewDiv.style.overflow = "auto";
  panel.appendChild(viewDiv);

  // Create iframe for rendering HTML
  const iframe = document.createElement("iframe");
  iframe.id = "content-frame";
  iframe.style.width = "100%";
  iframe.style.height = "400px";
  iframe.style.border = "1px solid #ccc";
  panel.appendChild(iframe);

  // Setup reactive tracking of selectedFilePath
  if (!window._selectedFileProxyInstalled) {
    let internalPath = window.selectedFilePath || null;

    window.selectedFilePath = internalPath;
    window._selectedFileProxyInstalled = true;

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

    console.log("✅ Reactive selectedFilePath watcher installed.");
  }

  // Render immediately if instanceVars specify a file
  if (instanceVars.filePath) {
    window.selectedFilePath = instanceVars.filePath;
    updateViewPanel(instanceVars.filePath);
  }
}

export async function updateViewPanel(element) {
  const viewPanel = document.getElementById("element-view");
  const iframe = document.getElementById("content-frame");

  if (!viewPanel) {
    console.error("View panel element not found.");
    return;
  }

  const filename = element || window.selectedFilePath;
  if (!filename) {
    viewPanel.innerHTML = "<em>No file selected.</em>";
    return;
  }

  if (filename === lastRenderedPath) {
    console.log("🔁 File already displayed:", filename);
    return; // avoid redundant renders
  }
  lastRenderedPath = filename;

  console.log("🧭 Updating view panel for file:", filename);

  viewPanel.innerHTML = "";
  iframe.src = "";

  const serverBase = "http://localhost:3000/Notebook";
  await renderFile(filename, viewPanel, iframe, serverBase);
}

async function renderFile(filename, viewPanel, iframe, serverBase) {
  console.log(`📄 renderFile() called for: ${filename}`);
  viewPanel.innerHTML = `<em>Rendering placeholder for:</em> ${filename}`;
}

// Expose globally
window.updateViewPanel = updateViewPanel;
window.renderFile = renderFile;
