// Nodevision/ApplicationSystem/public/Commands/CommandDefinitions.mjs
// This module declares shared Nodevision command metadata consumed by the console, Session editor, and Session runtime.

const arg = (name, type = "string", options = {}) => ({ name, type, ...options });

import { HTML_FORM_INSERT_COMMANDS } from './HtmlFormCommandDefinitions.mjs';
import { WORKSPACE_COMMANDS } from './WorkspaceCommandDefinitions.mjs';

export const NODEVISION_SHARED_COMMANDS = Object.freeze([
  ...WORKSPACE_COMMANDS,
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
