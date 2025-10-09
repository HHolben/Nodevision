// Nodevision/public/PanelInstances/InfoPanels/FileManager.mjs
// Sets up the File Manager panel and loads FileManagerCore.mjs

export function setupPanel(panelElem, panelVars = {}) {
  console.log("Initializing FileManager panel...", panelVars);

  // Create the panel structure
  panelElem.innerHTML = `
    <div class="file-manager">
      <h3>File Manager</h3>
      <div id="loading" style="display:none;">Loading...</div>
      <div id="error" style="color:red;"></div>
      <ul id="file-list" class="file-list"></ul>
      <div id="fm-path" style="margin-top:8px; font-size:0.9em; color:#555;"></div>
    </div>
  `;

  // Lazy-load the actual file management logic
  import("/PanelInstances/InfoPanels/FileManagerCore.mjs")
    .then(mod => {
      mod.initFileView(panelVars.currentDirectory || '');
    })
    .catch(err => {
      console.error("Failed to load FileManagerCore.mjs:", err);
      const errElem = panelElem.querySelector("#error");
      if (errElem) errElem.textContent = "Failed to initialize File Manager.";
    });
}
