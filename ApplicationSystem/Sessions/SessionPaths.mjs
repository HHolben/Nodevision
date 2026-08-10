// Nodevision/ApplicationSystem/Sessions/SessionPaths.mjs
// This module resolves built-in and user-owned Nodevision Session paths without allowing Session requests to escape their configured application roots.

import fsPromises from "node:fs/promises";
import path from "node:path";
import { NODEVISION_SESSION_EXTENSION, NODEVISION_SESSION_SCRIPT_EXTENSION } from "./SessionConstants.mjs";

export function isSessionFilename(value = "") {
  const name = path.basename(String(value || ""));
  return name.endsWith(NODEVISION_SESSION_EXTENSION) || name.endsWith(NODEVISION_SESSION_SCRIPT_EXTENSION);
}

export function getBuiltInSessionRoot(ctx) {
  return path.join(ctx.applicationSystemRoot, "Sessions", "BuiltIn");
}

export function getUserSessionRoot(ctx) {
  return path.join(ctx.userDataDir, "Sessions");
}

export async function ensureUserSessionRoot(ctx) {
  const root = getUserSessionRoot(ctx);
  await fsPromises.mkdir(root, { recursive: true });
  return root;
}

export function sessionRootForScope(scope, ctx) {
  if (scope === "builtin") return getBuiltInSessionRoot(ctx);
  if (scope === "user") return getUserSessionRoot(ctx);
  const err = new Error("Unsupported Session scope.");
  err.status = 400;
  throw err;
}

export function isWithin(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function sanitizeSessionName(value = "Session") {
  const cleaned = String(value || "Session")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "_")
    .replace(/\s+/g, " ")
    .replace(/_+/g, "_")
    .replace(/^[-_. ]+|[-_. ]+$/g, "")
    .slice(0, 96) || "Session";
  return cleaned.endsWith(NODEVISION_SESSION_EXTENSION) || cleaned.endsWith(NODEVISION_SESSION_SCRIPT_EXTENSION)
    ? cleaned
    : cleaned + NODEVISION_SESSION_EXTENSION;
}

export function normalizeSessionId(value = "") {
  const raw = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!raw || raw.includes("\0") || path.isAbsolute(raw)) {
    const err = new Error("Invalid Session identifier.");
    err.status = 400;
    throw err;
  }
  if (raw.split("/").some((segment) => segment === ".." || segment === "")) {
    const err = new Error("Session identifiers may not contain unsafe path segments.");
    err.status = 400;
    throw err;
  }
  if (!raw.endsWith(NODEVISION_SESSION_EXTENSION) && !raw.endsWith(NODEVISION_SESSION_SCRIPT_EXTENSION)) {
    const err = new Error("Session files must end with " + NODEVISION_SESSION_EXTENSION + " or " + NODEVISION_SESSION_SCRIPT_EXTENSION + ".");
    err.status = 400;
    throw err;
  }
  return raw;
}

export function resolveSessionPath(scope, id, ctx) {
  const root = sessionRootForScope(scope, ctx);
  const normalizedId = normalizeSessionId(id);
  const absolute = path.resolve(root, normalizedId);
  if (!isWithin(root, absolute)) {
    const err = new Error("Session path escaped its configured root.");
    err.status = 400;
    throw err;
  }
  return { root, id: normalizedId, absolute };
}

