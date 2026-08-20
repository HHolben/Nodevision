// Nodevision/ApplicationSystem/server/routes/resourcePathRoutes.mjs
// This module exposes authenticated Resource Paths settings and safe Notebook directory browsing routes.

import fs from "node:fs/promises";
import path from "node:path";
import {
  getResourcePath,
  listResourcePaths,
  removeResourcePath,
  saveResourcePathEntries,
  setResourcePath,
} from "../../ResourcePaths/ResourcePathStore.mjs";
import { resolveNotebookResourceDirectory, toNotebookRelativeResourcePath } from "../../ResourcePaths/ResourcePathValidation.mjs";

function authenticated(req, res) {
  if (req.identity) return true;
  res.status(401).json({ ok: false, error: "Authentication required" });
  return false;
}

function routeError(res, err, status = 400) {
  return res.status(status).json({ ok: false, error: err?.message || String(err) });
}

async function listDirectories(ctx, requestedPath = "") {
  const relative = toNotebookRelativeResourcePath(ctx, requestedPath || "", { allowEmpty: true });
  const resolved = relative
    ? await resolveNotebookResourceDirectory(ctx, relative)
    : { relativeDirectory: "", absoluteDirectory: path.resolve(ctx.notebookDir), exists: true, isDirectory: true };
  if (resolved.exists && !resolved.isDirectory) throw new Error("Requested path is not a directory.");
  if (!resolved.exists) return { path: resolved.relativeDirectory, directories: [] };
  const entries = await fs.readdir(resolved.absoluteDirectory, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const child = path.posix.join(resolved.relativeDirectory, entry.name).replace(/^\/+/, "");
      return { name: entry.name, path: child };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { path: resolved.relativeDirectory, directories };
}

export function registerResourcePathRoutes(app, ctx) {
  app.get("/api/resource-paths", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      return res.json({ ok: true, resourcePaths: await listResourcePaths(ctx) });
    } catch (err) {
      return routeError(res, err);
    }
  });

  app.post("/api/resource-paths", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      return res.json({ ok: true, resourcePaths: await saveResourcePathEntries(ctx, req.body?.resourcePaths || []) });
    } catch (err) {
      return routeError(res, err);
    }
  });

  app.get("/api/resource-paths/browse", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      return res.json({ ok: true, ...(await listDirectories(ctx, req.query.path || "")) });
    } catch (err) {
      return routeError(res, err);
    }
  });

  app.get("/api/resource-paths/:key", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      return res.json({ ok: true, resourcePath: await getResourcePath(ctx, req.params.key) });
    } catch (err) {
      return routeError(res, err, /not configured/i.test(err?.message) ? 404 : 400);
    }
  });

  app.put("/api/resource-paths/:key", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      const resourcePath = await setResourcePath(ctx, { ...(req.body || {}), key: req.params.key });
      return res.json({ ok: true, resourcePath });
    } catch (err) {
      return routeError(res, err);
    }
  });

  app.delete("/api/resource-paths/:key", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      return res.json(await removeResourcePath(ctx, req.params.key));
    } catch (err) {
      return routeError(res, err);
    }
  });
}
