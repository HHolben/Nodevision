// Nodevision/ApplicationSystem/public/Commands/handlers/SystemCommands.mjs
// This module adapts console, Session, and existing feature commands into the shared command dispatcher.

import { setStatus } from "/StatusBar.mjs";
import { emitNodevisionEvent } from "../NodevisionEventRegistry.mjs";

export async function openConsoleCommand() {
  await (await import("/ToolbarCallbacks/terminal/openNodevisionConsole.mjs")).default();
  return { ok: true };
}

export function emitSessionEventCommand([eventName, detail = null]) {
  emitNodevisionEvent(eventName, detail);
  return { ok: true, eventName };
}

export async function quitSessionCommand(args, context = {}) {
  const sessions = globalThis.window?.NodevisionSessions;
  const active = sessions?.getActiveSession?.();
  if (active?.runtime && active.runtime === context.runtime && typeof sessions.quitActiveSession === "function") {
    await sessions.quitActiveSession();
  } else {
    context.runtime?.abort?.();
    emitNodevisionEvent("session.quit", { source: "command" });
  }
  setStatus("Session", "Quit");
  return { ok: true };
}

export async function openHtmlDraftFocusCommand(args, context = {}) {
  return (await import("/Sessions/HTMLDraftFocusSession.mjs")).startHTMLDraftFocus(context);
}

export async function openImageStitcherCommand(args, context = {}) {
  return (await import("/Sessions/LandmarkImageStitchingSession.mjs")).startLandmarkImageStitchingSession(context);
}

export async function updateSectionalsCommand() {
  return (await import("/Settings/SectionalMapsCommands.mjs")).updateSectionalMapsFromBrowser();
}
