// Nodevision/ApplicationSystem/public/Commands/NodevisionEventRegistry.mjs
// This module records shared Nodevision event names and emits sanitized event payloads for commands and Sessions.

import { COMMAND_ERROR_CODES, commandError } from "./CommandErrors.mjs";

export const NODEVISION_EVENT_DEFINITIONS = Object.freeze([
  { id: "overlay.opened", description: "A command-owned overlay opened." },
  { id: "overlay.closed", description: "A command-owned overlay closed." },
  { id: "overlay.submitted", description: "A command-owned overlay submitted a choice or input." },
  { id: "panel.opened", description: "A panel open command completed its request." },
  { id: "panel.closed", description: "A panel close command completed its request." },
  { id: "panel.focused", description: "A panel focus command selected an existing panel." },
  { id: "viewer.opened", description: "The existing file viewer was asked to render a file." },
  { id: "viewer.closed", description: "The active file viewer was closed." },
  { id: "editor.opened", description: "The existing code editor was asked to open a file." },
  { id: "editor.saved", description: "The active editor saved through Nodevision's save path." },
  { id: "file.saved", description: "A file command saved Notebook content." },
  { id: "speech.started", description: "The selected speech provider started an utterance." },
  { id: "speech.boundary", description: "The selected speech provider reported a native boundary when available." },
  { id: "speech.paused", description: "The selected speech provider paused." },
  { id: "speech.resumed", description: "The selected speech provider resumed." },
  { id: "speech.finished", description: "The selected speech provider finished an utterance." },
  { id: "speech.cancelled", description: "The selected speech provider cancelled an utterance." },
  { id: "speech.error", description: "The selected speech provider reported an error." },
  { id: "session.continue", description: "A legacy Session continue overlay was submitted." },
  { id: "session.paused", description: "A running Session paused." },
  { id: "session.resumed", description: "A paused Session resumed." },
  { id: "session.quit", description: "A Session quit command was requested." },
  { id: "htmlDraftFocus.finished", description: "The HTML Draft Focus Session completed." },
]);

const EVENTS = new Map(NODEVISION_EVENT_DEFINITIONS.map((entry) => [entry.id, entry]));
const EVENT_NAME_RE = /^[a-zA-Z0-9_.:-]{1,96}$/;

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function sanitizeEventDetail(value, depth = 0) {
  if (value === null || value === undefined) return null;
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  if (depth > 6) return String(value);
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => sanitizeEventDetail(item, depth + 1));
  if (!isPlainObject(value)) return String(value);
  const out = {};
  for (const [key, entry] of Object.entries(value).slice(0, 80)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) continue;
    out[key] = sanitizeEventDetail(entry, depth + 1);
  }
  return out;
}

export function isKnownNodevisionEvent(eventName = "") {
  const name = String(eventName || "").trim();
  return EVENT_NAME_RE.test(name) && (EVENTS.has(name) || name.startsWith("session."));
}

export function assertKnownNodevisionEvent(eventName = "") {
  const name = String(eventName || "").trim();
  if (!isKnownNodevisionEvent(name)) {
    throw commandError(COMMAND_ERROR_CODES.UNKNOWN_EVENT, `Unknown or unavailable Session event: ${name || "(empty)"}.`, { eventName: name });
  }
  return name;
}

export function getNodevisionEventDefinitions() {
  return NODEVISION_EVENT_DEFINITIONS.map((entry) => ({ ...entry }));
}

export function emitNodevisionEvent(eventName, detail = null, target = globalThis.window) {
  const name = assertKnownNodevisionEvent(eventName);
  const safeDetail = sanitizeEventDetail(detail);
  if (!target?.dispatchEvent) return safeDetail;
  const CustomEventCtor = globalThis.CustomEvent || target.CustomEvent;
  if (typeof CustomEventCtor === "function") {
    target.dispatchEvent(new CustomEventCtor(name, { detail: safeDetail }));
  } else {
    target.dispatchEvent({ type: name, detail: safeDetail });
  }
  return safeDetail;
}
