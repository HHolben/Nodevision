// Nodevision/public/panels/panelFactory.mjs
// Panel factory: creates DOM containers for panels, lazy-loads per-instance modules,
// and invokes the panel's exported initializer. Uses a module cache to avoid re-imports.

const moduleCache = new Map();

/**
 * Resolve the module path for a given instance and class.
 * instanceName: e.g. "FileManager", "CodeEditor", "GraphPanel"
 * panelClass: e.g. "InfoPanel", "EditorPanel", "ViewPanel", "ControlPanel", "ToolPanel"
 */
function resolveModulePath(instanceName, panelClass) {
  const base = "/PanelInstances";
  switch ((panelClass || "").toLowerCase()) {
    case "infopanel":
      return `${base}/InfoPanels/${instanceName}.mjs`;
    case "editorpanel":
      return `${base}/EditorPanels/${instanceName}.mjs`;
    case "viewpanel":
      // "Viewer" or "ViewerPanels" — we used ViewerPanels earlier, so accept both
      return `${base}/ViewerPanels/${instanceName}.mjs`;
    case "controlpanel":
      return `${base}/ControlPanels/${instanceName}.mjs`;
    case "toolpanel":
      return `${base}/ToolPanels/${instanceName}.mjs`;
    case "compositepanel":
      return `${base}/CompositePanels/${instanceName}.mjs`;
    default:
      // generic fallback (top-level PanelInstances)
      return `${base}/${instanceName}.mjs`;
  }
}

/**
 * Load and cache a module via dynamic import.
 */
async function loadModule(modulePath) {
  if (moduleCache.has(modulePath)) {
    return moduleCache.get(modulePath);
  }
  // dynamic import; we rely on the server to serve the file under /PanelInstances/...
  const mod = await import(modulePath);
  moduleCache.set(modulePath, mod);
  return mod;
}

/**
 * Attempt to find an initializer function on the module and call it.
 * Acceptable names (in order):
 *  - createPanel(content, vars, panel)
 *  - init(content, vars, panel)
 *  - initializePanel(content, vars, panel)
 *  - create<InstanceName>Panel(content, vars, panel)
 *  - default export (if function)
 */
async function callModuleInitializer(mod, instanceName, contentElem, panelVars = {}, panelRoot = null) {
  const candidates = [
    "createPanel",
    "init",
    "initializePanel",
    `create${instanceName}Panel`,
    `create${instanceName.toLowerCase()}panel`
  ];

  for (const name of candidates) {
    if (typeof mod[name] === "function") {
      await mod[name](contentElem, panelVars, panelRoot);
      return true;
    }
  }

  if (typeof mod.default === "function") {
    await mod.default(contentElem, panelVars, panelRoot);
    return true;
  }

  return false;
}

/**
 * Main factory function
 * instanceName: e.g. "FileManager" (module file named FileManager.mjs)
 * instanceId: unique id for the DOM instance (e.g. "panel-3")
 * panelClass: the class/type (InfoPanel, EditorPanel, ViewPanel, etc.)
 * panelVars: object with contextual variables (filePath, currentDirectory, etc.)
 *
 * Returns { panel, header, dockBtn, maxBtn, closeBtn, resizer, content }
 */
export async function createPanelDOM(instanceName, instanceId, panelClass = "GenericPanel", panelVars = {}) {
  console.log(`createPanelDOM() called: instance="${instanceName}", id="${instanceId}", class="${panelClass}"`);

  // Create DOM shell
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.dataset.instanceName = instanceName;
  panel.dataset.instanceId = instanceId;
  panel.dataset.panelClass = panelClass;

  // Panel header
  const header = document.createElement("div");
  header.className = "panel-header";

  const title = document.createElement("span");
  title.className = "panel-title";
  title.textContent = panelVars.displayName || instanceName;
  title.style.fontSize = "13px";
  header.appendChild(title);

  // Controls
  const controls = document.createElement("div");
  controls.className = "panel-controls";

  const dockBtn = document.createElement("button");
  dockBtn.className = "panel-dock-btn";
  dockBtn.title = "Dock / Undock";
  dockBtn.textContent = "⇔";

  const maxBtn = document.createElement("button");
  maxBtn.className = "panel-max-btn";
  maxBtn.title = "Maximize / Restore";
  maxBtn.textContent = "⬜";

  const closeBtn = document.createElement("button");
  closeBtn.className = "panel-close-btn";
  closeBtn.title = "Close";
  closeBtn.textContent = "✖";

  controls.appendChild(dockBtn);
  controls.appendChild(maxBtn);
  controls.appendChild(closeBtn);
  header.appendChild(controls);

  // Content area
  const content = document.createElement("div");
  content.className = "panel-content";
  content.innerHTML = `<div class="panel-loading">Loading ${instanceName}...</div>`;

  // Resizer
  const resizer = document.createElement("div");
  resizer.className = "panel-resizer";

  // Assemble
  panel.appendChild(header);
  panel.appendChild(content);
  panel.appendChild(resizer);

  // Try to resolve & load instance module
  const modulePath = resolveModulePath(instanceName, panelClass);

  try {
    const mod = await loadModule(modulePath);

    const initialized = await callModuleInitializer(mod, instanceName, content, panelVars, panel);

    if (!initialized) {
      console.warn(`Module loaded from ${modulePath} but no initializer found. Falling back to default UI.`);
      content.innerHTML = `
        <div class="generic-panel">
          <h3>${panelVars.displayName || instanceName}</h3>
          <pre>${JSON.stringify(panelVars, null, 2)}</pre>
          <p style="color: #999">Module loaded but no init function exported.</p>
        </div>`;
    }
  } catch (err) {
    console.warn(`Could not load module at ${modulePath}:`, err);
    // Fallback UI per panelClass
    switch ((panelClass || "").toLowerCase()) {
      case "infopanel":
        content.innerHTML = `<div class="info-panel"><h3>${panelVars.displayName || instanceName}</h3><pre>${JSON.stringify(panelVars, null, 2)}</pre></div>`;
        break;
      case "editorpanel":
        content.innerHTML = `<textarea class="code-editor" spellcheck="false">// ${panelVars.displayName || instanceName}</textarea>`;
        break;
      case "viewpanel":
        content.innerHTML = `<div class="file-view"><p>Unable to load ${instanceName}. See console for details.</p></div>`;
        break;
      default:
        content.innerHTML = `<div class="generic-panel"><p>Panel type: ${panelClass}</p><pre>${JSON.stringify(panelVars, null, 2)}</pre></div>`;
    }
  }



  // === Panel control behavior ===

// Track maximized state
let isMaximized = false;
let prevStyles = {};

// Maximize / restore
maxBtn.addEventListener("click", () => {
  if (!isMaximized) {
    // Save current size & position
    prevStyles = {
      width: panel.style.width,
      height: panel.style.height,
      top: panel.style.top,
      left: panel.style.left,
      position: panel.style.position,
      zIndex: panel.style.zIndex
    };
    // Maximize to fill viewport
    Object.assign(panel.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      zIndex: 9999
    });
    isMaximized = true;
  } else {
    // Restore previous styles
    Object.assign(panel.style, prevStyles);
    isMaximized = false;
  }
});

// Close panel
closeBtn.addEventListener("click", () => {
  panel.remove();
});

// Dock / Undock toggle
let isDocked = true; // assume initially docked
dockBtn.addEventListener("click", () => {
  if (isDocked) {
    // Undock: make panel floating
    panel.style.position = "absolute";
    panel.style.top = panel.offsetTop + "px";
    panel.style.left = panel.offsetLeft + "px";
    panel.style.zIndex = 1000;
    isDocked = false;
  } else {
    // Dock: reset to default layout
    panel.style.position = "";
    panel.style.top = "";
    panel.style.left = "";
    panel.style.zIndex = "";
    isDocked = true;
  }
});

// Optional: make panel draggable when undocked
header.style.cursor = "move";
let offsetX = 0, offsetY = 0, dragging = false;

header.addEventListener("mousedown", (e) => {
  if (!isDocked) {
    dragging = true;
    offsetX = e.clientX - panel.offsetLeft;
    offsetY = e.clientY - panel.offsetTop;
    panel.style.userSelect = "none";
  }
});

document.addEventListener("mousemove", (e) => {
  if (dragging && !isDocked) {
    panel.style.left = e.clientX - offsetX + "px";
    panel.style.top = e.clientY - offsetY + "px";
  }
});

document.addEventListener("mouseup", () => {
  dragging = false;
  panel.style.userSelect = "";
});


  return { panel, header, dockBtn, maxBtn, closeBtn, resizer, content };
}
