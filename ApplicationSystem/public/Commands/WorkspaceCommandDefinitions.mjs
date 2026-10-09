// Nodevision/ApplicationSystem/public/Commands/WorkspaceCommandDefinitions.mjs
// This module declares overlay, panel, viewer, editor, and file command metadata shared by the console and Session runtime.

const PANEL_CLASS_VALUES = ["InfoPanel", "EditorPanel", "ViewPanel", "ControlPanel", "ToolPanel", "CompositePanel"];
const arg = (name, type = "string", options = {}) => ({ name, type, ...options });

export const WORKSPACE_COMMANDS = Object.freeze([
  {
    id: "overlay.open", category: "Overlay", label: "Open Overlay",
    description: "Open a command-owned overlay through Nodevision's panel overlay layout.", sessionSafe: true,
    arguments: [arg("message", "string", { required: true }), arg("heading", "string")],
    returns: "overlay", events: ["overlay.opened", "overlay.submitted", "overlay.closed"],
  },
  {
    id: "overlay.show", category: "Overlay", label: "Show Overlay Message",
    description: "Show a message overlay with a Continue action.", sessionSafe: true,
    arguments: [arg("message", "string", { required: true })],
    returns: "overlay", events: ["overlay.opened", "session.continue", "overlay.submitted"],
  },
  {
    id: "overlay.close", category: "Overlay", label: "Close Overlay",
    description: "Close the active command-owned overlay if one is open.", sessionSafe: true,
    arguments: [], returns: "status", events: ["overlay.closed"],
  },
  {
    id: "overlay.clear", category: "Overlay", label: "Clear Overlay",
    description: "Alias for closing the active command-owned overlay.", sessionSafe: true,
    arguments: [], returns: "status", events: ["overlay.closed"],
  },
  {
    id: "overlay.setContent", category: "Overlay", label: "Set Overlay Content",
    description: "Replace text in the active command-owned overlay, opening one if needed.", sessionSafe: true,
    arguments: [arg("message", "string", { required: true })], returns: "status",
  },
  {
    id: "overlay.getInput", category: "Overlay", label: "Get Overlay Input",
    description: "Open an overlay prompt and return the submitted input text.", sessionSafe: true,
    arguments: [arg("message", "string", { required: true }), arg("placeholder", "string")],
    returns: "string", events: ["overlay.opened", "overlay.submitted", "overlay.closed"],
  },
  {
    id: "panel.open", category: "Panels", label: "Open Panel",
    description: "Ask the existing workspace panel system to open or focus a panel.", sessionSafe: true,
    arguments: [arg("panelId", "string", { required: true }), arg("panelClass", "enum", { values: PANEL_CLASS_VALUES, default: "InfoPanel" })],
    returns: "status", events: ["panel.opened"],
  },
  {
    id: "panel.close", category: "Panels", label: "Close Active Panel",
    description: "Close the active panel through Nodevision's existing close-panel callback.", sessionSafe: true,
    arguments: [], returns: "status", events: ["panel.closed"],
  },
  {
    id: "panel.focus", category: "Panels", label: "Focus Panel",
    description: "Focus an existing panel cell by id when it is already present.", sessionSafe: true,
    arguments: [arg("panelId", "string", { required: true })], returns: "status", events: ["panel.focused"],
  },
  {
    id: "viewer.open", category: "Viewer", label: "Open Viewer",
    description: "Open a Notebook file with the registered FileView viewer dispatch.", sessionSafe: true,
    arguments: [arg("path", "notebookPath", { required: true })], returns: "status", events: ["viewer.opened"],
  },
  {
    id: "viewer.currentFile", category: "Viewer", label: "Current Viewed File",
    description: "Return the Notebook file currently known to FileView.", sessionSafe: true,
    arguments: [], returns: "object",
  },
  {
    id: "viewer.close", category: "Viewer", label: "Close Viewer",
    description: "Close the active FileView panel when it is selected.", sessionSafe: true,
    arguments: [], returns: "status", events: ["viewer.closed"],
  },
  {
    id: "editor.open", category: "Editor", label: "Open Code Editor",
    description: "Open a Notebook file in the existing code editor panel.", sessionSafe: true,
    arguments: [arg("path", "notebookPath", { required: true })], returns: "status", events: ["editor.opened"],
  },
  {
    id: "editor.save", category: "Editor", label: "Save Active Editor",
    description: "Save the active editor through Nodevision's existing save callback.", sessionSafe: true,
    arguments: [], returns: "status", events: ["editor.saved"],
  },
  {
    id: "editor.currentFile", category: "Editor", label: "Current Edited File",
    description: "Return the active editor file path known to Nodevision.", sessionSafe: true,
    arguments: [], returns: "object",
  },
  {
    id: "editor.getContent", category: "Editor", label: "Get Editor Content",
    description: "Return content from the active editor bridge when available.", sessionSafe: true,
    arguments: [], returns: "string",
  },
  {
    id: "editor.setContent", category: "Editor", label: "Set Editor Content",
    description: "Set content in the active editor bridge without writing to disk.", sessionSafe: true,
    arguments: [arg("content", "string", { required: true })], returns: "status",
  },
  {
    id: "file.read", category: "Files", label: "Read Notebook File",
    description: "Read a Notebook text file through the existing safe file API.", sessionSafe: true,
    arguments: [arg("path", "notebookPath", { required: true })], returns: "string",
  },
  {
    id: "file.save", category: "Files", label: "Save Notebook File",
    description: "Save text content through Nodevision's existing Notebook save API.", sessionSafe: true,
    arguments: [arg("path", "notebookPath", { required: true }), arg("content", "string", { required: true })],
    returns: "status", events: ["file.saved"],
  },
  {
    id: "file.create", category: "Files", label: "Create Notebook File",
    description: "Create an empty Notebook file through the existing create API.", sessionSafe: true,
    arguments: [arg("path", "notebookPath", { required: true })], returns: "status",
  },
]);
