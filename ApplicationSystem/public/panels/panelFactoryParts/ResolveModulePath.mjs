// Nodevision/ApplicationSystem/public/panels/panelFactoryParts/ResolveModulePath.mjs
// This module implements resolve Module Path behavior for the panelFactory feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Resolve Module Path operations.
export const moduleCache = new Map();

/**
 * Resolve the module path for a given instance and class.
 * instanceName: e.g. "FileManager", "CodeEditor", "GraphPanel"
 * panelClass: e.g. "InfoPanel", "EditorPanel", "ViewPanel", "ControlPanel", "ToolPanel"
 */

export
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

export
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

export
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
  const candidates = ["createPanel", "init", "initializePanel", `create${instanceName}Panel`, `create${instanceName.toLowerCase()}panel`];
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
