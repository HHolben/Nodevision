// Nodevision/ApplicationSystem/public/NodevisionConsoleCommands.mjs
// Shared browser-console command glossary for the floating Nodevision Console.

const OPEN_PANEL_SNIPPET = (id, type = "InfoPanel", replaceActive = false) =>
  `window.dispatchEvent(new CustomEvent("toolbarAction", { detail: { id: "${id}", type: "${type}", replaceActive: ${replaceActive} } }))`;

const IMPORT_CALLBACK_SNIPPET = (category, callbackKey) =>
  `import("/ToolbarCallbacks/${category}/${callbackKey}.mjs").then((m) => m.default())`;

export const NODEVISION_CONSOLE_COMMANDS = Object.freeze([
  {
    id: "show-state",
    category: "Inspect",
    label: "Show App State",
    command: "window.NodevisionState",
    description: "Inspect the current browser-side Nodevision state object.",
    aliases: ["state", "mode", "current mode"],
  },
  {
    id: "show-active-file",
    category: "Inspect",
    label: "Show Active File",
    command: "window.currentActiveFilePath || window.selectedFilePath || window.NodevisionState?.activeEditorFilePath || window.NodevisionState?.selectedFile",
    description: "Return the active or selected file path known to the UI.",
    aliases: ["file", "path", "selected"],
  },
  {
    id: "list-panels",
    category: "Inspect",
    label: "List Panel Cells",
    command: "Array.from(document.querySelectorAll('.panel-cell')).map((cell) => ({ id: cell.dataset.id || '', panelClass: cell.dataset.panelClass || '', filePath: cell.dataset.currentFilePath || '' }))",
    description: "Show visible workspace panel cells and their current file context.",
    aliases: ["panels", "cells", "layout"],
  },
  {
    id: "active-panel",
    category: "Inspect",
    label: "Show Active Panel",
    command: "({ activePanel: window.activePanel, activePanelClass: window.activePanelClass, activeCell: window.activeCell?.dataset || null })",
    description: "Inspect the active panel globals used by layout controls.",
    aliases: ["active", "panel"],
  },
  {
    id: "health-check",
    category: "API",
    label: "Health Check",
    command: "fetch('/api/health').then((r) => r.json())",
    description: "Call the existing Nodevision health endpoint.",
    aliases: ["server", "health", "api"],
  },
  {
    id: "session",
    category: "API",
    label: "Session Info",
    command: "fetch('/api/session').then((r) => r.json())",
    description: "Inspect the current authenticated session through the existing API.",
    aliases: ["auth", "login", "user"],
  },
  {
    id: "list-notebook-root",
    category: "API",
    label: "List Notebook Root",
    command: "fetch('/api/listDirectory?path=Notebook').then((r) => r.json())",
    description: "List Notebook root entries through the existing directory API.",
    aliases: ["notebook", "directory", "files"],
  },
  {
    id: "open-file-manager",
    category: "Open Panels",
    label: "Open File Manager",
    command: OPEN_PANEL_SNIPPET("FileManager"),
    description: "Open or focus the File Manager panel.",
    aliases: ["files", "manager"],
  },
  {
    id: "open-graph-manager",
    category: "Open Panels",
    label: "Open Graph Manager",
    command: OPEN_PANEL_SNIPPET("GraphManager"),
    description: "Open or focus the Graph Manager panel.",
    aliases: ["graph", "nodes", "edges"],
  },
  {
    id: "open-file-viewer",
    category: "Open Panels",
    label: "Open File Viewer",
    command: OPEN_PANEL_SNIPPET("FileView", "ViewPanel"),
    description: "Open or focus the File Viewer panel.",
    aliases: ["viewer", "view"],
  },
  {
    id: "open-sync-panel",
    category: "Open Panels",
    label: "Open Sync Panel",
    command: OPEN_PANEL_SNIPPET("SyncPanel"),
    description: "Open or focus the Sync panel.",
    aliases: ["sync"],
  },
  {
    id: "open-iot-dashboard",
    category: "Open Panels",
    label: "Open IoT Dashboard",
    command: OPEN_PANEL_SNIPPET("IoTDashboard"),
    description: "Open or focus the IoT Dashboard panel.",
    aliases: ["iot", "dashboard"],
  },
  {
    id: "open-mqtt-explorer",
    category: "Open Panels",
    label: "Open MQTT Explorer",
    command: OPEN_PANEL_SNIPPET("MQTTExplorer"),
    description: "Open or focus the MQTT Explorer panel.",
    aliases: ["mqtt", "broker"],
  },
  {
    id: "open-comments",
    category: "View",
    label: "Open Comments",
    command: IMPORT_CALLBACK_SNIPPET("view", "commentsPanel"),
    description: "Toggle the comments panel through the existing View callback.",
    aliases: ["comments", "review"],
  },
  {
    id: "toggle-dark-mode",
    category: "View",
    label: "Toggle Dark Mode",
    command: IMPORT_CALLBACK_SNIPPET("view", "toggleDarkMode"),
    description: "Run the existing dark mode callback.",
    aliases: ["dark", "theme"],
  },
  {
    id: "save-layout",
    category: "View",
    label: "Save Current Layout",
    command: IMPORT_CALLBACK_SNIPPET("view", "SaveCurrentLayout"),
    description: "Run the existing layout save callback.",
    aliases: ["layout", "save"],
  },
  {
    id: "refresh-toolbar",
    category: "View",
    label: "Refresh Toolbar",
    command: "import('/panels/createToolbar.mjs').then(({ updateToolbarState }) => updateToolbarState(window.NodevisionState || {}))",
    description: "Rebuild the toolbar from the current Nodevision state.",
    aliases: ["toolbar", "refresh"],
  },
  {
    id: "reload-app",
    category: "View",
    label: "Reload App",
    command: IMPORT_CALLBACK_SNIPPET("view", "reloadApp"),
    description: "Reload Nodevision through the existing View callback.",
    aliases: ["reload", "refresh app"],
  },
  {
    id: "save-file",
    category: "File",
    label: "Save Active File",
    command: IMPORT_CALLBACK_SNIPPET("file", "saveFile"),
    description: "Run the existing save-file callback for the active editor.",
    aliases: ["save", "file"],
  },
  {
    id: "update-edges",
    category: "Graph",
    label: "Update Edges",
    command: IMPORT_CALLBACK_SNIPPET("file", "UpdateEdges"),
    description: "Run the existing graph edge update callback.",
    aliases: ["edges", "links", "graph"],
  },
  {
    id: "clear-console",
    category: "Console",
    label: "Clear Nodevision Console",
    command: "window.NVNodevisionConsole?.clear()",
    description: "Clear the floating Nodevision Console transcript.",
    aliases: ["clear", "terminal"],
  },
]);

export function getNodevisionConsoleCommands() {
  return NODEVISION_CONSOLE_COMMANDS.map((entry) => ({ ...entry }));
}

export function searchNodevisionConsoleCommands(query = "") {
  const terms = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  const commands = getNodevisionConsoleCommands();
  if (!terms.length) return commands;

  return commands
    .map((entry) => {
      const haystack = [
        entry.category,
        entry.label,
        entry.command,
        entry.description,
        ...(entry.aliases || []),
      ].join(" ").toLowerCase();

      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
    .map(({ entry }) => entry);
}
