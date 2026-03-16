// Nodevision/ApplicationSystem/routes/api/listDirectory.js
// This file defines the list Directory API route handler for the Nodevision server. It validates requests and sends responses for list Directory operations.
import express from "express";
import fs from "fs/promises";
import path from "path";
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();

export default function createListDirectoryRouter(ctx = BASE_CONTEXT) {
  const NOTEBOOK_DIR = ctx.notebookDir;
  const router = express.Router();

  /**
   * Normalize and resolve a project-relative id into a filesystem path.
   * Expects pathId like "Notebook/Dir/Sub"
   */
  function resolvePathIdToFs(pathId) {
    const parts = pathId.split("/").filter(Boolean);
    if (parts.length === 1 && parts[0] === "Notebook") {
      return NOTEBOOK_DIR;
    }
    const rel = parts.slice(1).join(path.sep);
    return path.join(NOTEBOOK_DIR, rel);
  }

  router.get("/listDirectory", async (req, res) => {
    try {
      const pathId = req.query.path;
      if (!pathId) {
        return res.status(400).json({ error: "Missing path parameter" });
      }
      console.log("[listDirectory] pathId:", pathId);

      const fsPath = resolvePathIdToFs(pathId);
      const entries = await fs.readdir(fsPath, { withFileTypes: true });
      const directories = [];
      const files = [];
      for (const e of entries) {
        if (e.isDirectory()) directories.push(e.name);
        else if (e.isFile()) {
          if (/\.(md|html|txt|json|js|css)$/i.test(e.name)) files.push(e.name);
        }
      }
      res.json({ directories, files });
    } catch (err) {
      console.error("[listDirectory] error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
