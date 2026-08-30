// Nodevision/ApplicationSystem/server/routes/resourcePathRoutes.mjs
// This module exposes authenticated Resource Paths, Resource Registry settings, and safe resource browsing routes.

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
import { getResources, listResourceRegistry, resolveResourceFile } from "../../Resources/ResourceRegistry.mjs";
import { saveResourceTypeSources } from "../../Resources/ResourceSettingsStore.mjs";

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

  app.get("/api/resource-paths/resource-file", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      const resolved = await resolveResourceFile(ctx, req.query || {});
      return res.sendFile(resolved.absolutePath);
    } catch (err) {
      return routeError(res, err, /not found|not a file|disabled/i.test(err?.message) ? 404 : 400);
    }
  });

  app.get("/api/resource-paths/resources", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      return res.json(await listResourceRegistry(ctx));
    } catch (err) {
      return routeError(res, err);
    }
  });

  app.get("/api/resource-paths/resources/:typeId", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      return res.json(await getResources(ctx, req.params.typeId, { raw: req.query.raw === "1" || req.query.raw === "true" }));
    } catch (err) {
      return routeError(res, err, /unknown resource type/i.test(err?.message) ? 404 : 400);
    }
  });

  app.post("/api/resource-paths/resources/:typeId/sources", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      const type = await saveResourceTypeSources(ctx, req.params.typeId, req.body?.sources || []);
      return res.json({ ok: true, type });
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
