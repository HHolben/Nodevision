// Nodevision/ApplicationSystem/Sessions/SessionMetadata.mjs
// This module extracts safe display metadata from JavaScript-like Nodevision Session source comments without executing Session code.

import path from "node:path";

function readDirective(source, key) {
  const pattern = new RegExp(`^\\s*//\\s*@${key}\\s+(.+?)\\s*$`, "im");
  const match = pattern.exec(String(source || ""));
  return match ? match[1].trim().slice(0, 240) : "";
}

export function titleFromSessionId(id = "") {
  const base = path.basename(String(id || "Session"));
  return base.endsWith(".NodevisionSession.js")
    ? base.slice(0, -".NodevisionSession.js".length)
    : path.basename(base, ".NodevisionSession")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Session";
}

export function readSessionMetadata(source = "", fallbackId = "") {
  return {
    title: readDirective(source, "title") || titleFromSessionId(fallbackId),
    description: readDirective(source, "description"),
    version: readDirective(source, "version") || "1",
  };
}

