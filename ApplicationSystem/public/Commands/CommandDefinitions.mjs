// Nodevision/ApplicationSystem/public/Commands/CommandDefinitions.mjs
// This module declares shared Nodevision command metadata consumed by the console, Session editor, and Session runtime.

const arg = (name, type = "string", options = {}) => ({ name, type, ...options });

import { HTML_FORM_INSERT_COMMANDS } from './HtmlFormCommandDefinitions.mjs';
import { WORKSPACE_COMMANDS } from './WorkspaceCommandDefinitions.mjs';

export const NODEVISION_SHARED_COMMANDS = Object.freeze([
  ...WORKSPACE_COMMANDS,
  { id: "terrain.representation", category: "World", label: "Terrain Representation", description: "List generated terrains or set voxel/polygonal representation for a terrain instance.", sessionSafe: false, arguments: [arg("mode", "string", {default:"list"}),arg("id", "string", {default:""})] },
  { id: "path.world", category: "World", label: "Physical Path", description: "Activate, configure, finish, cancel, create, update, extend, delete or toggle clearance-preview for a physical world path.", sessionSafe: false, arguments: [arg("action", "string", {default:"activate"}),arg("options", "any", {default:{}})] },
  { id: "model.insert", category: "Model", label: "Insert 3D Model", description: "Open shared Notebook, local file and Download selection for the active editor.", sessionSafe: false, arguments: [] },
  { id: "voxel.execute", category: "Voxel", label: "Voxel document action", description: "Run a GOX action on the active document; action parameters are listed in the voxel command form.", sessionSafe: false, arguments: [arg("action", "string", { required: true }), arg("parameters", "any", { default: {} })] },
  { id: "voxel.world", category: "Voxel", label: "Goxel Model world tool", description: "Choose/place/settings/commit/cancel/inventory/select/transform/duplicate/delete/edit-source/reload GOX instances.", sessionSafe: false, arguments: [arg("action", "string", { default: "choose" }), arg("options", "any", { default: {} })] },
  { id: "model.world", category: "Model", label: "3D Model world tool", description: "Choose/place/settings/commit/cancel/inventory/select/transform/duplicate/delete/edit-source/reload GLTF, GLB and GOX instances.", sessionSafe: false, arguments: [arg("action", "string", { default: "choose" }), arg("options", "any", { default: {} })] },
  { id: "voxel.place", category: "Voxel", label: "Place GOX artwork", description: "Reference Notebook GOX artwork in the active world, with optional position, rotation and scale.", sessionSafe: false, arguments: [arg("path", "notebookPath", { required: true }), arg("options", "any", { default: {} })] },
  { id: "bridging.open", category: "Session", label: "Focus Session — Bridging", description: "Write toward a net word-growth goal or countdown in the HTML graphical editor.", sessionSafe: true, arguments: [], returns: "status", events: ["session.bridging.finished"] },
  { id: "templatePopulator.open", category: "Session", label: "Open Template Populator", description: "Assign images to document template placeholders.", sessionSafe: true, arguments: [], returns: "status", events: ["session.templatePopulator.finished"] },
  {
    id: "speech.speak", category: "Speech", label: "Speak Text",
    description: "Speak text through the selected Nodevision speech provider.", sessionSafe: true,
    arguments: [arg("text", "string", { required: true })], returns: "status",
    events: ["speech.started", "speech.boundary", "speech.finished", "speech.cancelled", "speech.error"],
  },
  {
    id: "speech.stop", category: "Speech", label: "Stop Speech",
    description: "Cancel active speech through the selected Nodevision speech provider.", sessionSafe: true,
    arguments: [], returns: "status", events: ["speech.cancelled"],
  },
  {
    id: "speech.pause", category: "Speech", label: "Pause Speech",
    description: "Pause active speech when the selected provider supports it.", sessionSafe: true,
    arguments: [], returns: "status", events: ["speech.paused"],
  },
  {
    id: "speech.resume", category: "Speech", label: "Resume Speech",
    description: "Resume active speech when the selected provider supports it.", sessionSafe: true,
    arguments: [], returns: "status", events: ["speech.resumed"],
  },
  {
    id: "speech.setRate", category: "Speech", label: "Set Speech Rate",
    description: "Set the normalized rate used for later Nodevision speech.", sessionSafe: true,
    arguments: [arg("rate", "number", { required: true })], returns: "status",
  },
  {
    id: "console.open", category: "Console", label: "Open Nodevision Console",
    description: "Open the existing floating browser-context Nodevision Console.", sessionSafe: true,
    arguments: [], returns: "status",
  },
  {
    id: "session.emit", category: "Session", label: "Emit Session Event",
    description: "Emit a local serializable Session event for waits and tests.", sessionSafe: true,
    arguments: [arg("eventName", "string", { required: true }), arg("detail", "any")], returns: "status",
  },
  {
    id: "session.quit", category: "Session", label: "Quit Session",
    description: "Stop the active Session through the runtime cancellation path.", sessionSafe: true,
    arguments: [], returns: "status", events: ["session.quit"],
  },
  {
    id: "htmlDraftFocus.open", category: "Session", label: "Open HTML Draft Focus",
    description: "Open the existing locked HTML drafting Session surface.", sessionSafe: true,
    arguments: [], returns: "status", events: ["htmlDraftFocus.finished"],
  },
  {
    id: "uppercaseHandwriting.open", category: "Session", label: "Open Uppercase Handwriting",
    description: "Recognize one handwritten capital letter locally.", sessionSafe: true,
    arguments: [], returns: "status", events: ["uppercaseHandwriting.finished"],
  },
  {
    id: "sketchFocus.open", category: "Session", label: "Open Sketch Focus",
    description: "Open the full-screen graphite sketching Session surface.", sessionSafe: true,
    arguments: [], returns: "status", events: ["sketchFocus.finished"],
  },
  {
    id: "imageStitcher.open", category: "Session", label: "Open Image Stitcher",
    description: "Open the landmark-based image stitching Session surface.", sessionSafe: true,
    arguments: [], returns: "status", events: ["session.imageStitcher.finished"],
  },
  {
    id: "sectionals.update", category: "Aviation", label: "Update FAA Sectional Maps",
    description: "Run the configured FAA Sectional GeoTIFF update job.", sessionSafe: true,
    arguments: [], returns: "object",
  },
  {
    id: "sandbox.open", category: "Session", label: "Open Sandbox", sessionSafe: true,
    description: "Open the current HTML world in Sandbox Build or Play.",
    arguments: [arg("mode", "enum", { required: true, values: ["build", "play"] })],
    returns: "status", events: ["sandbox.finished"],
  },
  ...HTML_FORM_INSERT_COMMANDS,
]);
