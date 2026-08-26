// Nodevision/ApplicationSystem/public/Commands/NodevisionCommandRegistry.mjs
// This module provides the authoritative shared Nodevision command registry and metadata discovery helpers.

import { NODEVISION_SHARED_COMMANDS } from "./CommandDefinitions.mjs";

const definitions = new Map(NODEVISION_SHARED_COMMANDS.map((entry) => [entry.id, { ...entry }]));
const handlers = new Map();

const load = (path, exportName) => async () => (await import(path))[exportName];
const BUILTIN_HANDLER_LOADERS = Object.freeze({
  "overlay.open": load("./handlers/OverlayCommands.mjs", "openOverlayCommand"),
  "overlay.show": load("./handlers/OverlayCommands.mjs", "showOverlayCommand"),
  "overlay.close": load("./handlers/OverlayCommands.mjs", "closeOverlayCommand"),
  "overlay.clear": load("./handlers/OverlayCommands.mjs", "closeOverlayCommand"),
  "overlay.setContent": load("./handlers/OverlayCommands.mjs", "setOverlayContentCommand"),
  "overlay.getInput": load("./handlers/OverlayCommands.mjs", "getOverlayInputCommand"),
  "panel.open": load("./handlers/PanelCommands.mjs", "openPanelCommand"),
  "panel.close": load("./handlers/PanelCommands.mjs", "closePanelCommand"),
  "panel.focus": load("./handlers/PanelCommands.mjs", "focusPanelCommand"),
  "viewer.open": load("./handlers/ViewerCommands.mjs", "openViewerCommand"),
  "viewer.currentFile": load("./handlers/ViewerCommands.mjs", "currentViewerFileCommand"),
  "viewer.close": load("./handlers/ViewerCommands.mjs", "closeViewerCommand"),
  "editor.open": load("./handlers/EditorCommands.mjs", "openEditorCommand"),
  "editor.save": load("./handlers/EditorCommands.mjs", "saveEditorCommand"),
  "editor.currentFile": load("./handlers/EditorCommands.mjs", "currentEditorFileCommand"),
  "editor.getContent": load("./handlers/EditorCommands.mjs", "getEditorContentCommand"),
  "editor.setContent": load("./handlers/EditorCommands.mjs", "setEditorContentCommand"),
  "file.read": load("./handlers/FileCommands.mjs", "readFileCommand"),
  "file.save": load("./handlers/FileCommands.mjs", "saveFileCommand"),
  "file.create": load("./handlers/FileCommands.mjs", "createFileCommand"),
  "speech.speak": load("./handlers/SpeechCommands.mjs", "speakCommand"),
  "speech.stop": load("./handlers/SpeechCommands.mjs", "stopSpeechCommand"),
  "speech.pause": load("./handlers/SpeechCommands.mjs", "pauseSpeechCommand"),
  "speech.resume": load("./handlers/SpeechCommands.mjs", "resumeSpeechCommand"),
  "speech.setRate": load("./handlers/SpeechCommands.mjs", "setSpeechRateCommand"),
  "console.open": load("./handlers/SystemCommands.mjs", "openConsoleCommand"),
  "session.emit": load("./handlers/SystemCommands.mjs", "emitSessionEventCommand"),
  "session.quit": load("./handlers/SystemCommands.mjs", "quitSessionCommand"),
  "htmlDraftFocus.open": load("./handlers/SystemCommands.mjs", "openHtmlDraftFocusCommand"),
  "sectionals.update": load("./handlers/SystemCommands.mjs", "updateSectionalsCommand"),
});

const HTML_FORM_INSERT_PREFIX = "editor.insert.form.";

function cloneArgument(arg) {
  return typeof arg === "string" ? { name: arg, type: "any" } : { ...arg };
}

function clone(entry) {
  return { ...entry, arguments: (entry.arguments || []).map(cloneArgument), events: [...(entry.events || [])] };
}

function sampleArg(arg = {}) {
  if (arg.type === "number") return "1";
  if (arg.type === "boolean") return "true";
  if (arg.type === "notebookPath") return '"path/to/file"';
  if (arg.type === "any") return "null";
  return `"${arg.name || "value"}"`;
}

export function registerNodevisionCommand(definition, handler) {
  if (!definition?.id) throw new Error("Command definitions require an id.");
  definitions.set(definition.id, { ...definition });
  if (handler) handlers.set(definition.id, handler);
}

export function getNodevisionCommandDefinition(commandId) {
  const found = definitions.get(String(commandId || ""));
  return found ? clone(found) : null;
}

export function getNodevisionCommandDefinitions(options = {}) {
  const commands = [...definitions.values()].map(clone);
  return options.sessionSafeOnly ? commands.filter((entry) => entry.sessionSafe === true) : commands;
}

export function getSessionSafeCommandDefinitions() {
  return getNodevisionCommandDefinitions({ sessionSafeOnly: true });
}

export function commandToConsoleSnippet(definition) {
  if (definition.consoleCommand) return definition.consoleCommand;
  const args = (definition.arguments || []).filter((arg) => arg.required).map(sampleArg).join(", ");
  return `import("/Commands/NodevisionCommandDispatcher.mjs").then((m) => m.dispatchNodevisionCommand("${definition.id}", [${args}], { source: "console" }))`;
}

export function getConsoleCommandDefinitions() {
  return getNodevisionCommandDefinitions().map((entry) => ({ ...entry, consoleCommand: commandToConsoleSnippet(entry) }));
}

export function searchNodevisionCommands(query = "", options = {}) {
  const terms = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  const commands = getNodevisionCommandDefinitions(options);
  if (!terms.length) return commands;
  return commands.filter((entry) => {
    const text = [entry.id, entry.category, entry.label, entry.description].join(" ").toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

export async function getNodevisionCommandHandler(commandId) {
  const id = String(commandId || "");
  if (handlers.has(id)) return handlers.get(id);
  if (id.startsWith(HTML_FORM_INSERT_PREFIX)) {
    const handler = await load("./handlers/HtmlInsertCommands.mjs", "insertHtmlFormElementCommand")();
    handlers.set(id, handler);
    return handler;
  }
  const loader = BUILTIN_HANDLER_LOADERS[id];
  if (!loader) return null;
  const handler = await loader();
  handlers.set(id, handler);
  return handler;
}
