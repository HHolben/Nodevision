// Nodevision/ApplicationSystem/Sessions/SessionRegistry.mjs
// This module lists, reads, creates, duplicates, saves, and deletes Nodevision Session files from the application and user Session roots.

import fsPromises from "node:fs/promises";
import path from "node:path";
import { createServerContext } from "../shared/serverContext.mjs";
import { DEFAULT_SESSION_SOURCE, MAX_SESSION_SOURCE_BYTES } from "./SessionConstants.mjs";
import {
  ensureUserSessionRoot,
  getBuiltInSessionRoot,
  getUserSessionRoot,
  isSessionFilename,
  resolveSessionPath,
  sanitizeSessionName,
} from "./SessionPaths.mjs";
import { readSessionMetadata } from "./SessionMetadata.mjs";

const BASE_CONTEXT = createServerContext();

async function fileExists(absolute) {
  try {
    const stat = await fsPromises.stat(absolute);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function listRoot(root, scope) {
  try {
    const entries = await fsPromises.readdir(root, { withFileTypes: true });
    const sessions = [];
    for (const entry of entries) {
      if (!entry.isFile() || !isSessionFilename(entry.name)) continue;
      const id = entry.name;
      const absolute = path.join(root, id);
      const source = await fsPromises.readFile(absolute, "utf8");
      const metadata = readSessionMetadata(source, id);
      sessions.push({ id, scope, ...metadata, readOnly: scope === "builtin" });
    }
    return sessions.sort((a, b) => a.title.localeCompare(b.title));
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

function assertSafeSource(source = "") {
  const text = String(source ?? "");
  if (Buffer.byteLength(text, "utf8") > MAX_SESSION_SOURCE_BYTES) {
    const err = new Error("Session source is too large.");
    err.status = 413;
    throw err;
  }
  return text;
}

export async function listSessions(ctx = BASE_CONTEXT) {
  await ensureUserSessionRoot(ctx);
  const [builtIn, user] = await Promise.all([
    listRoot(getBuiltInSessionRoot(ctx), "builtin"),
    listRoot(getUserSessionRoot(ctx), "user"),
  ]);
  return { builtIn, user };
}

export async function readSession(scope, id, ctx = BASE_CONTEXT) {
  const target = resolveSessionPath(scope, id, ctx);
  const stat = await fsPromises.stat(target.absolute);
  if (!stat.isFile()) throw Object.assign(new Error("Session not found."), { status: 404 });
  if (stat.size > MAX_SESSION_SOURCE_BYTES) throw Object.assign(new Error("Session source is too large."), { status: 413 });
  const source = await fsPromises.readFile(target.absolute, "utf8");
  const metadata = readSessionMetadata(source, target.id);
  return { id: target.id, scope, ...metadata, source, readOnly: scope === "builtin" };
}

export async function createUserSession(options = {}, ctx = BASE_CONTEXT) {
  const root = await ensureUserSessionRoot(ctx);
  const id = sanitizeSessionName(options.name || options.id || "New Session");
  const target = resolveSessionPath("user", id, ctx);
  if (await fileExists(target.absolute)) throw Object.assign(new Error("A Session with that name already exists."), { status: 409 });
  await fsPromises.mkdir(path.dirname(target.absolute), { recursive: true });
  const title = path.basename(id, ".NodevisionSession");
  const source = options.source || DEFAULT_SESSION_SOURCE.replace("New Session", title);
  await fsPromises.writeFile(target.absolute, assertSafeSource(source), "utf8");
  return readSession("user", path.relative(root, target.absolute).split(path.sep).join("/"), ctx);
}

export async function saveUserSession(id, source, ctx = BASE_CONTEXT) {
  const target = resolveSessionPath("user", id, ctx);
  await fsPromises.mkdir(path.dirname(target.absolute), { recursive: true });
  await fsPromises.writeFile(target.absolute, assertSafeSource(source), "utf8");
  return readSession("user", target.id, ctx);
}

export async function duplicateBuiltInSession(id, name = "", ctx = BASE_CONTEXT) {
  const sourceSession = await readSession("builtin", id, ctx);
  return createUserSession({
    name: name || sourceSession.title,
    source: sourceSession.source.replace(/^(\s*\/\/\s*@source\s+).+$/im, "$1user-duplicate"),
  }, ctx);
}

export async function deleteUserSession(id, ctx = BASE_CONTEXT) {
  const target = resolveSessionPath("user", id, ctx);
  await fsPromises.unlink(target.absolute);
  return { ok: true, id: target.id };
}

