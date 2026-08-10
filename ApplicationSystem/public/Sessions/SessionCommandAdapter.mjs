// Nodevision/ApplicationSystem/public/Sessions/SessionCommandAdapter.mjs
// This module exposes a small, metadata-bearing Nodevision command surface that Sessions can invoke without evaluating console snippets or arbitrary toolbar callbacks.

import { getNodevisionConsoleCommands } from "../NodevisionConsoleCommands.mjs";
import { setStatus } from "../StatusBar.mjs";

const SESSION_COMMANDS = Object.freeze([
  { id: "overlay.show", category: "Overlay", label: "Show Overlay Message", description: "Show a Session message through the Nodevision overlay system.", arguments: ["message"], sessionSafe: true },
  { id: "panel.open", category: "Panels", label: "Open Panel", description: "Open an existing Nodevision panel through the toolbar action event.", arguments: ["panelId", "panelClass"], sessionSafe: true },
  { id: "viewer.open", category: "Panels", label: "Open Viewer For File", description: "Select a Notebook file and ask the existing file viewer to render it.", arguments: ["filePath"], sessionSafe: true },
  { id: "console.open", category: "Run", label: "Open Nodevision Console", description: "Open the existing floating Nodevision Console.", arguments: [], sessionSafe: true },
  { id: "session.emit", category: "Session", label: "Emit Session Event", description: "Emit a local Session event for waits and tests.", arguments: ["eventName", "detail"], sessionSafe: true },
  { id: "session.quit", category: "Session", label: "Quit Session", description: "Stop the active Session.", arguments: [], sessionSafe: true },
  { id: "htmlDraftFocus.open", category: "Session", label: "Open HTML Draft Focus", description: "Open the locked, gamified HTML drafting surface for the HTML Draft Focus Session.", arguments: [], sessionSafe: true },
]);

export function getNodevisionCommandDefinitions() {
  const consoleCommands = getNodevisionConsoleCommands().map((entry) => ({
    id: `console.${entry.id}`,
    category: entry.category,
    label: entry.label,
    description: entry.description,
    arguments: [],
    sessionSafe: false,
    consoleCommand: entry.command,
  }));
  return [...SESSION_COMMANDS.map((entry) => ({ ...entry })), ...consoleCommands];
}

export function searchNodevisionCommands(query = "") {
  const terms = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return getNodevisionCommandDefinitions();
  return getNodevisionCommandDefinitions().filter((entry) => {
    const text = [entry.id, entry.category, entry.label, entry.description].join(" ").toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

function dispatchToolbarAction(id, type = "InfoPanel", replaceActive = true) {
  window.dispatchEvent(new CustomEvent("toolbarAction", { detail: { id, type, replaceActive } }));
}

export async function runNodevisionCommand(commandId, args = [], context = {}) {
  switch (commandId) {
    case "overlay.show":
      context.ui?.showMessage?.(String(args[0] ?? ""));
      return { ok: true };
    case "panel.open":
      dispatchToolbarAction(String(args[0] || "FileManager"), String(args[1] || "InfoPanel"), false);
      return { ok: true };
    case "viewer.open":
      window.selectedFilePath = String(args[0] || "");
      dispatchToolbarAction("FileView", "ViewPanel", false);
      return { ok: true };
    case "console.open":
      await (await import("../ToolbarCallbacks/terminal/openNodevisionConsole.mjs")).default();
      return { ok: true };
    case "session.emit": {
      const eventName = String(args[0] || "").trim();
      const validEventName = new RegExp("^[a-zA-Z0-9_.:-]+");
      if (!eventName || eventName.length > 96 || validEventName.exec(eventName)?.[0] !== eventName) throw new Error("Invalid Session event name.");
      window.dispatchEvent(new CustomEvent(eventName, { detail: args[1] ?? null }));
      return { ok: true };
    }
    case "session.quit":
      context.runtime?.abort?.();
      setStatus("Session", "Quit");
      return { ok: true };
    case "htmlDraftFocus.open":
      return (await import("./HTMLDraftFocusSession.mjs")).startHTMLDraftFocus(context);
    default:
      throw new Error(`Unknown or unavailable Session command: ${commandId}.`);
  }
}

